import os
from celery import Celery

# Use local port 6380 for Redis to avoid conflicts
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6380/0")

celery_app = Celery(
    "mailforge_worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1, # One task at a time per worker for rate limiting
)

# Optional routing or rate limits
# celery_app.conf.task_routes = {'app.tasks.email_tasks.send_email_task': {'queue': 'email_queue'}}
