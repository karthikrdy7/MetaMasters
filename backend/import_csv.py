import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal
from models import Tournament, Team, Match, MatchResult

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "data" / "BGMS_FINAL.csv"

TOURNAMENT_NAME = "BGMS Historical Dataset"
TOURNAMENT_SLUG = "bgms-historical-dataset"


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [
        str(column).strip().lower().replace(" ", "_")
        for column in df.columns
    ]

    aliases = {
        "team": "team_name",
        "teamname": "team_name",
        "elim_points": "eliminations",
        "elimination_points": "eliminations",
        "total": "total_points",
    }

    return df.rename(columns={
        column: aliases[column]
        for column in df.columns
        if column in aliases
    })


def main():
    if not CSV_PATH.exists():
        sys.exit(f"CSV file not found: {CSV_PATH}")

    df = normalize_columns(pd.read_csv(CSV_PATH))

    required = {
        "day",
        "map",
        "match",
        "team_name",
        "team_placement",
        "eliminations",
        "placement_points",
        "total_points",
    }

    missing = required - set(df.columns)
    if missing:
        sys.exit(f"Missing required columns: {sorted(missing)}")

    if df[list(required)].isnull().any().any():
        sys.exit("Required columns contain missing values; import cancelled.")

    numeric_columns = [
        "day",
        "match",
        "team_placement",
        "eliminations",
        "placement_points",
        "total_points",
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="raise")

    if (df[numeric_columns] < 0).any().any():
        sys.exit("Negative values found in numeric columns; import cancelled.")

    if df.duplicated(subset=["day", "map", "match", "team_name"]).any():
        sys.exit("Duplicate team-match records found; import cancelled.")

    # BGMI total points should equal eliminations plus placement points.
    if not (
        df["total_points"]
        == df["eliminations"] + df["placement_points"]
    ).all():
        sys.exit(
            "Some total points do not equal eliminations + placement points. "
            "Review the CSV before importing."
        )

    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    try:
        tournament = db.query(Tournament).filter_by(
            slug=TOURNAMENT_SLUG
        ).first()

        if tournament is None:
            tournament = Tournament(
                name=TOURNAMENT_NAME,
                slug=TOURNAMENT_SLUG,
                game="BGMI",
                status="completed",
                total_teams=int(df["team_name"].nunique()),
            )
            db.add(tournament)
            db.flush()

        # Refuse to silently mix or duplicate an existing import.
        if db.query(Match).filter_by(
            tournament_id=tournament.id
        ).first():
            sys.exit(
                "Historical tournament already contains matches. "
                "No data was imported. Inspect the database before retrying."
            )

        team_map = {}

        for team_name in sorted(df["team_name"].unique()):
            team = Team(
                name=str(team_name).strip(),
                slug=str(team_name).strip().lower().replace(" ", "-"),
                tournament_id=tournament.id,
            )
            db.add(team)
            db.flush()
            team_map[team_name] = team

        match_map = {}

        match_groups = df[
            ["day", "map", "match"]
        ].drop_duplicates().sort_values(["day", "match", "map"])

        for row in match_groups.itertuples(index=False):
            external_id = f"bgms-day-{row.day}-match-{row.match}-{row.map}".lower()

            match = Match(
                external_id=external_id,
                tournament_id=tournament.id,
                match_number=int(row.match),
                map_name=str(row.map),
                status="completed",
            )
            db.add(match)
            db.flush()
            match_map[(row.day, row.map, row.match)] = match

        for row in df.itertuples(index=False):
            match = match_map[(row.day, row.map, row.match)]
            team = team_map[row.team_name]

            result = MatchResult(
                match_id=match.id,
                team_id=team.id,
                placement=int(row.team_placement),
                eliminations=int(row.eliminations),
                placement_points=int(row.placement_points),
                total_points=int(row.total_points),
            )
            db.add(result)

        db.commit()

        print("Historical data imported successfully!")
        print(f"Tournament: {tournament.name} (ID: {tournament.id})")
        print(f"Teams: {len(team_map)}")
        print(f"Matches: {len(match_map)}")
        print(f"Match results: {len(df)}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
