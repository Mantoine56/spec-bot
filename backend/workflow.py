"""
Complete LangGraph workflow for Spec-Bot specification generation.
Orchestrates the three-phase workflow with human-in-the-loop approvals.
"""

import logging
from typing import Dict, Any, Literal, Optional, List
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from workflow_state import WorkflowGraphState, WorkflowStatus, get_state_manager
from workflow_nodes import (
    generate_requirements_node,
    generate_design_node,
    generate_tasks_node,
    human_approval_gate_node,
    generate_final_documents_node,
    should_generate_requirements,
    should_generate_design,
    should_generate_tasks,
    should_wait_for_approval,
    should_generate_final_documents,
    is_workflow_complete,
    is_workflow_failed
)

logger = logging.getLogger(__name__)


async def determine_start_node(state: WorkflowGraphState) -> WorkflowGraphState:
    """
    Entry point node that determines the first action based on workflow state.
    """
    logger.info(f"Determining start action for workflow {state['workflow_id']}")
    return state


def create_spec_workflow() -> StateGraph:
    """
    Create the complete LangGraph workflow for specification generation.
    
    Returns:
        Configured StateGraph for the spec generation workflow
    """
    
    # Create the workflow graph
    workflow = StateGraph(WorkflowGraphState)
    
    # Add nodes
    workflow.add_node("determine_start", determine_start_node)
    workflow.add_node("generate_requirements", generate_requirements_node)
    workflow.add_node("generate_design", generate_design_node)
    workflow.add_node("generate_tasks", generate_tasks_node)
    workflow.add_node("human_approval", human_approval_gate_node)
    workflow.add_node("generate_final_documents", generate_final_documents_node)
    
    # Set entry point
    workflow.set_entry_point("determine_start")
    
    # Add edges and conditional routing
    
    # From start determination
    workflow.add_conditional_edges(
        "determine_start",
        _route_from_start,
        {
            "generate_requirements": "generate_requirements",
            "generate_design": "generate_design", 
            "generate_tasks": "generate_tasks",
            "human_approval": "human_approval",
            "generate_final_documents": "generate_final_documents",
            "end": END
        }
    )
    
    # From requirements generation
    workflow.add_conditional_edges(
        "generate_requirements",
        _route_from_requirements,
        {
            "human_approval": "human_approval",
            "generate_requirements": "generate_requirements",  # Retry on error
            "end": END
        }
    )
    
    # From design generation
    workflow.add_conditional_edges(
        "generate_design",
        _route_from_design,
        {
            "human_approval": "human_approval",
            "generate_design": "generate_design",  # Retry on error
            "end": END
        }
    )
    
    # From tasks generation
    workflow.add_conditional_edges(
        "generate_tasks",
        _route_from_tasks,
        {
            "human_approval": "human_approval",
            "generate_tasks": "generate_tasks",  # Retry on error
            "end": END
        }
    )
    
    # From human approval gate - should only continue after approval, never loop back
    workflow.add_conditional_edges(
        "human_approval",
        _route_from_approval,
        {
            "generate_requirements": "generate_requirements",
            "generate_design": "generate_design", 
            "generate_tasks": "generate_tasks",
            "generate_final_documents": "generate_final_documents",
            "end": END
        }
    )
    
    # From final document generation
    workflow.add_conditional_edges(
        "generate_final_documents",
        _route_from_final_documents,
        {
            "end": END,
            "generate_final_documents": "generate_final_documents"  # Retry on error
        }
    )
    
    return workflow


def _route_from_start(state: WorkflowGraphState) -> Literal[
    "generate_requirements", "generate_design", "generate_tasks", 
    "human_approval", "generate_final_documents", "end"
]:
    """Route from START based on current workflow state"""
    
    # Check for failure or completion first
    if is_workflow_failed(state):
        logger.info(f"Workflow {state['workflow_id']} failed, ending")
        return "end"
    
    if is_workflow_complete(state):
        logger.info(f"Workflow {state['workflow_id']} already complete, ending")
        return "end"
    
    # Check if we should generate final documents
    if should_generate_final_documents(state):
        logger.info(f"Workflow {state['workflow_id']} ready for final document generation")
        return "generate_final_documents"
    
    # Check if waiting for approval
    if should_wait_for_approval(state):
        logger.info(f"Workflow {state['workflow_id']} waiting for approval")
        return "human_approval"
    
    # Check generation phases
    if should_generate_requirements(state):
        logger.info(f"Workflow {state['workflow_id']} generating requirements")
        return "generate_requirements"
    
    if should_generate_design(state):
        logger.info(f"Workflow {state['workflow_id']} generating design")
        return "generate_design"
    
    if should_generate_tasks(state):
        logger.info(f"Workflow {state['workflow_id']} generating tasks")
        return "generate_tasks"
    
    if state["status"] == WorkflowStatus.GENERATING_FINAL_DOCUMENTS:
        logger.info(f"Workflow {state['workflow_id']} generating final documents")
        return "generate_final_documents"
    
    # Default fallback
    logger.warning(f"Workflow {state['workflow_id']} in unexpected state, ending")
    return "end"


def _route_from_requirements(state: WorkflowGraphState) -> Literal[
    "human_approval", "generate_requirements", "end"
]:
    """Route from requirements generation"""
    
    if is_workflow_failed(state):
        # Check if we should retry
        if state["retry_count"] < 3:
            logger.info(f"Retrying requirements generation for workflow {state['workflow_id']}")
            return "generate_requirements"
        else:
            logger.error(f"Max retries reached for workflow {state['workflow_id']}")
            return "end"
    
    if state["status"] == WorkflowStatus.AWAITING_REQUIREMENTS_APPROVAL:
        return "human_approval"
    
    return "end"


def _route_from_design(state: WorkflowGraphState) -> Literal[
    "human_approval", "generate_design", "end"
]:
    """Route from design generation"""
    
    if is_workflow_failed(state):
        # Check if we should retry
        if state["retry_count"] < 3:
            logger.info(f"Retrying design generation for workflow {state['workflow_id']}")
            return "generate_design"
        else:
            logger.error(f"Max retries reached for workflow {state['workflow_id']}")
            return "end"
    
    if state["status"] == WorkflowStatus.AWAITING_DESIGN_APPROVAL:
        return "human_approval"
    
    return "end"


def _route_from_tasks(state: WorkflowGraphState) -> Literal[
    "human_approval", "generate_tasks", "end"
]:
    """Route from tasks generation"""
    
    if is_workflow_failed(state):
        # Check if we should retry
        if state["retry_count"] < 3:
            logger.info(f"Retrying tasks generation for workflow {state['workflow_id']}")
            return "generate_tasks"
        else:
            logger.error(f"Max retries reached for workflow {state['workflow_id']}")
            return "end"
    
    if state["status"] == WorkflowStatus.AWAITING_TASKS_APPROVAL:
        return "human_approval"
    
    return "end"


def _route_from_approval(state: WorkflowGraphState) -> Literal[
    "generate_requirements", "generate_design", "generate_tasks",
    "generate_final_documents", "human_approval", "end"
]:
    """Route from human approval gate"""
    
    if is_workflow_failed(state) or state["status"] == WorkflowStatus.CANCELLED:
        return "end"
    
    # Check if we should generate final documents
    if should_generate_final_documents(state):
        return "generate_final_documents"
    
    # If still waiting for approval, end the workflow execution
    # The workflow will resume when user provides approval via API
    if should_wait_for_approval(state):
        logger.info(f"Workflow {state['workflow_id']} waiting for approval - ending execution until user input")
        return "end"
    
    # Check what phase to generate next based on approvals and current phase
    if state["status"] == WorkflowStatus.GENERATING_REQUIREMENTS:
        return "generate_requirements"
    
    if state["status"] == WorkflowStatus.GENERATING_DESIGN:
        return "generate_design"
    
    if state["status"] == WorkflowStatus.GENERATING_TASKS:
        return "generate_tasks"
    
    return "end"


def _route_from_final_documents(state: WorkflowGraphState) -> Literal["end", "generate_final_documents"]:
    """Route from final document generation"""
    
    if is_workflow_failed(state):
        # Check if we should retry
        if state["retry_count"] < 3:
            logger.info(f"Retrying final document generation for workflow {state['workflow_id']}")
            return "generate_final_documents"
    
    return "end"


class SpecWorkflowManager:
    """High-level manager for spec generation workflows"""
    
    def __init__(self):
        """Initialize the workflow manager"""
        self.workflow = create_spec_workflow()
        
        # Add memory for state persistence
        self.checkpointer = MemorySaver()
        # Compile workflow with checkpointer for state persistence
        self.compiled_workflow = self.workflow.compile(checkpointer=self.checkpointer)
        
        logger.info("Spec workflow manager initialized")
    
    async def start_workflow(
        self,
        workflow_id: str,
        feature_name: str,
        description: str,
        llm_provider: str = "openai",
        model_name: str = "gpt-4-turbo-preview",
        research_enabled: bool = True
    ) -> WorkflowGraphState:
        """
        Start a new spec generation workflow.
        
        Args:
            workflow_id: Unique workflow identifier
            feature_name: Name of the feature
            description: Feature description
            llm_provider: LLM provider to use
            model_name: Model name
            research_enabled: Enable web research
            
        Returns:
            Initial workflow state after first execution
        """
        
        # Create initial state
        state_manager = get_state_manager()
        initial_state = state_manager.create_workflow_state(
            workflow_id=workflow_id,
            feature_name=feature_name,
            description=description,
            llm_provider=llm_provider,
            model_name=model_name,
            research_enabled=research_enabled
        )
        
        # Start workflow execution
        config = {"configurable": {"thread_id": workflow_id}}
        
        try:
            # Execute one step of the workflow
            result = await self.compiled_workflow.ainvoke(initial_state, config)
            
            logger.info(f"Started workflow {workflow_id} for feature: {feature_name}")
            return result
            
        except Exception as e:
            logger.error(f"Error starting workflow {workflow_id}: {e}")
            
            # Update state with error
            state_manager.update_workflow_state(
                workflow_id,
                {
                    "status": WorkflowStatus.FAILED,
                    "last_error": str(e)
                }
            )
            raise
    
    async def continue_workflow(self, workflow_id: str) -> WorkflowGraphState:
        """
        Continue workflow execution (typically after user approval).
        
        Args:
            workflow_id: Workflow to continue
            
        Returns:
            Updated workflow state
        """
        
        state_manager = get_state_manager()
        current_state = state_manager.get_workflow_state(workflow_id)
        
        if not current_state:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        config = {"configurable": {"thread_id": workflow_id}}
        
        try:
            # Continue workflow execution
            result = await self.compiled_workflow.ainvoke(current_state, config)
            
            logger.info(f"Continued workflow {workflow_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error continuing workflow {workflow_id}: {e}")
            
            # Update state with error
            state_manager.update_workflow_state(
                workflow_id,
                {
                    "status": WorkflowStatus.FAILED,
                    "last_error": str(e)
                }
            )
            raise
    
    async def get_workflow_state(self, workflow_id: str) -> Optional[WorkflowGraphState]:
        """Get current workflow state"""
        state_manager = get_state_manager()
        return state_manager.get_workflow_state(workflow_id)
    
    def get_workflow_history(self, workflow_id: str) -> List[Dict[str, Any]]:
        """Get workflow execution history"""
        config = {"configurable": {"thread_id": workflow_id}}
        
        try:
            # Get state history from checkpointer
            history = []
            for state in self.compiled_workflow.get_state_history(config):
                history.append({
                    "timestamp": state.created_at,
                    "status": state.values.get("status"),
                    "phase": state.values.get("current_phase"),
                    "node": state.metadata.get("source", "unknown")
                })
            
            return history
            
        except Exception as e:
            logger.error(f"Error getting workflow history for {workflow_id}: {e}")
            return []


# Global workflow manager instance
_workflow_manager = None


def get_workflow_manager() -> SpecWorkflowManager:
    """Get the global workflow manager instance"""
    global _workflow_manager
    if _workflow_manager is None:
        _workflow_manager = SpecWorkflowManager()
    return _workflow_manager 