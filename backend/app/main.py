from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import recipients, templates, providers, campaigns, stats

app = FastAPI(title="MailForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(recipients.router, prefix="/api/recipients", tags=["recipients"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
