from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Tournament, Team, Match, MatchResult

router = APIRouter(prefix="/api/standings", tags=["Standings"])


@router.get("/{tournament_id}")
def get_standings(
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

    results = (
        db.query(
            Team.id.label("team_id"),
            Team.name.label("team_name"),
            func.coalesce(func.sum(MatchResult.eliminations), 0).label(
                "total_eliminations"
            ),
            func.coalesce(func.sum(MatchResult.placement_points), 0).label(
                "total_placement_points"
            ),
            func.coalesce(func.sum(MatchResult.total_points), 0).label(
                "total_points"
            ),
            func.count(MatchResult.id).label("matches_played"),
        )
        .outerjoin(
            MatchResult,
            MatchResult.team_id == Team.id,
        )
        .outerjoin(
            Match,
            Match.id == MatchResult.match_id,
        )
        .filter(Team.tournament_id == tournament_id)
        .filter(
            (Match.id.is_(None)) |
            (Match.tournament_id == tournament_id)
        )
        .group_by(Team.id, Team.name)
        .order_by(
            func.coalesce(func.sum(MatchResult.total_points), 0).desc(),
            func.coalesce(func.sum(MatchResult.eliminations), 0).desc(),
            Team.name.asc(),
        )
        .all()
    )

    return {
        "tournament": tournament.name,
        "standings": [
            {
                "rank": rank,
                "team_id": row.team_id,
                "team_name": row.team_name,
                "matches_played": row.matches_played,
                "eliminations": row.total_eliminations,
                "placement_points": row.total_placement_points,
                "total_points": row.total_points,
            }
            for rank, row in enumerate(results, start=1)
        ],
    }
