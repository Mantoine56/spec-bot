#!/usr/bin/env python3
"""
🤖 Spec-Bot Development Startup Script (Cross-Platform)
This script starts both the backend (FastAPI) and frontend (React) servers

Works on Windows, macOS, and Linux
"""

import os
import sys
import subprocess
import time
import signal
import platform
from pathlib import Path

# Colors for console output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color
    
    @classmethod
    def disable_on_windows(cls):
        """Disable colors on Windows if not supported"""
        if platform.system() == 'Windows':
            cls.RED = cls.GREEN = cls.YELLOW = cls.BLUE = cls.NC = ''

# Check if we're on Windows and disable colors if needed
if platform.system() == 'Windows':
    Colors.disable_on_windows()

def print_status(message):
    print(f"{Colors.BLUE}[SPEC-BOT]{Colors.NC} {message}")

def print_success(message):
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {message}")

def print_warning(message):
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {message}")

def print_error(message):
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")

class SpecBotLauncher:
    def __init__(self):
        self.backend_process = None
        self.frontend_process = None
        self.is_windows = platform.system() == 'Windows'
        
    def cleanup(self, signum=None, frame=None):
        """Clean up processes on exit"""
        print_status("Shutting down Spec-Bot servers...")
        
        if self.backend_process:
            print_status(f"Stopping backend server (PID: {self.backend_process.pid})...")
            try:
                self.backend_process.terminate()
                self.backend_process.wait(timeout=5)
            except (subprocess.TimeoutExpired, ProcessLookupError):
                try:
                    self.backend_process.kill()
                except ProcessLookupError:
                    pass
        
        if self.frontend_process:
            print_status(f"Stopping frontend server (PID: {self.frontend_process.pid})...")
            try:
                self.frontend_process.terminate()
                self.frontend_process.wait(timeout=5)
            except (subprocess.TimeoutExpired, ProcessLookupError):
                try:
                    self.frontend_process.kill()
                except ProcessLookupError:
                    pass
        
        print_success("Spec-Bot servers stopped. Goodbye! 👋")
        sys.exit(0)

    def check_prerequisites(self):
        """Check if required tools are available"""
        # Check if we're in the right directory
        if not (Path("backend").exists() and Path("frontend").exists()):
            print_error("Please run this script from the spec-bot root directory")
            print_error("Expected directories: ./backend and ./frontend")
            return False

        # Check Python
        try:
            result = subprocess.run([sys.executable, "--version"], 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, "python")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print_error("Python is not working correctly")
            return False

        # Check Node.js
        try:
            result = subprocess.run(["node", "--version"], 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, "node")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print_error("Node.js is not installed or not in PATH")
            return False

        return True

    def setup_backend(self):
        """Set up backend environment"""
        print_status("Setting up backend environment...")
        
        os.chdir("backend")
        
        # Check if virtual environment exists
        venv_path = Path("venv")
        if not venv_path.exists():
            print_warning("Virtual environment not found. Creating one...")
            subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
            print_success("Virtual environment created")
        
        # Get the correct python executable for the venv
        if self.is_windows:
            venv_python = Path("venv/Scripts/python.exe")
            venv_pip = Path("venv/Scripts/pip.exe")
        else:
            venv_python = Path("venv/bin/python")
            venv_pip = Path("venv/bin/pip")
        
        # Check if requirements are installed
        print_status("Checking backend dependencies...")
        try:
            result = subprocess.run([str(venv_python), "-c", "import fastapi"], 
                                  capture_output=True)
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, "import check")
        except subprocess.CalledProcessError:
            print_warning("Installing backend dependencies...")
            subprocess.run([str(venv_pip), "install", "-r", "requirements.txt"], check=True)
            print_success("Backend dependencies installed")
        
        # Check if .env exists
        if not Path(".env").exists():
            if Path("../.env.template").exists():
                print_warning("No .env file found. Creating from template...")
                import shutil
                shutil.copy("../.env.template", ".env")
                print_warning("Please edit .env file and add your OpenAI API key")
            else:
                print_warning("No .env file found. Please create one with your API keys")
        
        os.chdir("..")
        return str(venv_python)

    def setup_frontend(self):
        """Set up frontend environment"""
        print_status("Setting up frontend environment...")
        
        os.chdir("frontend")
        
        # Check if node_modules exists
        if not Path("node_modules").exists():
            print_warning("Node modules not found. Installing...")
            subprocess.run(["npm", "install"], check=True)
            print_success("Frontend dependencies installed")
        
        os.chdir("..")

    def start_servers(self, venv_python):
        """Start both servers"""
        print_success("Environment setup complete!")
        print("")
        
        # Start backend
        print_status("Starting backend server...")
        os.chdir("backend")
        
        if self.is_windows:
            # On Windows, start in a new console window
            self.backend_process = subprocess.Popen(
                [venv_python, "main.py"],
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            self.backend_process = subprocess.Popen([venv_python, "main.py"])
        
        os.chdir("..")
        
        # Wait for backend to start
        time.sleep(3)
        
        # Start frontend
        print_status("Starting frontend server...")
        os.chdir("frontend")
        
        if self.is_windows:
            # On Windows, start in a new console window
            self.frontend_process = subprocess.Popen(
                ["npm", "run", "dev"],
                creationflags=subprocess.CREATE_NEW_CONSOLE
            )
        else:
            self.frontend_process = subprocess.Popen(["npm", "run", "dev"])
        
        os.chdir("..")
        
        # Wait for frontend to start
        time.sleep(5)

    def run(self):
        """Main run method"""
        # Set up signal handlers
        signal.signal(signal.SIGINT, self.cleanup)
        signal.signal(signal.SIGTERM, self.cleanup)
        
        print_status("🚀 Starting Spec-Bot Development Environment...")
        print("")
        
        # Check prerequisites
        if not self.check_prerequisites():
            return 1
        
        try:
            # Set up environments
            venv_python = self.setup_backend()
            self.setup_frontend()
            
            # Start servers
            self.start_servers(venv_python)
            
            # Display success message
            print("")
            print_success("🎉 Spec-Bot is running!")
            print("")
            print(f"{Colors.BLUE}📱 Frontend:{Colors.NC} http://localhost:5173")
            print(f"{Colors.BLUE}🔌 Backend API:{Colors.NC} http://localhost:8000")
            print(f"{Colors.BLUE}📚 API Docs:{Colors.NC} http://localhost:8000/docs")
            print("")
            
            if self.is_windows:
                print_status("Both servers are running in separate console windows")
                print_status("Close those windows or press Ctrl+C here to stop")
            else:
                print_status("Press Ctrl+C to stop both servers")
            
            print("")
            
            # Keep script running
            try:
                while True:
                    time.sleep(1)
                    # Check if processes are still running
                    if self.backend_process and self.backend_process.poll() is not None:
                        print_error("Backend process stopped unexpectedly")
                        break
                    if self.frontend_process and self.frontend_process.poll() is not None:
                        print_error("Frontend process stopped unexpectedly")
                        break
            except KeyboardInterrupt:
                self.cleanup()
        
        except Exception as e:
            print_error(f"An error occurred: {e}")
            self.cleanup()
            return 1
        
        return 0

if __name__ == "__main__":
    launcher = SpecBotLauncher()
    sys.exit(launcher.run()) 