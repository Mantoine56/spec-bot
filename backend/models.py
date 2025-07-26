"""
Core data models for Spec-Bot workflow state management and API communication.
Uses Pydantic for data validation and serialization.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum
import uuid


class WorkflowPhase(str, Enum):
    """Enumeration of workflow phases"""
    REQUIREMENTS = "requirements"
    DESIGN = "design" 
    TASKS = "tasks"
    COMPLETED = "completed"


class ApprovalStatus(str, Enum):
    """Enumeration of approval statuses"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"


class LLMProvider(str, Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class ChatMessage(BaseModel):
    """Individual chat message in the conversation"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: Literal["user", "assistant", "system"] = Field(...)
    content: str = Field(...)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class PhaseResult(BaseModel):
    """Result data for a completed workflow phase"""
    phase: WorkflowPhase = Field(...)
    content: str = Field(...)  # Generated markdown content
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    approval_status: ApprovalStatus = Field(default=ApprovalStatus.PENDING)
    feedback: Optional[str] = Field(None)
    revision_count: int = Field(default=0)


class ResearchResult(BaseModel):
    """Research findings from web search"""
    query: str = Field(...)
    results: List[Dict[str, Any]] = Field(default_factory=list)
    summary: Optional[str] = Field(None)
    sources: List[str] = Field(default_factory=list)
    conducted_at: datetime = Field(default_factory=datetime.utcnow)


class SpecState(BaseModel):
    """Complete workflow state for spec generation"""
    
    # Workflow identification
    workflow_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    feature_name: str = Field(...)
    initial_description: str = Field(...)
    
    # Current workflow status
    current_phase: WorkflowPhase = Field(default=WorkflowPhase.REQUIREMENTS)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Phase results
    requirements: Optional[PhaseResult] = Field(None)
    design: Optional[PhaseResult] = Field(None) 
    tasks: Optional[PhaseResult] = Field(None)
    
    # Conversation history
    conversation_history: List[ChatMessage] = Field(default_factory=list)
    
    # Research data
    research_results: List[ResearchResult] = Field(default_factory=list)
    
    # Configuration
    llm_provider: LLMProvider = Field(default=LLMProvider.OPENAI)
    model_name: str = Field(default="gpt-4-turbo-preview")
    enable_research: bool = Field(default=True)
    
    # Error tracking
    errors: List[str] = Field(default_factory=list)
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict] = None) -> None:
        """Add a message to the conversation history"""
        message = ChatMessage(
            role=role,
            content=content,
            metadata=metadata or {}
        )
        self.conversation_history.append(message)
        self.updated_at = datetime.utcnow()
    
    def set_phase_result(self, phase: WorkflowPhase, content: str) -> None:
        """Set the result for a specific phase"""
        result = PhaseResult(phase=phase, content=content)
        
        if phase == WorkflowPhase.REQUIREMENTS:
            self.requirements = result
        elif phase == WorkflowPhase.DESIGN:
            self.design = result
        elif phase == WorkflowPhase.TASKS:
            self.tasks = result
            
        self.updated_at = datetime.utcnow()
    
    def get_current_phase_result(self) -> Optional[PhaseResult]:
        """Get the result for the current phase"""
        if self.current_phase == WorkflowPhase.REQUIREMENTS:
            return self.requirements
        elif self.current_phase == WorkflowPhase.DESIGN:
            return self.design
        elif self.current_phase == WorkflowPhase.TASKS:
            return self.tasks
        return None
    
    def advance_phase(self) -> None:
        """Advance to the next workflow phase"""
        if self.current_phase == WorkflowPhase.REQUIREMENTS:
            self.current_phase = WorkflowPhase.DESIGN
        elif self.current_phase == WorkflowPhase.DESIGN:
            self.current_phase = WorkflowPhase.TASKS
        elif self.current_phase == WorkflowPhase.TASKS:
            self.current_phase = WorkflowPhase.COMPLETED
            self.is_active = False
        
        self.updated_at = datetime.utcnow()


# API Request/Response Models

class StartWorkflowRequest(BaseModel):
    """Request to start a new spec generation workflow"""
    feature_name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=10, max_length=2000)
    llm_provider: Optional[LLMProvider] = Field(default=LLMProvider.OPENAI)
    model_name: Optional[str] = Field(default="gpt-4-turbo-preview")
    enable_research: Optional[bool] = Field(default=True)


class ApprovalRequest(BaseModel):
    """Request to approve or request revision for a phase"""
    workflow_id: str = Field(...)
    action: Literal["approve", "reject", "revise"] = Field(...)
    feedback: Optional[str] = Field(None)


class WorkflowStatusResponse(BaseModel):
    """Response containing current workflow status"""
    workflow_id: str = Field(...)
    feature_name: str = Field(...)
    current_phase: WorkflowPhase = Field(...)
    is_active: bool = Field(...)
    created_at: datetime = Field(...)
    updated_at: datetime = Field(...)
    
    # Phase completion status
    requirements_completed: bool = Field(...)
    design_completed: bool = Field(...)
    tasks_completed: bool = Field(...)
    
    # Current phase data
    current_phase_content: Optional[str] = Field(None)
    current_phase_status: Optional[ApprovalStatus] = Field(None)
    
    # Recent messages (last 5)
    recent_messages: List[ChatMessage] = Field(default_factory=list)


class GeneratedFilesResponse(BaseModel):
    """Response containing generated specification files"""
    workflow_id: str = Field(...)
    feature_name: str = Field(...)
    files: Dict[str, str] = Field(...)  # filename -> content mapping
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class LLMConfigRequest(BaseModel):
    """Request to update LLM configuration"""
    provider: LLMProvider = Field(...)
    model_name: str = Field(...)
    api_key: Optional[str] = Field(None)  # For frontend configuration


class ErrorResponse(BaseModel):
    """Standard error response format"""
    error: str = Field(...)
    message: str = Field(...)
    details: Optional[Dict[str, Any]] = Field(None)
    timestamp: datetime = Field(default_factory=datetime.utcnow) 