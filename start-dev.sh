#!/bin/bash

# 🤖 Spec-Bot Development Startup Script
# This script starts both the backend (FastAPI) and frontend (React) servers

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[SPEC-BOT]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to cleanup processes on exit
cleanup() {
    print_status "Shutting down Spec-Bot servers..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        print_status "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        print_status "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    print_success "Spec-Bot servers stopped. Goodbye! 👋"
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM

print_status "🚀 Starting Spec-Bot Development Environment..."
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the spec-bot root directory"
    print_error "Expected directories: ./backend and ./frontend"
    exit 1
fi

# Check if Python is available
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    print_error "Python is not installed or not in PATH"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

# Use python3 if available, otherwise python
PYTHON_CMD="python"
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
fi

# 1. Set up backend
print_status "Setting up backend environment..."

cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating one..."
    $PYTHON_CMD -m venv venv
    print_success "Virtual environment created"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Check if requirements are installed
print_status "Checking backend dependencies..."
if ! python -c "import fastapi" &> /dev/null; then
    print_warning "Installing backend dependencies..."
    pip install -r requirements.txt
    print_success "Backend dependencies installed"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    if [ -f "../.env.template" ]; then
        print_warning "No .env file found. Creating from template..."
        cp ../.env.template .env
        print_warning "Please edit .env file and add your OpenAI API key"
    else
        print_warning "No .env file found. Please create one with your API keys"
    fi
fi

cd ..

# 2. Set up frontend
print_status "Setting up frontend environment..."

cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "Node modules not found. Installing..."
    npm install
    print_success "Frontend dependencies installed"
fi

cd ..

print_success "Environment setup complete!"
echo ""

# 3. Start servers
print_status "Starting backend server..."
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

print_status "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 5

echo ""
print_success "🎉 Spec-Bot is running!"
echo ""
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}🔌 Backend API:${NC} http://localhost:8000"  
echo -e "${BLUE}📚 API Docs:${NC} http://localhost:8000/docs"
echo ""
print_status "Press Ctrl+C to stop both servers"
echo ""

# Keep script running and wait for user to stop
wait 