@echo off
REM 🤖 Spec-Bot Development Startup Script for Windows
REM This script starts both the backend (FastAPI) and frontend (React) servers

setlocal enabledelayedexpansion

echo [SPEC-BOT] 🚀 Starting Spec-Bot Development Environment...
echo.

REM Check if we're in the right directory
if not exist "backend" (
    echo [ERROR] Please run this script from the spec-bot root directory
    echo [ERROR] Expected directories: .\backend and .\frontend
    pause
    exit /b 1
)

if not exist "frontend" (
    echo [ERROR] Please run this script from the spec-bot root directory  
    echo [ERROR] Expected directories: .\backend and .\frontend
    pause
    exit /b 1
)

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM 1. Set up backend
echo [SPEC-BOT] Setting up backend environment...

cd backend

REM Check if virtual environment exists
if not exist "venv" (
    echo [WARNING] Virtual environment not found. Creating one...
    python -m venv venv
    echo [SUCCESS] Virtual environment created
)

REM Activate virtual environment
echo [SPEC-BOT] Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if requirements are installed
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Installing backend dependencies...
    pip install -r requirements.txt
    echo [SUCCESS] Backend dependencies installed
)

REM Check if .env exists
if not exist ".env" (
    if exist "..\\.env.template" (
        echo [WARNING] No .env file found. Creating from template...
        copy "..\\.env.template" ".env"
        echo [WARNING] Please edit .env file and add your OpenAI API key
    ) else (
        echo [WARNING] No .env file found. Please create one with your API keys
    )
)

cd ..

REM 2. Set up frontend
echo [SPEC-BOT] Setting up frontend environment...

cd frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo [WARNING] Node modules not found. Installing...
    npm install
    echo [SUCCESS] Frontend dependencies installed
)

cd ..

echo [SUCCESS] Environment setup complete!
echo.

REM 3. Start servers
echo [SPEC-BOT] Starting backend server...
cd backend
call venv\Scripts\activate.bat
start "Spec-Bot Backend" /min python main.py
cd ..

REM Wait for backend to start
timeout /t 3 /nobreak >nul

echo [SPEC-BOT] Starting frontend server...
cd frontend
start "Spec-Bot Frontend" npm run dev
cd ..

REM Wait for frontend to start
timeout /t 5 /nobreak >nul

echo.
echo [SUCCESS] 🎉 Spec-Bot is running!
echo.
echo 📱 Frontend: http://localhost:5173
echo 🔌 Backend API: http://localhost:8000
echo 📚 API Docs: http://localhost:8000/docs
echo.
echo [SPEC-BOT] Both servers are running in separate windows
echo [SPEC-BOT] Close those windows to stop the servers
echo.
pause 