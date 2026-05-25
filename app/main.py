"""
AlphaForage — simplified monolith.

Replaces 6 microservices with a single FastAPI app.
Same AI core (multi-agent analysis, SSE streaming, bull/bear, confidence).
No Redis, no Pinecone, no TimescaleDB, no nginx, no Turbo.
Just: FastAPI + SQLite + in-process cache + Polygon/Finnhub + OpenAI.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, market, intelligence, screener
from app.core.database import init_db

app = FastAPI(title="AlphaForage", version="0.1.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # open for local dev; restrict in production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(market.router)
app.include_router(intelligence.router)
app.include_router(screener.router)


@app.on_event("startup")
async def startup():
    await init_db()
    print("[alphaforage] ready on http://localhost:8000")


@app.get("/health")
async def health():
    return {"status": "ok"}
