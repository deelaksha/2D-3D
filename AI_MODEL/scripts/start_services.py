#!/usr/bin/env python3
"""
Start Services Launcher Script (AI_MODEL/scripts)
Launches both the AI Backend (FastAPI on http://localhost:8000)
and the Frontend service (Next.js / Vite on dev port) simultaneously.
"""

import os
import sys
import subprocess
import threading
import signal
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_MODEL_DIR = os.path.dirname(SCRIPT_DIR)
AI_BACKEND_DIR = os.path.join(AI_MODEL_DIR, "backend")
AI_FRONTEND_DIR = os.path.dirname(AI_MODEL_DIR)

processes = []

def log(prefix, line):
    print(f"[{prefix}] {line}", end="", flush=True)

def stream_output(process, prefix):
    try:
        if process.stdout:
            for line in iter(process.stdout.readline, ''):
                if not line:
                    break
                log(prefix, line)
    except Exception:
        pass

def run_service(cmd, cwd, prefix, env=None):
    use_shell = sys.platform == "win32"
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        shell=use_shell,
        env=merged_env
    )
    processes.append(proc)

    thread = threading.Thread(target=stream_output, args=(proc, prefix), daemon=True)
    thread.start()
    return proc

def cleanup(signum=None, frame=None):
    print("\n[LAUNCHER] Shutting down services...")
    for proc in processes:
        if proc.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    proc.terminate()
            except Exception:
                pass
    print("[LAUNCHER] All services stopped.")
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("==================================================")
    print("    Starting AI Backend and Frontend Services     ")
    print("==================================================")
    print(f"[LAUNCHER] Backend Directory  : {AI_BACKEND_DIR}")
    print(f"[LAUNCHER] Frontend Directory : {AI_FRONTEND_DIR}")

    backend_cmd = f'"{sys.executable}" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000'
    frontend_cmd = "cmd /c npm run dev" if sys.platform == "win32" else "npm run dev"

    print("\n[LAUNCHER] Launching AI Backend (FastAPI on port 8000)...")
    run_service(backend_cmd, AI_BACKEND_DIR, "AI-BACKEND")

    print("[LAUNCHER] Launching Frontend Service...")
    run_service(frontend_cmd, AI_FRONTEND_DIR, "FRONTEND")

    print("\n[LAUNCHER] Both services are running!")
    print("[LAUNCHER] AI Backend API : http://localhost:8000 (Swagger docs: http://localhost:8000/docs)")
    print("[LAUNCHER] Frontend App   : http://localhost:5173 (or see logs below)")
    print("[LAUNCHER] Press Ctrl+C to terminate both services cleanly.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
