"""
LangGraph workflow nodes for Spec-Bot specification generation.
Each node represents a step in the workflow that processes the state and performs specific tasks.
"""

import logging
from typing import Dict, Any, List, Optional
import asyncio

from workflow_state import WorkflowGraphState, WorkflowStatus, get_state_manager
from llm_client import LLMMessage, get_llm_client, LLMError
from llm_utils import generate_and_parse, ParseResult, ParseMode
from template_renderer import SpecRenderer
from models import SpecState, WorkflowPhase

logger = logging.getLogger(__name__)


# Prompts for each generation phase
REQUIREMENTS_SYSTEM_PROMPT = """You are an expert business analyst and requirements engineer. Your task is to generate comprehensive, well-structured requirements documentation for software features.

Given a feature description, you should:
1. Analyze the business need and context
2. Define clear functional requirements with user stories and acceptance criteria
3. Identify non-functional requirements (performance, security, usability, etc.)
4. Specify data requirements and system constraints  
5. Assess risks and success criteria

**CRITICAL: Use this EXACT format for functional requirements:**

## Functional Requirements

### Requirement 1

**User Story:** As a [role], I want to [action] so that [benefit].

**Acceptance Criteria:**
- Criterion 1: Clear, testable requirement
- Criterion 2: Another specific requirement  
- Criterion 3: Additional requirement as needed

**Business Rules:**
- Rule 1: Any business logic or constraints
- Rule 2: Additional rules as needed

### Requirement 2

**User Story:** As a [role], I want to [action] so that [benefit].

**Acceptance Criteria:**
- Criterion 1: Clear, testable requirement
- Criterion 2: Another specific requirement

Continue this pattern for all functional requirements. Each requirement must have a User Story and Acceptance Criteria. Business Rules, Dependencies, and Assumptions are optional but should be included when relevant."""

DESIGN_SYSTEM_PROMPT = """You are a senior software architect and system designer. Your task is to create comprehensive technical design documentation based on established requirements.

Given feature requirements, you should:
1. Design system architecture and component structure
2. Define data models and database schema changes
3. Specify API endpoints and interfaces
4. Design user interface components and workflows
5. Address security, performance, and scalability considerations
6. Plan testing strategies and deployment approaches

**CRITICAL: Use this EXACT structure for your design document:**

## Overview

[Provide a clear problem statement and solution approach. Explain what the design addresses and the key technical approach.]

## Architecture

### Data Model Architecture

[Include technical diagrams using ASCII art and explain the data relationships]

```
[Data Model Diagram - ASCII art showing relationships]
```

### Database Schema Enhancements

[Provide specific database changes needed]

**Critical Fix - [Database/Model Changes]:**
```sql
-- Or TypeScript/JavaScript code examples
[Specific code examples for schema changes]
```

**Performance Indexes:**
```sql
[Any database indexes needed for performance]
```

## Components and Interfaces

### 1. [Component Name] (`path/to/component`)

**Responsibilities:**
- [List key responsibilities]

**Key Methods:**
```[language]
[Specific code examples for key methods/interfaces]
```

### 2. [Another Component]

[Continue this pattern for all major components]

## Testing Strategy

### Unit Testing Approach

[Describe unit testing strategy with code examples]

```[language]
[Specific unit test examples]
```

### Integration Testing

[Describe integration testing approach]

```[language]
[Integration test examples]
```

Structure your entire response following this exact format. Include real technical details, code examples, and architectural diagrams using ASCII art."""

TASKS_SYSTEM_PROMPT = """You are an experienced project manager and software development lead. Your task is to create detailed implementation plans based on requirements and design specifications.

Given requirements and design documents, you should:
1. Break down the work into logical phases and tasks
2. Define clear task descriptions with acceptance criteria
3. Estimate effort and identify dependencies
4. Plan resource requirements and timeline
5. Identify risks and mitigation strategies
6. Define success metrics and quality assurance processes

**CRITICAL: Use this EXACT format for your response:**

### Phase 1: [Phase Name]

Brief description of this phase.

| Task ID | Task Description | Acceptance Criteria | Estimate | Dependencies |
|---------|------------------|-------------------|-----------|--------------|
| 1.1 Task Name | Detailed description of what needs to be done | Clear criteria for completion | Time estimate | Previous tasks or external deps |
| 1.2 Another Task | Another detailed description | More acceptance criteria | Time estimate | Dependencies if any |

### Phase 2: [Phase Name]

Brief description of this phase.

| Task ID | Task Description | Acceptance Criteria | Estimate | Dependencies |
|---------|------------------|-------------------|-----------|--------------|
| 2.1 Task Name | Detailed description | Clear criteria | Time estimate | Dependencies |

Continue this pattern for all phases. Each phase must use "### Phase" headers and tasks must be in the table format shown above."""


async def generate_requirements_node(state: WorkflowGraphState) -> WorkflowGraphState:
    """
    Generate requirements document using LLM.
    
    Args:
        state: Current workflow state
        
    Returns:
        Updated workflow state with generated requirements
    """
    
    logger.info(f"Generating requirements for workflow {state['workflow_id']}")
    
    try:
        # Update state to show we're generating
        state_manager = get_state_manager()
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {"status": WorkflowStatus.GENERATING_REQUIREMENTS}
        )
        
        # Prepare messages for LLM
        messages = [
            LLMMessage(role="system", content=REQUIREMENTS_SYSTEM_PROMPT),
            LLMMessage(
                role="user", 
                content=f"""Please generate comprehensive requirements documentation for the following feature:

**Feature Name:** {state['feature_name']}

**Description:** {state['initial_description']}

{_build_context_from_conversation(state)}

Please provide a detailed requirements document that covers all aspects of this feature, including functional requirements, non-functional requirements, data requirements, integration needs, constraints, and risk assessment."""
            )
        ]
        
        # Get LLM client
        llm_client = get_llm_client(
            provider=state["llm_provider"],
            model_name=state["model_name"]
        )
        
        # Generate requirements
        response = await llm_client.generate(messages)
        requirements_content = response.content
        
        # Add to conversation history
        state_manager.add_conversation_message(
            state["workflow_id"],
            "assistant",
            requirements_content,
            {"phase": "requirements", "model": state["model_name"]}
        )
        
        # Set pending approval
        state = state_manager.set_pending_approval(
            state["workflow_id"],
            "requirements",
            requirements_content
        )
        
        logger.info(f"Generated requirements for workflow {state['workflow_id']}")
        
    except Exception as e:
        logger.error(f"Error generating requirements for workflow {state['workflow_id']}: {e}")
        
        # Update state with error
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {
                "status": WorkflowStatus.FAILED,
                "last_error": str(e),
                "retry_count": state["retry_count"] + 1
            }
        )
    
    return state


async def generate_design_node(state: WorkflowGraphState) -> WorkflowGraphState:
    """
    Generate design document using LLM, incorporating requirements.
    
    Args:
        state: Current workflow state
        
    Returns:
        Updated workflow state with generated design
    """
    
    logger.info(f"Generating design for workflow {state['workflow_id']}")
    
    try:
        # Update state to show we're generating
        state_manager = get_state_manager()
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {"status": WorkflowStatus.GENERATING_DESIGN}
        )
        
        # Prepare messages for LLM, including requirements context
        context_parts = [
            f"**Feature Name:** {state['feature_name']}",
            f"**Description:** {state['initial_description']}"
        ]
        
        # Include requirements if available
        if state["requirements_content"]:
            context_parts.append(f"**Requirements Document:**\n{state['requirements_content']}")
        
        # Include user feedback if revising
        if state["user_feedback"]:
            context_parts.append(f"**User Feedback:** {state['user_feedback']}")
        
        context = "\n\n".join(context_parts)
        
        messages = [
            LLMMessage(role="system", content=DESIGN_SYSTEM_PROMPT),
            LLMMessage(
                role="user",
                content=f"""Please generate comprehensive technical design documentation based on the following information:

{context}

{_build_context_from_conversation(state)}

Create a detailed design document that addresses architecture, data models, API design, user interface, security, performance, and implementation considerations. The design should be practical and implementable based on the requirements."""
            )
        ]
        
        # Get LLM client
        llm_client = get_llm_client(
            provider=state["llm_provider"],
            model_name=state["model_name"]
        )
        
        # Generate design
        response = await llm_client.generate(messages)
        design_content = response.content
        
        # Add to conversation history
        state_manager.add_conversation_message(
            state["workflow_id"],
            "assistant",
            design_content,
            {"phase": "design", "model": state["model_name"]}
        )
        
        # Set pending approval
        state = state_manager.set_pending_approval(
            state["workflow_id"],
            "design", 
            design_content
        )
        
        logger.info(f"Generated design for workflow {state['workflow_id']}")
        
    except Exception as e:
        logger.error(f"Error generating design for workflow {state['workflow_id']}: {e}")
        
        # Update state with error
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {
                "status": WorkflowStatus.FAILED,
                "last_error": str(e),
                "retry_count": state["retry_count"] + 1
            }
        )
    
    return state


async def generate_tasks_node(state: WorkflowGraphState) -> WorkflowGraphState:
    """
    Generate implementation tasks using LLM, incorporating requirements and design.
    
    Args:
        state: Current workflow state
        
    Returns:
        Updated workflow state with generated tasks
    """
    
    logger.info(f"Generating tasks for workflow {state['workflow_id']}")
    
    try:
        # Update state to show we're generating
        state_manager = get_state_manager()
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {"status": WorkflowStatus.GENERATING_TASKS}
        )
        
        # Prepare messages for LLM, including requirements and design context
        context_parts = [
            f"**Feature Name:** {state['feature_name']}",
            f"**Description:** {state['initial_description']}"
        ]
        
        # Include requirements if available
        if state["requirements_content"]:
            context_parts.append(f"**Requirements Document:**\n{state['requirements_content']}")
        
        # Include design if available
        if state["design_content"]:
            context_parts.append(f"**Design Document:**\n{state['design_content']}")
        
        # Include user feedback if revising
        if state["user_feedback"]:
            context_parts.append(f"**User Feedback:** {state['user_feedback']}")
        
        context = "\n\n".join(context_parts)
        
        messages = [
            LLMMessage(role="system", content=TASKS_SYSTEM_PROMPT),
            LLMMessage(
                role="user",
                content=f"""Please generate a comprehensive implementation plan based on the following information:

{context}

{_build_context_from_conversation(state)}

Create a detailed implementation plan that breaks down the work into phases and specific tasks. Include estimates, dependencies, resource requirements, quality assurance processes, and success metrics. The plan should be actionable and guide a development team through the implementation."""
            )
        ]
        
        # Get LLM client
        llm_client = get_llm_client(
            provider=state["llm_provider"],
            model_name=state["model_name"]
        )
        
        # Generate tasks
        response = await llm_client.generate(messages)
        tasks_content = response.content
        
        # Add to conversation history
        state_manager.add_conversation_message(
            state["workflow_id"],
            "assistant",
            tasks_content,
            {"phase": "tasks", "model": state["model_name"]}
        )
        
        # Set pending approval
        state = state_manager.set_pending_approval(
            state["workflow_id"],
            "tasks",
            tasks_content
        )
        
        logger.info(f"Generated tasks for workflow {state['workflow_id']}")
        
    except Exception as e:
        logger.error(f"Error generating tasks for workflow {state['workflow_id']}: {e}")
        
        # Update state with error
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {
                "status": WorkflowStatus.FAILED,
                "last_error": str(e),
                "retry_count": state["retry_count"] + 1
            }
        )
    
    return state


async def human_approval_gate_node(state: WorkflowGraphState) -> WorkflowGraphState:
    """
    Human approval gate - waits for user input before proceeding.
    This node doesn't modify the state but serves as a checkpoint.
    
    Args:
        state: Current workflow state
        
    Returns:
        Unmodified workflow state (user interaction happens externally)
    """
    
    logger.info(f"Workflow {state['workflow_id']} waiting for human approval")
    
    # In a real implementation, this would trigger notifications to the user
    # For now, we just log and return the state unchanged
    # The actual approval handling happens through API endpoints
    
    return state


async def generate_final_documents_node(state: WorkflowGraphState) -> WorkflowGraphState:
    """
    Generate final specification documents using templates and write them to disk.
    
    Args:
        state: Current workflow state
        
    Returns:
        Updated workflow state with generated files
    """
    
    logger.info(f"Generating final documents for workflow {state['workflow_id']}")
    
    try:
        state_manager = get_state_manager()
        
        # Convert to SpecState for template rendering
        spec_state = state_manager.convert_to_spec_state(state)
        
        # Render all documents
        renderer = SpecRenderer()
        documents = renderer.render_all_documents(spec_state)
        
        # Write files to disk using FileManager
        from file_manager import FileManager
        file_manager = FileManager()
        
        written_files = file_manager.write_specification_files(
            workflow_id=state["workflow_id"],
            feature_name=spec_state.feature_name,
            files=documents
        )
        
        logger.info(f"Successfully wrote {len(written_files)} files to disk:")
        for filename, path in written_files.items():
            logger.info(f"  {filename} -> {path}")
        
        # Update state with generated files and file paths
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {
                "generated_files": documents,
                "written_file_paths": written_files,
                "status": WorkflowStatus.COMPLETED
            }
        )
        
        logger.info(f"Generated and wrote {len(documents)} final documents for workflow {state['workflow_id']}")
        
    except Exception as e:
        logger.error(f"Error generating final documents for workflow {state['workflow_id']}: {e}")
        
        state = state_manager.update_workflow_state(
            state["workflow_id"],
            {
                "status": WorkflowStatus.FAILED,
                "last_error": str(e)
            }
        )
    
    return state


def _build_context_from_conversation(state: WorkflowGraphState) -> str:
    """
    Build additional context from conversation history for LLM prompts.
    
    Args:
        state: Current workflow state
        
    Returns:
        Formatted conversation context
    """
    
    if not state["conversation_history"]:
        return ""
    
    # Get recent relevant messages (last 5 user messages)
    user_messages = [
        msg for msg in state["conversation_history"][-10:]
        if msg["role"] == "user"
    ]
    
    if not user_messages:
        return ""
    
    context_parts = ["**Additional Context from Conversation:**"]
    
    for i, msg in enumerate(user_messages[-3:], 1):  # Last 3 user messages
        context_parts.append(f"{i}. {msg['content'][:200]}{'...' if len(msg['content']) > 200 else ''}")
    
    return "\n".join(context_parts)


# Node routing functions

def should_generate_requirements(state: WorkflowGraphState) -> bool:
    """Check if we should generate requirements"""
    return (
        state["status"] == WorkflowStatus.GENERATING_REQUIREMENTS or
        (state["status"] == WorkflowStatus.INITIALIZING and state["current_phase"] == WorkflowPhase.REQUIREMENTS)
    )


def should_generate_design(state: WorkflowGraphState) -> bool:
    """Check if we should generate design"""
    return state["status"] == WorkflowStatus.GENERATING_DESIGN


def should_generate_tasks(state: WorkflowGraphState) -> bool:
    """Check if we should generate tasks"""
    return state["status"] == WorkflowStatus.GENERATING_TASKS


def should_wait_for_approval(state: WorkflowGraphState) -> bool:
    """Check if we should wait for human approval"""
    return state["status"] in [
        WorkflowStatus.AWAITING_REQUIREMENTS_APPROVAL,
        WorkflowStatus.AWAITING_DESIGN_APPROVAL,
        WorkflowStatus.AWAITING_TASKS_APPROVAL
    ]


def should_generate_final_documents(state: WorkflowGraphState) -> bool:
    """Check if we should generate final documents"""
    return (
        state["requirements_approved"] and 
        state["design_approved"] and 
        state["tasks_approved"] and
        state["status"] != WorkflowStatus.COMPLETED
    )


def is_workflow_complete(state: WorkflowGraphState) -> bool:
    """Check if workflow is complete"""
    return state["status"] == WorkflowStatus.COMPLETED


def is_workflow_failed(state: WorkflowGraphState) -> bool:
    """Check if workflow has failed"""
    return state["status"] == WorkflowStatus.FAILED 