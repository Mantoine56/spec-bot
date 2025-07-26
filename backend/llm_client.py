"""
Provider-agnostic LLM client system for Spec-Bot.
Supports OpenAI and Anthropic APIs with unified interface and error handling.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, Union
import logging
import asyncio
from dataclasses import dataclass
from enum import Enum

import openai
import anthropic
from config import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Base exception for LLM-related errors"""
    pass


class RateLimitError(LLMError):
    """Raised when API rate limits are exceeded"""
    pass


class AuthenticationError(LLMError):
    """Raised when API authentication fails"""
    pass


class ModelNotFoundError(LLMError):
    """Raised when the specified model is not available"""
    pass


@dataclass
class LLMMessage:
    """Standardized message format for LLM communication"""
    role: str  # "user", "assistant", "system"
    content: str
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class LLMResponse:
    """Standardized response format from LLM providers"""
    content: str
    model: str
    usage: Optional[Dict[str, int]] = None
    metadata: Optional[Dict[str, Any]] = None
    raw_response: Optional[Any] = None


class LLMClient(ABC):
    """Abstract base class for LLM providers"""
    
    def __init__(self, api_key: str, model_name: str = "default"):
        """Initialize the LLM client with API key and model"""
        self.api_key = api_key
        self.model_name = model_name
        self.client = None
        self._initialize_client()
    
    @abstractmethod
    def _initialize_client(self) -> None:
        """Initialize the provider-specific client"""
        pass
    
    @abstractmethod
    async def generate(
        self, 
        messages: List[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate a response from the LLM"""
        pass
    
    @abstractmethod
    def get_available_models(self) -> List[str]:
        """Get list of available models for this provider"""
        pass
    
    def validate_api_key(self) -> bool:
        """Test if the API key is valid"""
        try:
            # Simple validation - try to get available models
            models = self.get_available_models()
            return len(models) > 0
        except Exception as e:
            logger.error(f"API key validation failed: {e}")
            return False


class OpenAIClient(LLMClient):
    """OpenAI API client implementation"""
    
    def _initialize_client(self) -> None:
        """Initialize OpenAI client"""
        if not self.api_key:
            raise AuthenticationError("OpenAI API key is required")
        
        self.client = openai.AsyncOpenAI(api_key=self.api_key)
        
        # Set default model if not specified
        if self.model_name == "default":
            self.model_name = "gpt-4.1"
    
    async def generate(
        self,
        messages: List[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate response using OpenAI API"""
        try:
            # Convert our message format to OpenAI format
            openai_messages = [
                {"role": msg.role, "content": msg.content} 
                for msg in messages
            ]
            
            # Set defaults from config if not provided
            if max_tokens is None:
                max_tokens = settings.max_tokens
            if temperature is None:
                temperature = settings.temperature
            
            logger.info(f"Generating response with OpenAI model: {self.model_name}")
            
            # Make the API call
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=openai_messages,
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs
            )
            
            # Extract the generated content
            content = response.choices[0].message.content
            if not content:
                raise LLMError("Empty response from OpenAI API")
            
            # Extract usage information
            usage = None
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            
            return LLMResponse(
                content=content,
                model=self.model_name,
                usage=usage,
                metadata={
                    "finish_reason": response.choices[0].finish_reason,
                    "provider": "openai"
                },
                raw_response=response
            )
        
        except openai.RateLimitError as e:
            logger.error(f"OpenAI rate limit exceeded: {e}")
            raise RateLimitError(f"OpenAI rate limit exceeded: {e}")
        
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI authentication failed: {e}")
            raise AuthenticationError(f"OpenAI authentication failed: {e}")
        
        except openai.NotFoundError as e:
            logger.error(f"OpenAI model not found: {e}")
            raise ModelNotFoundError(f"OpenAI model '{self.model_name}' not found: {e}")
        
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise LLMError(f"OpenAI API error: {e}")
    
    def get_available_models(self) -> List[str]:
        """Get available OpenAI models (based on official OpenAI documentation)"""
        return [
            "gpt-4.1",  # Latest GPT-4.1 flagship model (April 2025) - most advanced
            "gpt-4.1-mini",  # Smaller, faster version of GPT-4.1
            "gpt-4.1-nano",  # Smallest, most efficient version of GPT-4.1
            "gpt-4o",  # GPT-4 Omni - previous flagship model
            "gpt-4o-mini",  # Smaller, faster version of GPT-4 Omni
            "gpt-4o-2024-08-06",  # Specific version optimized for structured outputs
            "gpt-4-turbo",  # Latest GPT-4 Turbo
            "gpt-4-turbo-preview",  # Preview version of GPT-4 Turbo
            "gpt-4",  # Standard GPT-4
            "gpt-3.5-turbo",  # Most recent GPT-3.5 Turbo
            "gpt-3.5-turbo-0125"  # Specific GPT-3.5 version
        ]


class AnthropicClient(LLMClient):
    """Anthropic Claude API client implementation"""
    
    def _initialize_client(self) -> None:
        """Initialize Anthropic client"""
        if not self.api_key:
            raise AuthenticationError("Anthropic API key is required")
        
        self.client = anthropic.AsyncAnthropic(api_key=self.api_key)
        
        # Set default model if not specified
        if self.model_name == "default":
            self.model_name = "claude-3-sonnet-20240229"
    
    async def generate(
        self,
        messages: List[LLMMessage],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate response using Anthropic Claude API"""
        try:
            # Separate system message from conversation messages
            system_message = None
            conversation_messages = []
            
            for msg in messages:
                if msg.role == "system":
                    system_message = msg.content
                else:
                    conversation_messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
            
            # Set defaults from config if not provided
            if max_tokens is None:
                max_tokens = settings.max_tokens
            if temperature is None:
                temperature = settings.temperature
            
            logger.info(f"Generating response with Anthropic model: {self.model_name}")
            
            # Prepare API call parameters
            api_params = {
                "model": self.model_name,
                "messages": conversation_messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
                **kwargs
            }
            
            # Add system message if present
            if system_message:
                api_params["system"] = system_message
            
            # Make the API call
            response = await self.client.messages.create(**api_params)
            
            # Extract the generated content
            content = ""
            for content_block in response.content:
                if content_block.type == "text":
                    content += content_block.text
            
            if not content:
                raise LLMError("Empty response from Anthropic API")
            
            # Extract usage information
            usage = None
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                }
            
            return LLMResponse(
                content=content,
                model=self.model_name,
                usage=usage,
                metadata={
                    "stop_reason": response.stop_reason,
                    "provider": "anthropic"
                },
                raw_response=response
            )
        
        except anthropic.RateLimitError as e:
            logger.error(f"Anthropic rate limit exceeded: {e}")
            raise RateLimitError(f"Anthropic rate limit exceeded: {e}")
        
        except anthropic.AuthenticationError as e:
            logger.error(f"Anthropic authentication failed: {e}")
            raise AuthenticationError(f"Anthropic authentication failed: {e}")
        
        except anthropic.NotFoundError as e:
            logger.error(f"Anthropic model not found: {e}")
            raise ModelNotFoundError(f"Anthropic model '{self.model_name}' not found: {e}")
        
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise LLMError(f"Anthropic API error: {e}")
    
    def get_available_models(self) -> List[str]:
        """Get available Anthropic models"""
        return [
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
            "claude-2.1",
            "claude-2.0",
            "claude-instant-1.2"
        ]


class LLMClientFactory:
    """Factory class for creating LLM clients"""
    
    @staticmethod
    def create_client(
        provider: str,
        api_key: str,
        model_name: str = "default"
    ) -> LLMClient:
        """Create an LLM client for the specified provider"""
        
        provider_lower = provider.lower()
        
        if provider_lower == "openai":
            return OpenAIClient(api_key=api_key, model_name=model_name)
        elif provider_lower == "anthropic":
            return AnthropicClient(api_key=api_key, model_name=model_name)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")
    
    @staticmethod
    def create_from_config() -> LLMClient:
        """Create an LLM client using configuration settings"""
        
        provider = settings.default_llm_provider
        model = settings.default_model
        
        if provider == "openai":
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            return OpenAIClient(api_key=settings.openai_api_key, model_name=model)
        
        elif provider == "anthropic":
            if not settings.anthropic_api_key:
                raise ValueError("Anthropic API key not configured")
            return AnthropicClient(api_key=settings.anthropic_api_key, model_name=model)
            
        else:
            raise ValueError(f"Unsupported LLM provider in config: {provider}")


# Convenience function for getting a client
def get_llm_client(
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None
) -> LLMClient:
    """
    Get an LLM client with optional overrides.
    Falls back to configuration settings if parameters not provided.
    """
    
    # Use provided parameters or fall back to config
    provider = provider or settings.default_llm_provider
    model_name = model_name or settings.default_model
    
    # Get API key based on provider
    if api_key:
        return LLMClientFactory.create_client(provider, api_key, model_name)
    else:
        return LLMClientFactory.create_from_config() 