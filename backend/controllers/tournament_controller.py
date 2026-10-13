from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Tournament
from models.match import Match
from models.team import Team
from models.result import MatchResult

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


@router.delete("/{tournament_id}")
def delete_tournament(
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

    try:
        match_ids = [
            row[0]
            for row in db.query(Match.id).filter(
                Match.tournament_id == tournament_id
            ).all()
        ]

        team_ids = [
            row[0]
            for row in db.query(Team.id).filter(
                Team.tournament_id == tournament_id
            ).all()
        ]

        # Delete dependent records before their parent records.
        result_query = db.query(MatchResult)

        if match_ids and team_ids:
            from sqlalchemy import or_
            result_query = result_query.filter(
                or_(
                    MatchResult.match_id.in_(match_ids),
                    MatchResult.team_id.in_(team_ids),
                )
            )
        elif match_ids:
            result_query = result_query.filter(
                MatchResult.match_id.in_(match_ids)
            )
        elif team_ids:
            result_query = result_query.filter(
                MatchResult.team_id.in_(team_ids)
            )
        else:
            result_query = None

        if result_query is not None:
            result_query.delete(synchronize_session=False)

        if match_ids:
            db.query(Match).filter(
                Match.id.in_(match_ids)
            ).delete(synchronize_session=False)

        if team_ids:
            db.query(Team).filter(
                Team.id.in_(team_ids)
            ).delete(synchronize_session=False)

        db.delete(tournament)
        db.commit()

        return {
            "message": "Tournament deleted successfully",
            "tournament_id": tournament_id,
        }

    except Exception:
        db.rollback()
        raise
