# backend/wsgi.py — robust entrypoint that works whether cwd is backend or repo root
import os
import sys

# Make sure parent directory is on sys.path so 'backend' package is importable when needed
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

# Try to import the app either as a local module (when cwd=backend) or as package (when cwd=repo root)
try:
    # when running inside backend folder: 'from app import create_app' works
    from app import create_app
except Exception:
    # when running from repo root: 'from backend.app import create_app' works
    from backend.app import create_app

app = create_app()
