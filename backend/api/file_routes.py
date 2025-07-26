"""
File management API endpoints for Spec-Bot.
Handles file retrieval, previews, and document downloads.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import JSONResponse, PlainTextResponse

from models import GeneratedFilesResponse, LLMConfigRequest
from workflow_state import get_state_manager
from template_renderer import SpecRenderer
from config import settings

logger = logging.getLogger(__name__)

# Create router for file endpoints
router = APIRouter(prefix="/api/spec", tags=["files"])


@router.get("/files/{workflow_id}")
async def get_generated_files(workflow_id: str) -> GeneratedFilesResponse:
    """
    Get all generated files for a completed workflow.
    
    Args:
        workflow_id: Workflow identifier
        
    Returns:
        Generated specification files content
    """
    
    try:
        state_manager = get_state_manager()
        workflow_state = state_manager.get_workflow_state(workflow_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        # Check if workflow has generated files
        generated_files = workflow_state.get("generated_files", {})
        
        if not generated_files:
            # Try to generate files from current content if workflow is complete enough
            if (workflow_state.get("requirements_content") or 
                workflow_state.get("design_content") or 
                workflow_state.get("tasks_content")):
                
                logger.info(f"Generating files on demand for workflow {workflow_id}")
                
                try:
                    # Convert to SpecState and render documents
                    spec_state = state_manager.convert_to_spec_state(workflow_state)
                    renderer = SpecRenderer()
                    
                    generated_files = {}
                    
                    # Render available documents
                    if spec_state.requirements:
                        generated_files["requirements.md"] = renderer.render_requirements(spec_state)
                    
                    if spec_state.design:
                        generated_files["design.md"] = renderer.render_design(spec_state)
                    
                    if spec_state.tasks:
                        generated_files["tasks.md"] = renderer.render_tasks(spec_state)
                    
                    # Update workflow state with generated files
                    state_manager.update_workflow_state(workflow_id, {
                        "generated_files": generated_files
                    })
                    
                except Exception as e:
                    logger.error(f"Error generating files for workflow {workflow_id}: {e}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to generate files: {str(e)}"
                    )
            else:
                raise HTTPException(
                    status_code=404,
                    detail="No generated files available for this workflow"
                )
        
        response = GeneratedFilesResponse(
            workflow_id=workflow_id,
            feature_name=workflow_state["feature_name"],
            files=generated_files,
            generated_at=datetime.fromisoformat(workflow_state["updated_at"])
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting files for workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get generated files: {str(e)}"
        )


@router.get("/preview/{workflow_id}/{phase}")
async def get_phase_preview(
    workflow_id: str, 
    phase: str,
    format: str = "markdown"
) -> Response:
    """
    Get preview of a specific phase document.
    
    Args:
        workflow_id: Workflow identifier
        phase: Phase to preview (requirements, design, tasks)
        format: Response format (markdown, json)
        
    Returns:
        Phase document content in requested format
    """
    
    try:
        state_manager = get_state_manager()
        workflow_state = state_manager.get_workflow_state(workflow_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        # Validate phase
        valid_phases = ["requirements", "design", "tasks"]
        if phase not in valid_phases:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid phase. Must be one of: {', '.join(valid_phases)}"
            )
        
        # Get phase content
        content_field = f"{phase}_content"
        phase_content = workflow_state.get(content_field)
        
        if not phase_content:
            # Try to get from generated files
            generated_files = workflow_state.get("generated_files", {})
            file_name = f"{phase}.md"
            phase_content = generated_files.get(file_name)
            
            if not phase_content:
                raise HTTPException(
                    status_code=404,
                    detail=f"No content available for {phase} phase"
                )
        
        # Return in requested format
        if format.lower() == "json":
            return JSONResponse({
                "workflow_id": workflow_id,
                "phase": phase,
                "content": phase_content,
                "generated_at": workflow_state["updated_at"]
            })
        else:
            # Return as plain markdown
            return PlainTextResponse(
                phase_content,
                media_type="text/markdown",
                headers={
                    "Content-Disposition": f'inline; filename="{phase}.md"'
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting preview for {workflow_id}/{phase}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get phase preview: {str(e)}"
        )


@router.get("/download/{workflow_id}/{filename}")
async def download_file(workflow_id: str, filename: str) -> Response:
    """
    Download a specific generated file.
    
    Args:
        workflow_id: Workflow identifier
        filename: File to download (requirements.md, design.md, tasks.md)
        
    Returns:
        File content as download
    """
    
    try:
        state_manager = get_state_manager()
        workflow_state = state_manager.get_workflow_state(workflow_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        # Get generated files
        generated_files = workflow_state.get("generated_files", {})
        
        if filename not in generated_files:
            raise HTTPException(
                status_code=404,
                detail=f"File {filename} not found for workflow {workflow_id}"
            )
        
        file_content = generated_files[filename]
        
        # Determine media type
        if filename.endswith('.md'):
            media_type = "text/markdown"
        elif filename.endswith('.txt'):
            media_type = "text/plain"
        else:
            media_type = "application/octet-stream"
        
        return PlainTextResponse(
            file_content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file {filename} for workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download file: {str(e)}"
        )


@router.post("/settings")
async def update_settings(request: LLMConfigRequest) -> Dict[str, Any]:
    """
    Update LLM provider settings and configuration.
    
    Args:
        request: LLM configuration request
        
    Returns:
        Updated configuration status
    """
    
    try:
        logger.info(f"Updating LLM settings to {request.provider}/{request.model_name}")
        
        # Validate the provider and model
        if request.provider.value not in ["openai", "anthropic"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported LLM provider: {request.provider}"
            )
        
        # Check API key availability (without storing it server-side)
        api_keys = settings.validate_api_keys()
        
        if request.provider.value == "openai" and not api_keys["openai"]:
            if not request.api_key:
                raise HTTPException(
                    status_code=400,
                    detail="OpenAI API key required but not configured"
                )
        elif request.provider.value == "anthropic" and not api_keys["anthropic"]:
            if not request.api_key:
                raise HTTPException(
                    status_code=400,
                    detail="Anthropic API key required but not configured"
                )
        
        # Note: In this implementation, we don't store API keys server-side
        # They should be provided by the frontend for each request
        # This is a security best practice
        
        return {
            "provider": request.provider.value,
            "model_name": request.model_name,
            "message": "Settings validated successfully",
            "note": "API keys should be provided by client for security",
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update settings: {str(e)}"
        )


@router.get("/export/{workflow_id}")
async def export_workflow(workflow_id: str, format: str = "zip") -> Response:
    """
    Export all workflow files in a single package.
    
    Args:
        workflow_id: Workflow to export
        format: Export format (zip, tar)
        
    Returns:
        Compressed file containing all documents
    """
    
    try:
        state_manager = get_state_manager()
        workflow_state = state_manager.get_workflow_state(workflow_id)
        
        if not workflow_state:
            raise HTTPException(
                status_code=404,
                detail=f"Workflow {workflow_id} not found"
            )
        
        generated_files = workflow_state.get("generated_files", {})
        
        if not generated_files:
            raise HTTPException(
                status_code=404,
                detail="No files available for export"
            )
        
        if format != "zip":
            raise HTTPException(
                status_code=400,
                detail="Only ZIP format is currently supported"
            )
        
        # Create in-memory zip file
        import zipfile
        import io
        
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add each generated file to the zip
            for filename, content in generated_files.items():
                zip_file.writestr(filename, content.encode('utf-8'))
            
            # Add a metadata file
            metadata = {
                "workflow_id": workflow_id,
                "feature_name": workflow_state["feature_name"],
                "generated_at": workflow_state["updated_at"],
                "files": list(generated_files.keys())
            }
            
            import json
            zip_file.writestr(
                "metadata.json", 
                json.dumps(metadata, indent=2).encode('utf-8')
            )
        
        zip_buffer.seek(0)
        
        # Generate filename
        feature_name = workflow_state["feature_name"].replace(" ", "_").lower()
        export_filename = f"{feature_name}_spec_{workflow_id[:8]}.zip"
        
        return Response(
            zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{export_filename}"'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting workflow {workflow_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export workflow: {str(e)}"
        )


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for file services.
    
    Returns:
        Service health status
    """
    
    try:
        # Check if output directories exist and are writable
        output_dir = Path(settings.output_dir)
        backup_dir = Path(settings.backup_dir)
        
        status = {
            "service": "file-management",
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "directories": {
                "output_dir": {
                    "path": str(output_dir),
                    "exists": output_dir.exists(),
                    "writable": output_dir.exists() and os.access(output_dir, os.W_OK)
                },
                "backup_dir": {
                    "path": str(backup_dir),
                    "exists": backup_dir.exists(),
                    "writable": backup_dir.exists() and os.access(backup_dir, os.W_OK)
                }
            }
        }
        
        # Check template system
        try:
            from template_engine import get_template_engine
            engine = get_template_engine()
            templates = engine.list_templates()
            status["templates"] = {
                "available": len(templates),
                "templates": templates
            }
        except Exception as e:
            status["templates"] = {
                "error": str(e),
                "available": 0
            }
        
        return status
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "service": "file-management",
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        } 