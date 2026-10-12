from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Match, MatchResult, Team

router = APIRouter(prefix="/api/results", tags=["Match Results"])


class ResultCreate(BaseModel):
    match_id: int
    team_id: int
    placement: int | None = Field(default=None, ge=1)
    eliminations: int = Field(default=0, ge=0)
    placement_points: int = Field(default=0, ge=0)
    total_points: int = Field(ge=0)


@router.post("/")
def create_result(data: ResultCreate, db: Session = Depends(get_db)):
    match = db.query(Match).filter(
        Match.id == data.match_id
    ).first()

    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    team = db.query(Team).filter(
        Team.id == data.team_id
    ).first()

    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.tournament_id != match.tournament_id:
        raise HTTPException(
            status_code=400,
            detail="Team and match must belong to the same tournament",
        )

    existing = db.query(MatchResult).filter(
        MatchResult.match_id == data.match_id,
        MatchResult.team_id == data.team_id,
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="A result already exists for this team and match",
        )

    result = MatchResult(**data.model_dump())
    db.add(result)
    db.commit()
    db.refresh(result)

    return {
        "id": result.id,
        "match_id": result.match_id,
        "team_id": result.team_id,
        "placement": result.placement,
        "eliminations": result.eliminations,
        "placement_points": result.placement_points,
        "total_points": result.total_points,
    }


@router.get("/")
def get_results(db: Session = Depends(get_db)):
    results = db.query(MatchResult).order_by(
        MatchResult.match_id,
        MatchResult.total_points.desc(),
    ).all()

    return [
        {
            "id": result.id,
            "match_id": result.match_id,
            "team_id": result.team_id,
            "placement": result.placement,
            "eliminations": result.eliminations,
            "placement_points": result.placement_points,
            "total_points": result.total_points,
        }
        for result in results
    ]
