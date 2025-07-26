"""
Workflow state management for Spec-Bot LangGraph workflow.
Handles state transitions, phase tracking, and persistence across workflow execution.
"""

import logging
from typing import Dict, Any, Optional, List, TypedDict, Annotated
from datetime import datetime
from enum import Enum

from models import SpecState, WorkflowPhase, ApprovalStatus, ChatMessage, PhaseResult
from llm_client import LLMMessage

logger = logging.getLogger(__name__)


class WorkflowStatus(str, Enum):
    """Overall workflow execution status"""
    INITIALIZING = "initializing"
    GENERATING_REQUIREMENTS = "generating_requirements"
    AWAITING_REQUIREMENTS_APPROVAL = "awaiting_requirements_approval"
    GENERATING_DESIGN = "generating_design"
    AWAITING_DESIGN_APPROVAL = "awaiting_design_approval"
    GENERATING_TASKS = "generating_tasks"
    AWAITING_TASKS_APPROVAL = "awaiting_tasks_approval"
    GENERATING_FINAL_DOCUMENTS = "generating_final_documents"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkflowAction(str, Enum):
    """Actions that can be taken during workflow execution"""
    START_GENERATION = "start_generation"
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_REVISION = "request_revision"
    CANCEL = "cancel"
    RETRY = "retry"


class WorkflowGraphState(TypedDict):
    """
    State structure for LangGraph workflow execution.
    This represents the complete state that flows through the workflow nodes.
    """
    
    # Core workflow identification
    workflow_id: str
    feature_name: str
    initial_description: str
    
    # Current execution state
    status: WorkflowStatus
    current_phase: WorkflowPhase
    
    # Phase generation state
    requirements_content: Optional[str]
    design_content: Optional[str]
    tasks_content: Optional[str]
    
    # Approval state
    requirements_approved: bool
    design_approved: bool
    tasks_approved: bool
    
    # User interaction
    pending_approval: Optional[str]  # Which phase is pending approval
    user_feedback: Optional[str]
    last_user_action: Optional[WorkflowAction]
    
    # LLM context and history
    conversation_history: List[Dict[str, Any]]
    llm_provider: str
    model_name: str
    
    # Research and context
    research_enabled: bool
    research_results: Optional[List[Dict[str, Any]]]
    
    # Error handling
    retry_count: int
    last_error: Optional[str]
    
    # Timestamps
    created_at: str
    updated_at: str
    
    # Generated files tracking
    generated_files: Dict[str, str]
    written_file_paths: Optional[Dict[str, str]]  # Actual file paths written to disk


class WorkflowStateManager:
    """Manages workflow state transitions and persistence"""
    
    def __init__(self):
        """Initialize the state manager"""
        self._active_workflows: Dict[str, WorkflowGraphState] = {}
        logger.info("Workflow state manager initialized")
    
    def create_workflow_state(
        self,
        workflow_id: str,
        feature_name: str,
        description: str,
        llm_provider: str = "openai",
        model_name: str = "gpt-4-turbo-preview",
        research_enabled: bool = True
    ) -> WorkflowGraphState:
        """
        Create initial workflow state for a new spec generation.
        
        Args:
            workflow_id: Unique identifier for the workflow
            feature_name: Name of the feature being spec'd
            description: Initial feature description
            llm_provider: LLM provider to use
            model_name: Model name to use
            research_enabled: Whether to enable web research
            
        Returns:
            Initial workflow state
        """
        
        now = datetime.utcnow().isoformat()
        
        initial_state: WorkflowGraphState = {
            "workflow_id": workflow_id,
            "feature_name": feature_name,
            "initial_description": description,
            "status": WorkflowStatus.INITIALIZING,
            "current_phase": WorkflowPhase.REQUIREMENTS,
            "requirements_content": None,
            "design_content": None,
            "tasks_content": None,
            "requirements_approved": False,
            "design_approved": False,
            "tasks_approved": False,
            "pending_approval": None,
            "user_feedback": None,
            "last_user_action": None,
            "conversation_history": [],
            "llm_provider": llm_provider,
            "model_name": model_name,
            "research_enabled": research_enabled,
            "research_results": None,
            "retry_count": 0,
            "last_error": None,
            "created_at": now,
            "updated_at": now,
            "generated_files": {}
        }
        
        # Store in memory (in production, this would be persisted to database)
        self._active_workflows[workflow_id] = initial_state
        
        logger.info(f"Created workflow state for {feature_name} (ID: {workflow_id})")
        return initial_state
    
    def get_workflow_state(self, workflow_id: str) -> Optional[WorkflowGraphState]:
        """Get workflow state by ID"""
        return self._active_workflows.get(workflow_id)
    
    def update_workflow_state(
        self,
        workflow_id: str,
        updates: Dict[str, Any]
    ) -> WorkflowGraphState:
        """
        Update workflow state with new values.
        
        Args:
            workflow_id: Workflow identifier
            updates: Dictionary of field updates
            
        Returns:
            Updated workflow state
            
        Raises:
            ValueError: If workflow not found
        """
        
        if workflow_id not in self._active_workflows:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        state = self._active_workflows[workflow_id]
        
        # Update fields
        for key, value in updates.items():
            if key in state:
                state[key] = value
        
        # Update timestamp
        state["updated_at"] = datetime.utcnow().isoformat()
        
        logger.debug(f"Updated workflow {workflow_id} with {len(updates)} changes")
        return state
    
    def transition_to_phase(
        self,
        workflow_id: str,
        phase: WorkflowPhase,
        status: WorkflowStatus
    ) -> WorkflowGraphState:
        """
        Transition workflow to a new phase.
        
        Args:
            workflow_id: Workflow identifier
            phase: New workflow phase
            status: New workflow status
            
        Returns:
            Updated workflow state
        """
        
        updates = {
            "current_phase": phase,
            "status": status,
            "pending_approval": None,
            "user_feedback": None,
            "last_user_action": None,
            "retry_count": 0,
            "last_error": None
        }
        
        state = self.update_workflow_state(workflow_id, updates)
        
        logger.info(f"Transitioned workflow {workflow_id} to {phase.value} ({status.value})")
        return state
    
    def set_pending_approval(
        self,
        workflow_id: str,
        phase: str,
        content: str
    ) -> WorkflowGraphState:
        """
        Set workflow to awaiting approval state.
        
        Args:
            workflow_id: Workflow identifier
            phase: Phase awaiting approval
            content: Generated content for approval
            
        Returns:
            Updated workflow state
        """
        
        # Determine the appropriate status and content field
        status_map = {
            "requirements": WorkflowStatus.AWAITING_REQUIREMENTS_APPROVAL,
            "design": WorkflowStatus.AWAITING_DESIGN_APPROVAL,
            "tasks": WorkflowStatus.AWAITING_TASKS_APPROVAL
        }
        
        content_field = f"{phase}_content"
        
        updates = {
            "status": status_map[phase],
            "pending_approval": phase,
            content_field: content
        }
        
        state = self.update_workflow_state(workflow_id, updates)
        
        logger.info(f"Workflow {workflow_id} awaiting approval for {phase}")
        return state
    
    def handle_user_approval(
        self,
        workflow_id: str,
        action: WorkflowAction,
        feedback: Optional[str] = None
    ) -> WorkflowGraphState:
        """
        Handle user approval/rejection/revision request.
        
        Args:
            workflow_id: Workflow identifier
            action: User action (approve, reject, request_revision)
            feedback: Optional feedback from user
            
        Returns:
            Updated workflow state
        """
        
        state = self.get_workflow_state(workflow_id)
        if not state:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        pending_phase = state["pending_approval"]
        if not pending_phase:
            raise ValueError(f"No pending approval for workflow {workflow_id}")
        
        updates = {
            "last_user_action": action,
            "user_feedback": feedback,
            "pending_approval": None
        }
        
        if action == WorkflowAction.APPROVE:
            # Mark phase as approved
            approval_field = f"{pending_phase}_approved"
            updates[approval_field] = True
            
            # Determine next phase or completion
            if pending_phase == "requirements":
                updates["status"] = WorkflowStatus.GENERATING_DESIGN
                updates["current_phase"] = WorkflowPhase.DESIGN
            elif pending_phase == "design":
                updates["status"] = WorkflowStatus.GENERATING_TASKS
                updates["current_phase"] = WorkflowPhase.TASKS
            elif pending_phase == "tasks":
                # Don't mark as completed yet - final documents need to be generated
                updates["status"] = WorkflowStatus.GENERATING_FINAL_DOCUMENTS
                updates["current_phase"] = WorkflowPhase.COMPLETED
            
        elif action == WorkflowAction.REQUEST_REVISION:
            # Reset to generation phase with feedback
            if pending_phase == "requirements":
                updates["status"] = WorkflowStatus.GENERATING_REQUIREMENTS
            elif pending_phase == "design":
                updates["status"] = WorkflowStatus.GENERATING_DESIGN
            elif pending_phase == "tasks":
                updates["status"] = WorkflowStatus.GENERATING_TASKS
        
        elif action == WorkflowAction.REJECT:
            # For now, treat rejection as cancellation
            updates["status"] = WorkflowStatus.CANCELLED
        
        state = self.update_workflow_state(workflow_id, updates)
        
        logger.info(f"Handled user {action.value} for {pending_phase} in workflow {workflow_id}")
        return state
    
    def add_conversation_message(
        self,
        workflow_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> WorkflowGraphState:
        """
        Add a message to the conversation history.
        
        Args:
            workflow_id: Workflow identifier
            role: Message role (user, assistant, system)
            content: Message content
            metadata: Optional message metadata
            
        Returns:
            Updated workflow state
        """
        
        state = self.get_workflow_state(workflow_id)
        if not state:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        
        conversation_history = state["conversation_history"].copy()
        conversation_history.append(message)
        
        state = self.update_workflow_state(workflow_id, {
            "conversation_history": conversation_history
        })
        
        logger.debug(f"Added {role} message to workflow {workflow_id}")
        return state
    
    def convert_to_spec_state(self, workflow_state: WorkflowGraphState) -> SpecState:
        """
        Convert WorkflowGraphState to SpecState model.
        
        Args:
            workflow_state: LangGraph workflow state
            
        Returns:
            SpecState model instance
        """
        
        # Convert conversation history
        conversation_history = []
        for msg in workflow_state["conversation_history"]:
            chat_msg = ChatMessage(
                role=msg["role"],
                content=msg["content"],
                timestamp=datetime.fromisoformat(msg["timestamp"]),
                metadata=msg.get("metadata", {})
            )
            conversation_history.append(chat_msg)
        
        # Create phase results if content exists
        requirements = None
        if workflow_state["requirements_content"]:
            requirements = PhaseResult(
                phase=WorkflowPhase.REQUIREMENTS,
                content=workflow_state["requirements_content"],
                approval_status=ApprovalStatus.APPROVED if workflow_state["requirements_approved"] else ApprovalStatus.PENDING
            )
        
        design = None
        if workflow_state["design_content"]:
            design = PhaseResult(
                phase=WorkflowPhase.DESIGN,
                content=workflow_state["design_content"],
                approval_status=ApprovalStatus.APPROVED if workflow_state["design_approved"] else ApprovalStatus.PENDING
            )
        
        tasks = None
        if workflow_state["tasks_content"]:
            tasks = PhaseResult(
                phase=WorkflowPhase.TASKS,
                content=workflow_state["tasks_content"],
                approval_status=ApprovalStatus.APPROVED if workflow_state["tasks_approved"] else ApprovalStatus.PENDING
            )
        
        # Create SpecState
        spec_state = SpecState(
            workflow_id=workflow_state["workflow_id"],
            feature_name=workflow_state["feature_name"],
            initial_description=workflow_state["initial_description"],
            current_phase=workflow_state["current_phase"],
            is_active=workflow_state["status"] not in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED],
            created_at=datetime.fromisoformat(workflow_state["created_at"]),
            updated_at=datetime.fromisoformat(workflow_state["updated_at"]),
            requirements=requirements,
            design=design,
            tasks=tasks,
            conversation_history=conversation_history,
            llm_provider=workflow_state["llm_provider"],
            model_name=workflow_state["model_name"],
            enable_research=workflow_state["research_enabled"]
        )
        
        return spec_state
    
    def list_active_workflows(self) -> List[str]:
        """Get list of active workflow IDs"""
        return list(self._active_workflows.keys())
    
    def cleanup_workflow(self, workflow_id: str) -> bool:
        """
        Remove workflow from active state.
        
        Args:
            workflow_id: Workflow to cleanup
            
        Returns:
            True if workflow was removed, False if not found
        """
        
        if workflow_id in self._active_workflows:
            del self._active_workflows[workflow_id]
            logger.info(f"Cleaned up workflow {workflow_id}")
            return True
        
        return False


# Global state manager instance
_state_manager = None


def get_state_manager() -> WorkflowStateManager:
    """Get the global workflow state manager instance"""
    global _state_manager
    if _state_manager is None:
        _state_manager = WorkflowStateManager()
    return _state_manager 