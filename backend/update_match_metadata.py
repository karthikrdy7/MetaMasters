import pandas as pd

from database import SessionLocal
from models import Tournament, Match

CSV_PATH = "../data/BGMS_FINAL.csv"
TOURNAMENT_SLUG = "bgms-historical-dataset"

df = pd.read_csv(CSV_PATH)

required = {"match_id", "day", "map", "match"}
if not required.issubset(df.columns):
    raise ValueError(f"CSV must contain columns: {sorted(required)}")

groups = (
    df[["match_id", "day", "map", "match"]]
    .drop_duplicates()
    .sort_values(["match_id"])
)

if len(groups) != 18 or groups["match_id"].nunique() != 18:
    raise ValueError("Expected exactly 18 unique source matches.")

db = SessionLocal()

try:
    tournament = db.query(Tournament).filter_by(
        slug=TOURNAMENT_SLUG
    ).first()

    if tournament is None:
        raise ValueError("Historical tournament not found.")

    existing_matches = db.query(Match).filter_by(
        tournament_id=tournament.id
    ).all()

    if len(existing_matches) != 18:
        raise ValueError(
            f"Expected 18 existing matches; found {len(existing_matches)}."
        )

    by_external_id = {
        match.external_id: match for match in existing_matches
    }

    updated = 0

    for row in groups.itertuples(index=False):
        source_id = int(row.match_id)
        day_number = int(row.day)
        map_name = str(row.map).strip()
        match_number = int(row.match)

        external_id = (
            f"bgms-day-{day_number}-match-{match_number}-{map_name}"
        ).lower()

        match_record = by_external_id.get(external_id)

        if match_record is None:
            raise ValueError(
                f"Could not match CSV record to database match: "
                f"{external_id}"
            )

        match_record.source_match_id = source_id
        match_record.day_number = day_number
        match_record.sequence_number = source_id
        match_record.match_number = match_number
        match_record.map_name = map_name
        updated += 1

    db.commit()

    print("Match metadata updated successfully.")
    print(f"Tournament: {tournament.name} (ID: {tournament.id})")
    print(f"Matches updated: {updated}")

except Exception:
    db.rollback()
    raise
finally:
    db.close()
