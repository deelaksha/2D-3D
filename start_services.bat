@echo off
echo ==================================================
echo    Starting AI Backend and Frontend Services
echo ==================================================

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%AI_MODEL\backend
set FRONTEND_DIR=%SCRIPT_DIR%

echo Starting AI Backend (FastAPI port 8000)...
start "AI Backend Service" cmd /k "cd /d %BACKEND_DIR% && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo Starting Frontend Service (Vite)...
start "Frontend Service" cmd /k "cd /d %FRONTEND_DIR% && cmd /c npm run dev"

echo.
echo Both services launched in separate windows!
echo  - AI Backend API : http://localhost:8000
echo  - Frontend App   : http://localhost:5173
echo.
