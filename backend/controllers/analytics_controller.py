from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Tournament, Team, Match, MatchResult

router = APIRouter(
    prefix="/api/analytics",
    tags=["Team Analytics"],
)


def calculate_team_analytics(
    tournament_id: int,
    team: Team,
    db: Session,
):
    """Calculate historical performance and recent form for one team."""

    results = (
        db.query(MatchResult, Match)
        .join(Match, Match.id == MatchResult.match_id)
        .filter(
            MatchResult.team_id == team.id,
            Match.tournament_id == tournament_id,
        )
        .order_by(
            Match.sequence_number.asc().nullslast(),
            Match.id.asc(),
        )
        .all()
    )

    points = [
        result.total_points
        for result, _ in results
    ]

    eliminations = [
        result.eliminations or 0
        for result, _ in results
    ]

    placement_points = [
        result.placement_points or 0
        for result, _ in results
    ]

    placements = [
        result.placement
        for result, _ in results
        if result.placement is not None
    ]

    matches_played = len(results)

    total_points = sum(points)
    total_eliminations = sum(eliminations)
    total_placement_points = sum(placement_points)

    last_3 = points[-3:]
    last_5 = points[-5:]

    return {
        "team_id": team.id,
        "team_name": team.name,
        "matches_played": matches_played,
        "total_points": total_points,
        "total_eliminations": total_eliminations,
        "total_placement_points": total_placement_points,
        "average_points_per_match": round(
            total_points / matches_played, 2
        ) if matches_played else 0,
        "average_eliminations_per_match": round(
            total_eliminations / matches_played, 2
        ) if matches_played else 0,
        "average_placement": round(
            sum(placements) / len(placements), 2
        ) if placements else None,
        "best_placement": min(placements) if placements else None,
        "first_place_finishes": sum(
            1 for placement in placements if placement == 1
        ),
        "last_3_matches_points": sum(last_3),
        "last_5_matches_points": sum(last_5),
        "average_points_last_3": round(
            sum(last_3) / len(last_3), 2
        ) if last_3 else 0,
        "average_points_last_5": round(
            sum(last_5) / len(last_5), 2
        ) if last_5 else 0,
    }


@router.get("/{tournament_id}/teams")
def get_team_analytics(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    """Return ranked performance analytics for every tournament team."""

    tournament = (
        db.query(Tournament)
        .filter(Tournament.id == tournament_id)
        .first()
    )

    if tournament is None:
        raise HTTPException(
            status_code=404,
            detail="Tournament not found",
        )

    teams = (
        db.query(Team)
        .filter(Team.tournament_id == tournament_id)
        .order_by(Team.name.asc())
        .all()
    )

    analytics = [
        calculate_team_analytics(
            tournament_id=tournament_id,
            team=team,
            db=db,
        )
        for team in teams
    ]

    analytics.sort(
        key=lambda item: (
            item["total_points"],
            item["total_eliminations"],
            item["team_name"].lower(),
        ),
        reverse=True,
    )

    for rank, item in enumerate(analytics, start=1):
        item["rank"] = rank

    return {
        "tournament": tournament.name,
        "tournament_id": tournament_id,
        "teams_analyzed": len(analytics),
        "analytics": analytics,
    }


@router.get("/{tournament_id}/teams/{team_id}")
def get_single_team_analytics(
    tournament_id: int,
    team_id: int,
    db: Session = Depends(get_db),
):
    """Return analytics for one team in a tournament."""

    tournament = (
        db.query(Tournament)
        .filter(Tournament.id == tournament_id)
        .first()
    )

    if tournament is None:
        raise HTTPException(
            status_code=404,
            detail="Tournament not found",
        )

    team = (
        db.query(Team)
        .filter(
            Team.id == team_id,
            Team.tournament_id == tournament_id,
        )
        .first()
    )

    if team is None:
        raise HTTPException(
            status_code=404,
            detail="Team not found in this tournament",
        )

    return {
        "tournament": tournament.name,
        "team": calculate_team_analytics(
            tournament_id=tournament_id,
            team=team,
            db=db,
        ),
    }
