from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Team, Tournament

router = APIRouter(prefix="/api/teams", tags=["Teams"])


class TeamCreate(BaseModel):
    name: str
    slug: str | None = None
    tournament_id: int


@router.post("/")
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(
        Tournament.id == data.tournament_id
    ).first()

    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    existing = db.query(Team).filter(
        Team.tournament_id == data.tournament_id,
        Team.name == data.name,
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Team already exists in this tournament",
        )

    team = Team(**data.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)

    return {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "tournament_id": team.tournament_id,
    }


@router.get("/")
def get_teams(db: Session = Depends(get_db)):
    teams = db.query(Team).order_by(Team.name).all()

    return [
        {
            "id": team.id,
            "name": team.name,
            "slug": team.slug,
            "tournament_id": team.tournament_id,
        }
        for team in teams
    ]


@router.get("/{team_id}")
def get_team(team_id: int, db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()

    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    return {
        "id": team.id,
        "name": team.name,
        "slug": team.slug,
        "tournament_id": team.tournament_id,
    }
