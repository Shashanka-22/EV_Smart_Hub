# backend/wsgi.py
# WSGI entrypoint for production servers (gunicorn)
from app import create_app   # import directly since working dir is backend
app = create_app()
