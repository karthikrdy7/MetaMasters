from fastapi import FastAPI

from database import Base, engine
import models

from controllers.team_controller import router as team_router
from controllers.tournament_controller import router as tournament_router
from controllers.match_controller import router as match_router
from controllers.standings_controller import router as standings_router
from controllers.result_controller import router as result_router
from controllers.analytics_controller import router as analytics_router
from controllers.history_controller import router as history_router
from fastapi.middleware.cors import CORSMiddleware
from controllers.import_controller import router as import_router



Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MetaMasters API",
    description="BGMI Esports Analytics and Prediction Platform",
    version="1.0.0",
)

# Register API controllers
app.include_router(tournament_router)
app.include_router(team_router)
app.include_router(match_router)
app.include_router(standings_router)
app.include_router(result_router)
app.include_router(analytics_router)
app.include_router(history_router)
app.include_router(import_router)


@app.get("/")
def home():
    return {
        "project": "MetaMasters",
        "message": "Backend is running!",
        "status": "success",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "tables": list(Base.metadata.tables.keys()),
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)