"""
Template renderer for Spec-Bot specification documents.
Provides high-level rendering functions and data preparation utilities.
"""

import logging
import re
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from datetime import datetime

from template_engine import get_template_engine, TemplateEngine
from models import SpecState, WorkflowPhase

logger = logging.getLogger(__name__)


class SpecRenderer:
    """High-level renderer for specification documents"""
    
    def __init__(self, template_engine: Optional[TemplateEngine] = None):
        """Initialize renderer with optional custom template engine"""
        self.engine = template_engine or get_template_engine()
    
    def render_requirements(self, spec_state: SpecState, **kwargs) -> str:
        """
        Render requirements.md document from spec state.
        
        Args:
            spec_state: Current workflow state
            **kwargs: Additional template context
            
        Returns:
            Rendered requirements document
        """
        
        context = self._prepare_requirements_context(spec_state)
        context.update(kwargs)
        
        return self.engine.render_template("requirements.md", context)
    
    def render_design(self, spec_state: SpecState, **kwargs) -> str:
        """
        Render design.md document from spec state.
        
        Args:
            spec_state: Current workflow state
            **kwargs: Additional template context
            
        Returns:
            Rendered design document
        """
        
        context = self._prepare_design_context(spec_state)
        context.update(kwargs)
        
        return self.engine.render_template("design.md", context)
    
    def render_tasks(self, spec_state: SpecState, **kwargs) -> str:
        """
        Render tasks.md document from spec state.
        
        Args:
            spec_state: Current workflow state
            **kwargs: Additional template context
            
        Returns:
            Rendered tasks document
        """
        
        context = self._prepare_tasks_context(spec_state)
        context.update(kwargs)
        
        return self.engine.render_template("tasks.md", context)
    
    def render_all_documents(self, spec_state: SpecState, **kwargs) -> Dict[str, str]:
        """
        Render all specification documents.
        
        Args:
            spec_state: Current workflow state
            **kwargs: Additional template context
            
        Returns:
            Dictionary with document names as keys and rendered content as values
        """
        
        documents = {}
        
        try:
            if spec_state.requirements:
                documents["requirements.md"] = self.render_requirements(spec_state, **kwargs)
            
            if spec_state.design:
                documents["design.md"] = self.render_design(spec_state, **kwargs)
                
            if spec_state.tasks:
                documents["tasks.md"] = self.render_tasks(spec_state, **kwargs)
                
        except Exception as e:
            logger.error(f"Error rendering documents: {e}")
            raise
        
        return documents
    
    def _prepare_requirements_context(self, spec_state: SpecState) -> Dict[str, Any]:
        """Prepare context data for requirements template"""
        
        context = {
            "feature_name": spec_state.feature_name,
            "feature_description": spec_state.initial_description,
        }
        
        # If we have requirements content, try to extract structured data
        if spec_state.requirements and spec_state.requirements.content:
            structured_data = self._extract_requirements_data(spec_state.requirements.content)
            context.update(structured_data)
        else:
            # Provide default structure
            context.update({
                "requirements": [
                    {
                        "user_story": f"As a user, I want to use {spec_state.feature_name}, so that I can achieve my goals effectively.",
                        "acceptance_criteria": [
                            "The feature SHALL be implemented according to specifications",
                            "The feature SHALL be tested and validated",
                            "The feature SHALL meet performance requirements"
                        ]
                    }
                ]
            })
        
        return context
    
    def _prepare_design_context(self, spec_state: SpecState) -> Dict[str, Any]:
        """Prepare context data for design template"""
        
        context = {
            "feature_name": spec_state.feature_name,
            "design_overview": f"Technical design for {spec_state.feature_name} implementation."
        }
        
        # If we have design content, try to extract structured data
        if spec_state.design and spec_state.design.content:
            structured_data = self._extract_design_data(spec_state.design.content)
            context.update(structured_data)
        
        # Include requirements context for reference
        if spec_state.requirements:
            context["requirements_reference"] = spec_state.requirements.content
        
        return context
    
    def _prepare_tasks_context(self, spec_state: SpecState) -> Dict[str, Any]:
        """Prepare context data for tasks template"""
        
        context = {
            "feature_name": spec_state.feature_name,
            "project_overview": f"Implementation plan for {spec_state.feature_name}."
        }
        
        # If we have tasks content, try to extract structured data
        if spec_state.tasks and spec_state.tasks.content:
            structured_data = self._extract_tasks_data(spec_state.tasks.content)
            context.update(structured_data)
        else:
            # Provide default phase structure
            context.update({
                "phases": [
                    {
                        "name": "Phase 1: Foundation",
                        "status": "pending",
                        "description": "Set up core infrastructure and base functionality.",
                        "tasks": [
                            {
                                "id": 1,
                                "title": "Project Setup",
                                "description": "Initialize project structure and dependencies",
                                "status": "pending",
                                "requirements": ["R1"],
                                "components": ["setup.py", "requirements.txt"],
                                "estimated_time": "4 hours"
                            }
                        ]
                    }
                ]
            })
        
        return context
    
    def _extract_requirements_data(self, content: str) -> Dict[str, Any]:
        """Extract structured data from requirements content"""
        data = {"requirements": []}
        
        # Extract requirements using the new structured format
        requirement_pattern = r"### Requirement \d+\s*(.*?)(?=### Requirement|\Z)"
        requirement_blocks = re.findall(requirement_pattern, content, re.DOTALL)
        
        for block in requirement_blocks:
            requirement = {}
            
            # Extract user story
            user_story_match = re.search(r"\*\*User Story:\*\*\s*(.*?)(?=\n\*\*|\Z)", block, re.DOTALL)
            if user_story_match:
                requirement["user_story"] = user_story_match.group(1).strip()
            
            # Extract acceptance criteria
            acceptance_criteria = []
            criteria_match = re.search(r"\*\*Acceptance Criteria:\*\*\s*(.*?)(?=\n\*\*|\Z)", block, re.DOTALL)
            if criteria_match:
                criteria_text = criteria_match.group(1).strip()
                # Find bullet points (starting with - or *)
                criteria_items = re.findall(r"^[-*]\s*(.+)$", criteria_text, re.MULTILINE)
                acceptance_criteria = [item.strip() for item in criteria_items]
            
            if acceptance_criteria:
                requirement["acceptance_criteria"] = acceptance_criteria
            
            # Extract business rules (optional)
            business_rules = []
            rules_match = re.search(r"\*\*Business Rules:\*\*\s*(.*?)(?=\n\*\*|\Z)", block, re.DOTALL)
            if rules_match:
                rules_text = rules_match.group(1).strip()
                rule_items = re.findall(r"^[-*]\s*(.+)$", rules_text, re.MULTILINE)
                business_rules = [item.strip() for item in rule_items]
                requirement["business_rules"] = business_rules
            
            # Extract dependencies (optional)
            dependencies = []
            deps_match = re.search(r"\*\*Dependencies:\*\*\s*(.*?)(?=\n\*\*|\Z)", block, re.DOTALL)
            if deps_match:
                deps_text = deps_match.group(1).strip()
                dep_items = re.findall(r"^[-*]\s*(.+)$", deps_text, re.MULTILINE)
                dependencies = [item.strip() for item in dep_items]
                requirement["dependencies"] = dependencies
            
            # Extract assumptions (optional)
            assumptions = []
            assumptions_match = re.search(r"\*\*Assumptions:\*\*\s*(.*?)(?=\n\*\*|\Z)", block, re.DOTALL)
            if assumptions_match:
                assumptions_text = assumptions_match.group(1).strip()
                assumption_items = re.findall(r"^[-*]\s*(.+)$", assumptions_text, re.MULTILINE)
                assumptions = [item.strip() for item in assumption_items]
                requirement["assumptions"] = assumptions
            
            # Only add if we found user story and acceptance criteria
            if requirement.get("user_story") and requirement.get("acceptance_criteria"):
                data["requirements"].append(requirement)
        
        # Fallback if no structured data found
        if not data["requirements"]:
            data["requirements"] = [
                {
                    "user_story": "Requirements extracted from generated content",
                    "acceptance_criteria": ["Content will be parsed and structured properly"]
                }
            ]
        
        return data
    
    def _extract_design_data(self, content: str) -> Dict[str, Any]:
        """Extract structured data from design content"""
        data = {}
        
        # Extract overview section
        overview_match = re.search(r"## Overview\s*(.*?)(?=##|$)", content, re.DOTALL)
        if overview_match:
            data["design_overview"] = overview_match.group(1).strip()
        
        # Extract architecture information
        arch_match = re.search(r"## Architecture\s*(.*?)(?=##|$)", content, re.DOTALL)
        if arch_match:
            data["system_architecture"] = arch_match.group(1).strip()
        
        # Extract data model architecture specifically
        data_model_match = re.search(r"### Data Model Architecture\s*(.*?)(?=###|##|$)", content, re.DOTALL)
        if data_model_match:
            data["data_model"] = data_model_match.group(1).strip()
        
        # Extract database schema enhancements
        schema_match = re.search(r"### Database Schema Enhancements\s*(.*?)(?=###|##|$)", content, re.DOTALL)
        if schema_match:
            data["database_schema"] = schema_match.group(1).strip()
        
        # Extract components and interfaces
        components_match = re.search(r"## Components and Interfaces\s*(.*?)(?=##|$)", content, re.DOTALL)
        if components_match:
            components_text = components_match.group(1).strip()
            
            # Extract individual components
            component_pattern = r"### \d+\.\s*(.*?)\s*\(`([^`]+)`\)\s*(.*?)(?=###\s*\d+\.|$)"
            component_matches = re.findall(component_pattern, components_text, re.DOTALL)
            
            components = []
            for name_match, path_match, content_match in component_matches:
                component = {
                    "name": name_match.strip(),
                    "path": path_match.strip(),
                    "content": content_match.strip()
                }
                
                # Extract responsibilities
                resp_match = re.search(r"\*\*Responsibilities:\*\*\s*(.*?)(?=\*\*|$)", content_match, re.DOTALL)
                if resp_match:
                    resp_text = resp_match.group(1).strip()
                    responsibilities = re.findall(r"^[-*]\s*(.+)$", resp_text, re.MULTILINE)
                    component["responsibilities"] = [resp.strip() for resp in responsibilities]
                
                # Extract key methods
                methods_match = re.search(r"\*\*Key Methods:\*\*\s*```[a-zA-Z]*\s*(.*?)\s*```", content_match, re.DOTALL)
                if methods_match:
                    component["key_methods"] = methods_match.group(1).strip()
                
                components.append(component)
            
            data["components"] = components
        
        # Extract testing strategy
        testing_match = re.search(r"## Testing Strategy\s*(.*?)(?=##|$)", content, re.DOTALL)
        if testing_match:
            testing_content = testing_match.group(1).strip()
            data["testing_strategy"] = testing_content
            
            # Extract unit testing approach
            unit_test_match = re.search(r"### Unit Testing Approach\s*(.*?)(?=###|$)", testing_content, re.DOTALL)
            if unit_test_match:
                data["unit_testing"] = unit_test_match.group(1).strip()
            
            # Extract integration testing
            integration_test_match = re.search(r"### Integration Testing\s*(.*?)(?=###|$)", testing_content, re.DOTALL)
            if integration_test_match:
                data["integration_testing"] = integration_test_match.group(1).strip()
        
        # Extract any code blocks for general use
        code_blocks = re.findall(r"```[a-zA-Z]*\s*(.*?)\s*```", content, re.DOTALL)
        if code_blocks:
            data["code_examples"] = code_blocks
        
        return data
    
    def _extract_tasks_data(self, content: str) -> Dict[str, Any]:
        """Extract structured data from tasks content"""
        data = {"phases": []}
        
        # Extract phases - GPT-4.1 uses "### Phase" (3 hashtags)
        phase_pattern = r"### (Phase.*?)(?=###|##|$)"
        phases = re.findall(phase_pattern, content, re.DOTALL)
        
        for phase_content in phases:
            phase_lines = phase_content.split('\n')
            phase_name = phase_lines[0].strip()
            
            # Extract tasks from phase - GPT-4.1 uses table format
            # Look for table rows with task information
            table_row_pattern = r"\|\s*(\d+\.\d+\s+[^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|"
            table_rows = re.findall(table_row_pattern, phase_content, re.DOTALL)
            
            phase_tasks = []
            for task_cell, description_cell, acceptance_cell, estimate_cell, deps_cell in table_rows:
                # Clean up the cells
                task_text = task_cell.strip()
                description = description_cell.strip()
                acceptance_criteria = acceptance_cell.strip()
                estimate = estimate_cell.strip()
                dependencies = deps_cell.strip()
                
                # Extract task ID and title from task_text
                task_match = re.match(r"(\d+\.\d+)\s+(.*)", task_text)
                if task_match:
                    task_id = task_match.group(1)
                    task_title = task_match.group(2).strip()
                    
                    task = {
                        "id": task_id,
                        "title": task_title,
                        "description": description,
                        "acceptance_criteria": acceptance_criteria,
                        "estimate": estimate,
                        "dependencies": dependencies,
                        "status": "pending"  # Default status for new tasks
                    }
                    phase_tasks.append(task)
            
            phase = {
                "name": phase_name,
                "tasks": phase_tasks
            }
            data["phases"].append(phase)
        
        return data


# Convenience functions

def render_requirements_doc(spec_state: SpecState, **kwargs) -> str:
    """Convenience function to render requirements document"""
    renderer = SpecRenderer()
    return renderer.render_requirements(spec_state, **kwargs)


def render_design_doc(spec_state: SpecState, **kwargs) -> str:
    """Convenience function to render design document"""
    renderer = SpecRenderer()
    return renderer.render_design(spec_state, **kwargs)


def render_tasks_doc(spec_state: SpecState, **kwargs) -> str:
    """Convenience function to render tasks document"""
    renderer = SpecRenderer()
    return renderer.render_tasks(spec_state, **kwargs)


def render_all_docs(spec_state: SpecState, **kwargs) -> Dict[str, str]:
    """Convenience function to render all documents"""
    renderer = SpecRenderer()
    return renderer.render_all_documents(spec_state, **kwargs)


# Utility functions for data preparation

def extract_sections_from_markdown(content: str) -> Dict[str, str]:
    """Extract sections from markdown content based on headers"""
    sections = {}
    current_section = None
    current_content = []
    
    lines = content.split('\n')
    
    for line in lines:
        if line.startswith('#'):
            # Save previous section
            if current_section:
                sections[current_section] = '\n'.join(current_content).strip()
            
            # Start new section
            current_section = line.lstrip('#').strip()
            current_content = []
        else:
            current_content.append(line)
    
    # Save last section
    if current_section:
        sections[current_section] = '\n'.join(current_content).strip()
    
    return sections


def snake_case(text: str) -> str:
    """Convert text to snake_case format"""
    # Replace spaces and hyphens with underscores
    text = re.sub(r'[\s\-]+', '_', text)
    # Convert camelCase to snake_case
    text = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', text)
    # Convert to lowercase and clean up
    text = text.lower()
    # Remove extra underscores
    text = re.sub(r'_+', '_', text)
    # Remove leading/trailing underscores
    text = text.strip('_')
    return text


def format_markdown_table(headers: List[str], rows: List[List[str]]) -> str:
    """Format data as a markdown table"""
    if not headers or not rows:
        return ""
    
    # Create header row
    header_row = "| " + " | ".join(headers) + " |"
    
    # Create separator row
    separator = "| " + " | ".join("---" for _ in headers) + " |"
    
    # Create data rows
    data_rows = []
    for row in rows:
        padded_row = row + [""] * (len(headers) - len(row))  # Pad short rows
        data_rows.append("| " + " | ".join(padded_row[:len(headers)]) + " |")
    
    return "\n".join([header_row, separator] + data_rows) 