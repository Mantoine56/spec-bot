"""
LLM response processing utilities for Spec-Bot.
Handles JSON parsing, validation, retries, and fallback conversation mode.
"""

import json
import re
import logging
from typing import Any, Dict, Optional, Union, Type, List, Tuple
from dataclasses import dataclass
import asyncio
from enum import Enum

from pydantic import BaseModel, ValidationError
from llm_client import LLMMessage, LLMResponse, LLMClient, get_llm_client

logger = logging.getLogger(__name__)


class ParseMode(str, Enum):
    """Response parsing modes"""
    JSON = "json"
    MARKDOWN = "markdown"
    CONVERSATION = "conversation"


@dataclass
class ParseResult:
    """Result of response parsing attempt"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    mode: Optional[ParseMode] = None
    raw_content: Optional[str] = None


class LLMResponseProcessor:
    """Processes and validates LLM responses with retry logic"""
    
    def __init__(self, max_retries: int = 3, cache_enabled: bool = True):
        """Initialize processor with retry and cache settings"""
        self.max_retries = max_retries
        self.cache_enabled = cache_enabled
        self._response_cache: Dict[str, Any] = {}
    
    def _get_cache_key(self, content: str, validation_model: Type[BaseModel] = None) -> str:
        """Generate cache key for response content"""
        model_name = validation_model.__name__ if validation_model else "none"
        return f"{hash(content)}_{model_name}"
    
    def _extract_json_from_response(self, content: str) -> Tuple[Optional[str], ParseMode]:
        """
        Extract JSON from LLM response content.
        Handles various formats like markdown code blocks, plain JSON, etc.
        """
        
        # Remove any leading/trailing whitespace
        content = content.strip()
        
        # Pattern 1: JSON in markdown code block
        json_block_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
        match = re.search(json_block_pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            logger.debug("Found JSON in markdown code block")
            return match.group(1).strip(), ParseMode.JSON
        
        # Pattern 2: JSON at the start of response
        if content.startswith('{') and content.endswith('}'):
            logger.debug("Found JSON at start/end of response")
            return content, ParseMode.JSON
        
        # Pattern 3: JSON somewhere in the middle
        json_pattern = r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})'
        matches = re.findall(json_pattern, content, re.DOTALL)
        
        for match in matches:
            try:
                # Try to parse to see if it's valid JSON
                json.loads(match)
                logger.debug("Found valid JSON in response content")
                return match, ParseMode.JSON
            except json.JSONDecodeError:
                continue
        
        # Pattern 4: Check if it's markdown content
        if any(marker in content for marker in ['#', '##', '###', '```', '*', '-', '|']):
            logger.debug("Detected markdown content")
            return content, ParseMode.MARKDOWN
        
        # Default: treat as conversation
        logger.debug("No JSON found, treating as conversation")
        return content, ParseMode.CONVERSATION
    
    def parse_json_response(
        self, 
        content: str, 
        validation_model: Optional[Type[BaseModel]] = None,
        strict: bool = True
    ) -> ParseResult:
        """
        Parse JSON from LLM response with validation.
        
        Args:
            content: Raw LLM response content
            validation_model: Pydantic model for validation
            strict: If True, fails on validation errors; if False, returns partial data
        """
        
        # Check cache first
        if self.cache_enabled:
            cache_key = self._get_cache_key(content, validation_model)
            if cache_key in self._response_cache:
                logger.debug("Returning cached parse result")
                return self._response_cache[cache_key]
        
        # Extract JSON from response
        json_content, detected_mode = self._extract_json_from_response(content)
        
        if detected_mode != ParseMode.JSON:
            result = ParseResult(
                success=False,
                error=f"No JSON content detected, found {detected_mode.value}",
                mode=detected_mode,
                raw_content=content
            )
            return result
        
        try:
            # Parse JSON
            parsed_data = json.loads(json_content)
            logger.debug(f"Successfully parsed JSON: {type(parsed_data)}")
            
            # Validate with Pydantic model if provided
            if validation_model:
                try:
                    validated_data = validation_model(**parsed_data)
                    result = ParseResult(
                        success=True,
                        data=validated_data,
                        mode=ParseMode.JSON,
                        raw_content=content
                    )
                except ValidationError as e:
                    if strict:
                        result = ParseResult(
                            success=False,
                            error=f"Validation failed: {e}",
                            mode=ParseMode.JSON,
                            raw_content=content
                        )
                    else:
                        # Return partial data even with validation errors
                        logger.warning(f"Validation failed but strict=False: {e}")
                        result = ParseResult(
                            success=True,
                            data=parsed_data,  # Return raw parsed data
                            mode=ParseMode.JSON,
                            raw_content=content
                        )
            else:
                result = ParseResult(
                    success=True,
                    data=parsed_data,
                    mode=ParseMode.JSON,
                    raw_content=content
                )
            
            # Cache successful result
            if self.cache_enabled:
                self._response_cache[cache_key] = result
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {e}")
            result = ParseResult(
                success=False,
                error=f"JSON parsing failed: {e}",
                mode=ParseMode.JSON,
                raw_content=content
            )
            return result
    
    async def parse_with_retry(
        self,
        llm_client: LLMClient,
        messages: List[LLMMessage],
        validation_model: Optional[Type[BaseModel]] = None,
        retry_prompt: Optional[str] = None
    ) -> ParseResult:
        """
        Attempt to parse LLM response with automatic retries on failure.
        
        Args:
            llm_client: LLM client to use for retries
            messages: Original messages that generated the response
            validation_model: Pydantic model for validation
            retry_prompt: Custom prompt to add for retries
        """
        
        last_error = None
        
        for attempt in range(self.max_retries + 1):  # +1 for initial attempt
            try:
                if attempt == 0:
                    # First attempt with original messages
                    response = await llm_client.generate(messages)
                else:
                    # Retry with additional instruction
                    retry_messages = messages.copy()
                    
                    if retry_prompt:
                        retry_instruction = retry_prompt
                    else:
                        retry_instruction = (
                            "The previous response could not be parsed as valid JSON. "
                            "Please provide your response as valid JSON format only, "
                            "enclosed in ```json``` markdown code blocks."
                        )
                    
                    retry_messages.append(LLMMessage(
                        role="user",
                        content=retry_instruction
                    ))
                    
                    logger.info(f"Retry attempt {attempt}/{self.max_retries}")
                    response = await llm_client.generate(retry_messages)
                
                # Try to parse the response
                parse_result = self.parse_json_response(
                    response.content,
                    validation_model=validation_model
                )
                
                if parse_result.success:
                    logger.info(f"Successfully parsed response on attempt {attempt + 1}")
                    return parse_result
                else:
                    last_error = parse_result.error
                    logger.warning(f"Parse failed on attempt {attempt + 1}: {last_error}")
                    
                    # If this was the last attempt, check if we should fall back to conversation mode
                    if attempt == self.max_retries:
                        logger.info("Max retries reached, checking for fallback conversation mode")
                        
                        if parse_result.mode == ParseMode.CONVERSATION or parse_result.mode == ParseMode.MARKDOWN:
                            # Return as conversation mode
                            return ParseResult(
                                success=True,
                                data={"content": response.content, "mode": "conversation"},
                                mode=ParseMode.CONVERSATION,
                                raw_content=response.content
                            )
                
            except Exception as e:
                last_error = str(e)
                logger.error(f"Error on attempt {attempt + 1}: {e}")
                
                if attempt == self.max_retries:
                    break
                
                # Wait before retry (exponential backoff)
                wait_time = 2 ** attempt
                logger.info(f"Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
        
        # All attempts failed
        return ParseResult(
            success=False,
            error=f"Failed after {self.max_retries + 1} attempts. Last error: {last_error}",
            mode=ParseMode.JSON,
            raw_content=None
        )
    
    def validate_structured_output(
        self,
        data: Dict[str, Any],
        model: Type[BaseModel],
        allow_partial: bool = False
    ) -> Tuple[bool, Optional[BaseModel], Optional[str]]:
        """
        Validate data against a Pydantic model.
        
        Returns:
            (is_valid, validated_model, error_message)
        """
        try:
            validated = model(**data)
            return True, validated, None
        
        except ValidationError as e:
            if allow_partial:
                # Try to create partial model with available fields
                valid_fields = {}
                for field_name, field_info in model.__fields__.items():
                    if field_name in data:
                        try:
                            # Try to validate individual field
                            field_value = data[field_name]
                            valid_fields[field_name] = field_value
                        except:
                            continue
                
                if valid_fields:
                    try:
                        partial_model = model(**valid_fields)
                        logger.warning(f"Created partial model with fields: {list(valid_fields.keys())}")
                        return True, partial_model, f"Partial validation: {e}"
                    except:
                        pass
            
            return False, None, str(e)
    
    def create_conversation_fallback(
        self,
        content: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a structured fallback response when JSON parsing fails.
        This allows the system to continue in conversation mode.
        """
        return {
            "type": "conversation",
            "content": content,
            "context": context,
            "requires_human_processing": True,
            "suggested_action": "manual_review"
        }
    
    def clear_cache(self) -> None:
        """Clear the response cache"""
        self._response_cache.clear()
        logger.info("Response cache cleared")


# Convenience functions

def parse_llm_json(
    content: str,
    validation_model: Optional[Type[BaseModel]] = None,
    strict: bool = True
) -> ParseResult:
    """Convenience function to parse LLM JSON response"""
    processor = LLMResponseProcessor()
    return processor.parse_json_response(content, validation_model, strict)


async def generate_and_parse(
    messages: List[LLMMessage],
    validation_model: Optional[Type[BaseModel]] = None,
    llm_client: Optional[LLMClient] = None,
    max_retries: int = 3
) -> ParseResult:
    """
    Generate LLM response and parse with retries.
    
    Args:
        messages: Messages to send to LLM
        validation_model: Pydantic model for validation
        llm_client: LLM client (uses default if None)
        max_retries: Maximum retry attempts
    """
    
    if llm_client is None:
        llm_client = get_llm_client()
    
    processor = LLMResponseProcessor(max_retries=max_retries)
    return await processor.parse_with_retry(
        llm_client=llm_client,
        messages=messages,
        validation_model=validation_model
    )


def extract_markdown_sections(content: str) -> Dict[str, str]:
    """
    Extract sections from markdown content based on headers.
    Useful for parsing structured markdown responses.
    """
    sections = {}
    current_section = None
    current_content = []
    
    lines = content.split('\n')
    
    for line in lines:
        # Check if line is a header
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


def format_validation_error(error: ValidationError) -> str:
    """Format Pydantic validation error for user-friendly display"""
    error_messages = []
    
    for error_detail in error.errors():
        field = '.'.join(str(loc) for loc in error_detail['loc'])
        message = error_detail['msg']
        error_messages.append(f"Field '{field}': {message}")
    
    return "; ".join(error_messages) 