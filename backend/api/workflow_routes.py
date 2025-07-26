"""
Workflow management API endpoints for Spec-Bot.
Handles workflow creation, status checking, approvals, and resets.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse

from models import (
    StartWorkflowRequest, 
    ApprovalRequest, 
    WorkflowStatusResponse,
    ErrorResponse,
    WorkflowPhase,
    ApprovalStatus,
    LLMProvider
)
from workflow_state import get_state_manager, WorkflowAction, WorkflowStatus
from workflow import get_workflow_manager
from config import settings

logger = logging.getLogger(__name__)

# Create router for workflow endpoints
router = APIRouter(prefix="/api/spec", tags=["workflow"])


@router.post("/start")
async def start_workflow(
    request: StartWorkflowRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Start a new specification generation workflow.
    
    Args:
        request: Workflow start request with feature details
        background_tasks: FastAPI background tasks for async processing
        
    Returns:
        Initial workflow status and ID
    """
    
    try:
        # Generate unique workflow ID
        workflow_id = str(uuid.uuid4())
        
        logger.info(f"Starting workflow {workflow_id} for feature: {request.feature_name}")
        
        # Validate LLM provider configuration
        api_keys = settings.validate_api_keys()
        if request.llm_provider == LLMProvider.OPENAI and not api_keys["openai"]:
            raise HTTPException(
                status_code=400,
                detail="OpenAI API key not configured"
            )
        elif request.llm_provider == LLMProvider.ANTHROPIC and not api_keys["anthropic"]:
            raise HTTPException(
                status_code=400,
                detail="Anthropic API key not configured"
            )
        
        # Start workflow in background
        workflow_manager = get_workflow_manager()
        
        async def run_workflow():
            """Background task to run the workflow"""
            try:
                await workflow_manager.start_workflow(
                    workflow_id=workflow_id,
                    feature_name=request.feature_name,
                    description=request.description,
                    llm_provider=request.llm_provider.value,
                    model_name=request.model_name,
                    research_enabled=request.enable_research
                )
                logger.info(f"Workflow {workflow_id} started successfully")
                
            except Exception as e:
                logger.error(f"Error in background workflow {workflow_id}: {e}")
        
        # Add to background tasks
        background_tasks.add_task(run_workflow)
        
        # Return immediate response
        return {
            "workflow_id": workflow_id,
            "status": "initializing",
            "message": "Workflow started successfully",
            "feature_name": request.feature_name,
            "created_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting workflow: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start workflow: {str(e)}"
        )


@router.get("/status/{workflow_id}")
async def get_workflow_status(workflow_id: str) -> WorkflowStatusResponse:
    """
    Get the current status of a workflow.
    
    Args:
        workflow_id: Unique workflow identifier
        
    Returns:
        Current workflow status and progress information
    """
    
    try:
        state_manager = get_state_manager()
        workflow_state = state_manager.get_workflow_state(workflow_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        # Get current phase content and status
        current_phase_content = None
        current_phase_status = None
        
        if workflow_state["current_phase"] == WorkflowPhase.REQUIREMENTS:
            current_phase_content = workflow_state.get("requirements_content")
            current_phase_status = (
                ApprovalStatus.APPROVED if workflow_state["requirements_approved"]
                else ApprovalStatus.PENDING
            )
        elif workflow_state["current_phase"] == WorkflowPhase.DESIGN:
            current_phase_content = workflow_state.get("design_content")
            current_phase_status = (
                ApprovalStatus.APPROVED if workflow_state["design_approved"]
                else ApprovalStatus.PENDING
            )
        elif workflow_state["current_phase"] == WorkflowPhase.TASKS:
            current_phase_content = workflow_state.get("tasks_content")
            current_phase_status = (
                ApprovalStatus.APPROVED if workflow_state["tasks_approved"]
                else ApprovalStatus.PENDING
            )
        
        # Get recent messages (last 5)
        recent_messages = workflow_state["conversation_history"][-5:] if workflow_state["conversation_history"] else []
        
        # Convert to response format
        from models import ChatMessage
        recent_chat_messages = []
        for msg in recent_messages:
            chat_msg = ChatMessage(
                role=msg["role"],
                content=msg["content"],
                timestamp=datetime.fromisoformat(msg["timestamp"]),
                metadata=msg.get("metadata", {})
            )
            recent_chat_messages.append(chat_msg)
        
        response = WorkflowStatusResponse(
            workflow_id=workflow_id,
            feature_name=workflow_state["feature_name"],
            current_phase=workflow_state["current_phase"],
            is_active=workflow_state["status"] not in [
                WorkflowStatus.COMPLETED, 
                WorkflowStatus.FAILED, 
                WorkflowStatus.CANCELLED
            ],
            created_at=datetime.fromisoformat(workflow_state["created_at"]),
            updated_at=datetime.fromisoformat(workflow_state["updated_at"]),
            requirements_completed=bool(workflow_state["requirements_content"]),
            design_completed=bool(workflow_state["design_content"]),
            tasks_completed=bool(workflow_state["tasks_content"]),
            current_phase_content=current_phase_content,
            current_phase_status=current_phase_status,
            recent_messages=recent_chat_messages
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow status for {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get workflow status: {str(e)}"
        )


@router.post("/approve")
async def handle_approval(
    request: ApprovalRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Handle user approval, rejection, or revision request for a workflow phase.
    
    Args:
        request: Approval request with action and feedback
        background_tasks: FastAPI background tasks for async processing
        
    Returns:
        Updated workflow status
    """
    
    try:
        state_manager = get_state_manager()
        workflow_state = state_manager.get_workflow_state(request.workflow_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {request.workflow_id} not found"
            )
        
        # Validate that there's a pending approval
        if not workflow_state.get("pending_approval"):
            raise HTTPException(
                status_code=400,
                detail="No pending approval for this workflow"
            )
        
        logger.info(f"Handling {request.action} for workflow {request.workflow_id}")
        
        # Convert action to WorkflowAction
        action_mapping = {
            "approve": WorkflowAction.APPROVE,
            "reject": WorkflowAction.REJECT,
            "revise": WorkflowAction.REQUEST_REVISION
        }
        
        workflow_action = action_mapping.get(request.action)
        if not workflow_action:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action: {request.action}"
            )
        
        # Handle the approval
        updated_state = state_manager.handle_user_approval(
            request.workflow_id,
            workflow_action,
            request.feedback
        )
        
        # If approved and moving to next phase, continue workflow in background
        if request.action == "approve" or request.action == "revise":
            async def continue_workflow():
                """Background task to continue the workflow"""
                try:
                    workflow_manager = get_workflow_manager()
                    await workflow_manager.continue_workflow(request.workflow_id)
                    logger.info(f"Continued workflow {request.workflow_id} after {request.action}")
                    
                except Exception as e:
                    logger.error(f"Error continuing workflow {request.workflow_id}: {e}")
            
            background_tasks.add_task(continue_workflow)
        
        return {
            "workflow_id": request.workflow_id,
            "action": request.action,
            "status": updated_state["status"],
            "current_phase": updated_state["current_phase"],
            "message": f"Workflow {request.action} processed successfully",
            "updated_at": updated_state["updated_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling approval for workflow {request.workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process approval: {str(e)}"
        )


@router.post("/reset/{workflow_id}")
async def reset_workflow(workflow_id: str) -> Dict[str, Any]:
    """
    Reset a workflow to start over.
    
    Args:
        workflow_id: Workflow to reset
        
    Returns:
        Reset confirmation
    """
    
    try:
        state_manager = get_state_manager()
        workflow_state = state_manager.get_workflow_state(workflow_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        logger.info(f"Resetting workflow {workflow_id}")
        
        # Reset workflow to initial state
        reset_updates = {
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
            "retry_count": 0,
            "last_error": None,
            "generated_files": {}
        }
        
        updated_state = state_manager.update_workflow_state(workflow_id, reset_updates)
        
        return {
            "workflow_id": workflow_id,
            "message": "Workflow reset successfully",
            "status": updated_state["status"],
            "current_phase": updated_state["current_phase"],
            "reset_at": updated_state["updated_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset workflow: {str(e)}"
        )


@router.get("/list")
async def list_workflows() -> Dict[str, Any]:
    """
    List all active workflows.
    
    Returns:
        List of active workflow summaries
    """
    
    try:
        state_manager = get_state_manager()
        workflow_ids = state_manager.list_active_workflows()
        
        workflows = []
        for workflow_id in workflow_ids:
            workflow_state = state_manager.get_workflow_state(workflow_id)
            if workflow_state:
                workflows.append({
                    "workflow_id": workflow_id,
                    "feature_name": workflow_state["feature_name"],
                    "status": workflow_state["status"],
                    "current_phase": workflow_state["current_phase"],
                    "created_at": workflow_state["created_at"],
                    "updated_at": workflow_state["updated_at"]
                })
        
        return {
            "workflows": workflows,
            "total_count": len(workflows)
        }
        
    except Exception as e:
        logger.error(f"Error listing workflows: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list workflows: {str(e)}"
        )


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str) -> Dict[str, Any]:
    """
    Delete a workflow and clean up resources.
    
    Args:
        workflow_id: Workflow to delete
        
    Returns:
        Deletion confirmation
    """
    
    try:
        state_manager = get_state_manager()
        
        if not state_manager.get_workflow_state(workflow_id):
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        logger.info(f"Deleting workflow {workflow_id}")
        
        # Clean up workflow
        success = state_manager.cleanup_workflow(workflow_id)
        
        if success:
            return {
                "workflow_id": workflow_id,
                "message": "Workflow deleted successfully",
                "deleted_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete workflow"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete workflow: {str(e)}"
        ) 