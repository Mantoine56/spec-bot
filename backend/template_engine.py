"""
Jinja2 template engine for Spec-Bot.
Handles template loading, rendering, and validation for generating specification documents.
"""

import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

from jinja2 import (
    Environment, 
    FileSystemLoader, 
    Template, 
    TemplateError,
    TemplateNotFound,
    select_autoescape
)

from config import settings

logger = logging.getLogger(__name__)


class TemplateEngine:
    """Main template engine for rendering specification documents"""
    
    def __init__(self, template_dir: Optional[str] = None):
        """
        Initialize the template engine.
        
        Args:
            template_dir: Directory containing templates (defaults to backend/templates)
        """
        if template_dir is None:
            # Default to templates directory relative to this file
            current_dir = Path(__file__).parent
            template_dir = current_dir / "templates"
        
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize Jinja2 environment
        self.env = Environment(
            loader=FileSystemLoader(self.template_dir),
            autoescape=select_autoescape(['html', 'xml']),
            trim_blocks=True,
            lstrip_blocks=True,
            keep_trailing_newline=True
        )
        
        # Add custom filters and functions
        self._setup_custom_filters()
        
        logger.info(f"Template engine initialized with directory: {self.template_dir}")
    
    def _setup_custom_filters(self) -> None:
        """Add custom Jinja2 filters and global functions"""
        
        # Date formatting filter
        def format_date(date_obj: datetime, format_str: str = "%Y-%m-%d") -> str:
            """Format datetime object to string"""
            if isinstance(date_obj, datetime):
                return date_obj.strftime(format_str)
            return str(date_obj)
        
        # Markdown header filter
        def md_header(text: str, level: int = 1) -> str:
            """Convert text to markdown header"""
            return f"{'#' * level} {text}"
        
        # List formatting filter
        def format_list(items: List[str], bullet: str = "-") -> str:
            """Format list items with specified bullet"""
            if not items:
                return ""
            return "\n".join(f"{bullet} {item}" for item in items)
        
        # Code block filter
        def code_block(code: str, language: str = "") -> str:
            """Wrap code in markdown code block"""
            return f"```{language}\n{code}\n```"
        
        # Text truncation filter
        def truncate_words(text: str, length: int = 50) -> str:
            """Truncate text to specified word count"""
            words = text.split()
            if len(words) <= length:
                return text
            return " ".join(words[:length]) + "..."
        
        # Snake case filter
        def snake_case_filter(text: str) -> str:
            """Convert text to snake_case format"""
            import re
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
        
        # Register filters
        self.env.filters["format_date"] = format_date
        self.env.filters["md_header"] = md_header
        self.env.filters["format_list"] = format_list
        self.env.filters["code_block"] = code_block
        self.env.filters["truncate_words"] = truncate_words
        self.env.filters["snake_case"] = snake_case_filter
        
        # Global functions
        self.env.globals["now"] = datetime.now
        self.env.globals["today"] = datetime.now().strftime("%Y-%m-%d")
    
    def get_template(self, template_name: str) -> Template:
        """
        Load a template by name.
        
        Args:
            template_name: Name of the template file
            
        Returns:
            Jinja2 Template object
            
        Raises:
            TemplateNotFound: If template doesn't exist
        """
        try:
            return self.env.get_template(template_name)
        except TemplateNotFound as e:
            logger.error(f"Template not found: {template_name}")
            raise TemplateNotFound(f"Template '{template_name}' not found in {self.template_dir}")
    
    def render_template(
        self, 
        template_name: str, 
        context: Dict[str, Any],
        validate_output: bool = True
    ) -> str:
        """
        Render a template with the given context.
        
        Args:
            template_name: Name of the template file
            context: Data to pass to the template
            validate_output: Whether to validate the rendered output
            
        Returns:
            Rendered template content
            
        Raises:
            TemplateError: If rendering fails
        """
        try:
            template = self.get_template(template_name)
            
            # Add common context variables
            enhanced_context = {
                **context,
                "generated_at": datetime.now(),
                "template_name": template_name,
                "spec_bot_version": "1.0.0"
            }
            
            # Render the template
            rendered = template.render(enhanced_context)
            
            # Validate output if requested
            if validate_output:
                self._validate_rendered_output(rendered, template_name)
            
            logger.info(f"Successfully rendered template: {template_name}")
            return rendered
            
        except TemplateError as e:
            logger.error(f"Template rendering failed for {template_name}: {e}")
            raise TemplateError(f"Failed to render template '{template_name}': {e}")
        except Exception as e:
            logger.error(f"Unexpected error rendering {template_name}: {e}")
            raise TemplateError(f"Unexpected error rendering template '{template_name}': {e}")
    
    def _validate_rendered_output(self, content: str, template_name: str) -> None:
        """
        Validate the rendered template output.
        
        Args:
            content: Rendered content to validate
            template_name: Name of the template being validated
            
        Raises:
            TemplateError: If validation fails
        """
        # Basic validation checks
        if not content.strip():
            raise TemplateError(f"Template '{template_name}' produced empty output")
        
        # Check for common template issues
        if "{{ " in content or " }}" in content:
            logger.warning(f"Template '{template_name}' may have unrendered variables")
        
        # Validate markdown structure for spec documents
        if template_name.endswith(('.md', '.markdown')):
            if not content.strip().startswith('#'):
                logger.warning(f"Markdown template '{template_name}' doesn't start with a header")
    
    def render_string(self, template_string: str, context: Dict[str, Any]) -> str:
        """
        Render a template from a string instead of a file.
        
        Args:
            template_string: Template content as string
            context: Data to pass to the template
            
        Returns:
            Rendered content
        """
        try:
            template = self.env.from_string(template_string)
            
            enhanced_context = {
                **context,
                "generated_at": datetime.now(),
                "spec_bot_version": "1.0.0"
            }
            
            return template.render(enhanced_context)
            
        except Exception as e:
            logger.error(f"String template rendering failed: {e}")
            raise TemplateError(f"Failed to render string template: {e}")
    
    def list_templates(self) -> List[str]:
        """
        Get list of available templates.
        
        Returns:
            List of template filenames
        """
        templates = []
        
        for file_path in self.template_dir.rglob("*.j2"):
            # Get relative path from template directory
            relative_path = file_path.relative_to(self.template_dir)
            templates.append(str(relative_path))
        
        # Also look for .md templates
        for file_path in self.template_dir.rglob("*.md"):
            relative_path = file_path.relative_to(self.template_dir)
            templates.append(str(relative_path))
        
        return sorted(templates)
    
    def template_exists(self, template_name: str) -> bool:
        """
        Check if a template exists.
        
        Args:
            template_name: Name of the template to check
            
        Returns:
            True if template exists, False otherwise
        """
        try:
            self.get_template(template_name)
            return True
        except TemplateNotFound:
            return False
    
    def get_template_info(self, template_name: str) -> Dict[str, Any]:
        """
        Get information about a template.
        
        Args:
            template_name: Name of the template
            
        Returns:
            Dictionary with template information
        """
        if not self.template_exists(template_name):
            raise TemplateNotFound(f"Template '{template_name}' not found")
        
        template_path = self.template_dir / template_name
        stat = template_path.stat()
        
        return {
            "name": template_name,
            "path": str(template_path),
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime),
            "exists": True
        }


# Global template engine instance
_template_engine = None


def get_template_engine() -> TemplateEngine:
    """Get the global template engine instance"""
    global _template_engine
    if _template_engine is None:
        _template_engine = TemplateEngine()
    return _template_engine


# Convenience functions

def render_template(template_name: str, context: Dict[str, Any]) -> str:
    """Convenience function to render a template"""
    engine = get_template_engine()
    return engine.render_template(template_name, context)


def render_string_template(template_string: str, context: Dict[str, Any]) -> str:
    """Convenience function to render a string template"""
    engine = get_template_engine()
    return engine.render_string(template_string, context) 