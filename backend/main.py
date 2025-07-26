"""
Spec-Bot FastAPI Backend
Main application entry point with CORS configuration for React frontend integration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import os
from contextlib import asynccontextmanager

# Import API routers
from api.workflow_routes import router as workflow_router
from api.file_routes import router as file_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events"""
    # Startup
    logger.info("Starting Spec-Bot backend...")
    yield
    # Shutdown
    logger.info("Shutting down Spec-Bot backend...")


# Initialize FastAPI app
app = FastAPI(
    title="Spec-Bot API",
    description="AI-powered specification generation with human-in-the-loop workflow",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React dev server
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(workflow_router)
app.include_router(file_router)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Spec-Bot API is running", "status": "healthy"}


@app.get("/health")
async def health_check():
    """Detailed health check endpoint"""
    return {
        "status": "healthy",
        "service": "spec-bot-api",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    
    # Run with hot reload for development
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 