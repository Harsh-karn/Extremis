from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .api import sender
from .core.rate_limit import limiter
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="extremis API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins_str = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sender.router, prefix="/api/sender", tags=["sender"])

@app.get("/health")
@limiter.limit("10/minute")
async def health_check(request: Request):
    return {"status": "ok"}
