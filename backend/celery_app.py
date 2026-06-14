from celery import Celery
import os

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "netvuln",
    broker=redis_url,
    backend=redis_url,
    include=["app.tasks.scanner_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    task_soft_time_limit=3300,  # 55 min
    worker_prefetch_multiplier=1,
)

# Celery Beat schedule for scheduled scans
celery_app.conf.beat_schedule = {
    "process-scheduled-scans": {
        "task": "app.tasks.scanner_tasks.process_scheduled_scans",
        "schedule": 60.0,  # Every minute
    },
}
