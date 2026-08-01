# Extremis

Extremis is a lightweight, single-page web application for sending personalized bulk emails directly from your Gmail account without the complexity of traditional ESPs.

## Features

- **Direct SMTP Integration**: Sends directly through your personal or Workspace Gmail account using an App Password.
- **CSV & Excel Uploads**: Instantly parses recipient data in the browser.
- **Live Variable Replacement**: Use column names as variables (e.g., `{{Name}}` or `{{Company}}`) in your subject line and email body.
- **Real-Time Progress**: Watch emails send in real-time with success/failure statuses.
- **Privacy-First**: No database, no queueing, no tracking. Your credentials and recipient lists are kept in memory and never saved to a database.

## Architecture

- **Frontend**: Next.js, React, Tailwind CSS, shadcn/ui.
- **Backend**: FastAPI (Python), Pandas (for robust CSV/Excel parsing), SlowAPI (rate limiting).

## Getting Started

### Prerequisites

- Node.js
- Python 3.9+
- A Google Account with 2-Step Verification enabled and an [App Password](https://myaccount.google.com/apppasswords) created.

### 1. Setup Backend (API)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Create a .env file and generate an API_KEY
cp .env.example .env
```

Start the FastAPI server:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Setup Frontend

```bash
cd frontend
npm install

# Create a .env.local file to point to your backend API key and URL
cp .env.local.example .env.local
```

Start the Next.js development server:
```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Security

Extremis includes built-in rate limiting and API key verification on all backend endpoints. Ensure you properly configure your `API_KEY` in `backend/.env` and `NEXT_PUBLIC_API_KEY` in `frontend/.env.local`.

For production deployment, it is highly recommended to place both the frontend and backend behind a reverse proxy (like Caddy or Nginx) with Basic Authentication, ensuring your API endpoint is not publicly accessible to anyone on the internet.

## Limitations

- **Gmail Sending Limits**: Standard Gmail accounts are limited to ~500 emails per rolling 24 hours. Google Workspace accounts are typically limited to ~2,000. Extremis does not override or bypass these limits.
- **Synchronous Sending**: Emails are sent synchronously during the API request. Closing the browser tab will stop the remaining emails from sending.

## License

MIT License. See `LICENSE` for more information.
