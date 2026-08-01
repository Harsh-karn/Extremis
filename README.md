# MailForge

MailForge is an open-source bulk email sending platform built for developers. It simplifies the process of sending personalized email campaigns at scale by offering features like list deduplication, file validation, rate limiting, and real-time dashboard analytics.

## Tech Stack
- **Backend:** FastAPI, Python, SQLAlchemy, PostgreSQL, Celery, Redis
- **Frontend:** Next.js, React, Tailwind CSS
- **Infrastructure:** Docker Compose

## Features
- **CSV & Excel Uploads:** Upload your recipient lists seamlessly.
- **Intelligent Deduplication:** Automatically removes duplicate emails.
- **Data Validation:** Strips completely empty rows and cleans up column headers, gracefully handling formatting issues from standard spreadsheet editors.
- **Email Dispatching:** Robust background worker system (Celery + Redis) for rate-limited, asynchronous email sending.
- **Real-time Analytics:** Track delivery rates and failed bounces right from your dashboard.

## Getting Started
### 1. Prerequisites
- Docker and Docker Compose
- Node.js (v18+)
- Python (3.11+)

### 2. Local Setup
1. Clone the repository
2. Run the database and message broker:
   ```bash
   docker-compose up -d
   ```
3. Start the backend:
   ```bash
   cd backend
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```
4. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### 3. Running Background Workers
To process email sending jobs asynchronously, start a Celery worker:
```bash
cd backend
.\venv\Scripts\activate
celery -A app.core.celery_app worker --loglevel=info -P gevent
```

## Architecture Notes
- The backend relies on an adapter pattern in `app.providers` for easily extending email providers (SMTP, SES, SendGrid).
- Deduplication and validation are decoupled into separate service layers for easy unit testing.
