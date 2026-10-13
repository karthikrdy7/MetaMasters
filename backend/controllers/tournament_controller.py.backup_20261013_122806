from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Tournament

router = APIRouter(prefix="/api/tournaments", tags=["Tournaments"])


class TournamentCreate(BaseModel):
    name: str
    slug: str
    game: str = "BGMI"
    status: str = "upcoming"
    total_teams: int = 0


@router.post("/")
def create_tournament(
    data: TournamentCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(Tournament).filter(
        Tournament.slug == data.slug
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Tournament slug already exists",
        )

    tournament = Tournament(**data.model_dump())

    db.add(tournament)
    db.commit()
    db.refresh(tournament)

    return {
        "id": tournament.id,
        "name": tournament.name,
        "slug": tournament.slug,
        "game": tournament.game,
        "status": tournament.status,
        "total_teams": tournament.total_teams,
    }


@router.get("/")
def get_tournaments(db: Session = Depends(get_db)):
    tournaments = db.query(Tournament).order_by(
        Tournament.id.desc()
    ).all()

    return [
        {
            "id": tournament.id,
            "name": tournament.name,
            "slug": tournament.slug,
            "game": tournament.game,
            "status": tournament.status,
            "total_teams": tournament.total_teams,
        }
        for tournament in tournaments
    ]


@router.get("/{tournament_id}")
def get_tournament(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(
        Tournament.id == tournament_id
    ).first()

    if tournament is None:
        raise HTTPException(
            status_code=404,
            detail="Tournament not found",
        )

    return {
        "id": tournament.id,
        "name": tournament.name,
        "slug": tournament.slug,
        "game": tournament.game,
        "status": tournament.status,
        "total_teams": tournament.total_teams,
    }
