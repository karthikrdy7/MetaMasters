from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Match, Tournament

router = APIRouter(prefix="/api/matches", tags=["Matches"])


class MatchCreate(BaseModel):
    external_id: str | None = None
    tournament_id: int
    match_number: int = Field(ge=1)
    map_name: str
    status: str = "completed"


@router.post("/")
def create_match(data: MatchCreate, db: Session = Depends(get_db)):
    tournament = db.query(Tournament).filter(
        Tournament.id == data.tournament_id
    ).first()

    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if data.external_id:
        existing = db.query(Match).filter(
            Match.external_id == data.external_id
        ).first()

        if existing:
            raise HTTPException(status_code=409, detail="Match already exists")

    match = Match(**data.model_dump())
    db.add(match)
    db.commit()
    db.refresh(match)

    return {
        "id": match.id,
        "external_id": match.external_id,
        "tournament_id": match.tournament_id,
        "match_number": match.match_number,
        "map_name": match.map_name,
        "status": match.status,
    }


@router.get("/")
def get_matches(db: Session = Depends(get_db)):
    matches = db.query(Match).order_by(
        Match.tournament_id,
        Match.match_number,
    ).all()

    return [
        {
            "id": match.id,
            "external_id": match.external_id,
            "tournament_id": match.tournament_id,
            "match_number": match.match_number,
            "map_name": match.map_name,
            "status": match.status,
            "played_at": match.played_at,
        }
        for match in matches
    ]


@router.get("/{match_id}")
def get_match(match_id: int, db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()

    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    return {
        "id": match.id,
        "external_id": match.external_id,
        "tournament_id": match.tournament_id,
        "match_number": match.match_number,
        "map_name": match.map_name,
        "status": match.status,
        "played_at": match.played_at,
    }
