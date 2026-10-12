from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Tournament, Team, Match, MatchResult

router = APIRouter(
    prefix="/api/tournaments",
    tags=["Match History"],
)


@router.get("/{tournament_id}/history")
def get_match_history(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(
        Tournament.id == tournament_id
    ).first()

    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    matches = (
        db.query(Match)
        .filter(Match.tournament_id == tournament_id)
        .order_by(Match.sequence_number.asc(), Match.id.asc())
        .all()
    )

    history = []

    for match in matches:
        results = (
            db.query(MatchResult, Team)
            .join(Team, Team.id == MatchResult.team_id)
            .filter(MatchResult.match_id == match.id)
            .order_by(MatchResult.placement.asc(), Team.name.asc())
            .all()
        )

        history.append({
            "match_id": match.id,
            "source_match_id": match.source_match_id,
            "sequence_number": match.sequence_number,
            "day": match.day_number,
            "map": match.map_name,
            "match_number": match.match_number,
            "teams_count": len(results),
            "results": [
                {
                    "team_id": team.id,
                    "team_name": team.name,
                    "placement": result.placement,
                    "eliminations": result.eliminations,
                    "placement_points": result.placement_points,
                    "total_points": result.total_points,
                }
                for result, team in results
            ],
        })

    return {
        "tournament": tournament.name,
        "tournament_id": tournament_id,
        "matches_count": len(history),
        "matches": history,
    }


@router.get("/{tournament_id}/history/teams/{team_id}")
def get_team_match_history(
    tournament_id: int,
    team_id: int,
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(
        Tournament.id == tournament_id
    ).first()

    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    team = db.query(Team).filter(
        Team.id == team_id,
        Team.tournament_id == tournament_id,
    ).first()

    if team is None:
        raise HTTPException(
            status_code=404,
            detail="Team not found in this tournament",
        )

    rows = (
        db.query(MatchResult, Match)
        .join(Match, Match.id == MatchResult.match_id)
        .filter(
            MatchResult.team_id == team_id,
            Match.tournament_id == tournament_id,
        )
        .order_by(Match.sequence_number.asc(), Match.id.asc())
        .all()
    )

    matches = [
        {
            "match_id": match.id,
            "source_match_id": match.source_match_id,
            "sequence_number": match.sequence_number,
            "day": match.day_number,
            "map": match.map_name,
            "match_number": match.match_number,
            "placement": result.placement,
            "eliminations": result.eliminations,
            "placement_points": result.placement_points,
            "total_points": result.total_points,
        }
        for result, match in rows
    ]

    return {
        "tournament": tournament.name,
        "team_id": team.id,
        "team_name": team.name,
        "matches_played": len(matches),
        "matches": matches,
    }
