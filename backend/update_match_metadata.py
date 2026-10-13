from pathlib import Path

import pandas as pd

from database import SessionLocal
from models import Tournament, Match

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = PROJECT_ROOT / "data" / "BGMS_FINAL.csv"

TOURNAMENT_ID = 2

df = pd.read_csv(CSV_PATH)

required = {"match_id", "day", "map", "match"}
if not required.issubset(df.columns):
    raise ValueError(f"CSV must contain columns: {sorted(required)}")

groups = (
    df[["match_id", "day", "map", "match"]]
    .drop_duplicates()
    .sort_values("match_id")
    .reset_index(drop=True)
)

if len(groups) != 18 or groups["match_id"].nunique() != 18:
    raise ValueError("Expected exactly 18 unique source matches.")

db = SessionLocal()

try:
    tournament = db.query(Tournament).filter_by(
        id=TOURNAMENT_ID
    ).first()

    if tournament is None:
        raise ValueError(f"Tournament ID {TOURNAMENT_ID} not found.")

    existing_matches = db.query(Match).filter_by(
        tournament_id=tournament.id
    ).all()

    if len(existing_matches) != 18:
        raise ValueError(
            f"Expected 18 matches; found {len(existing_matches)}."
        )

    by_number = {}

    for record in existing_matches:
        if record.match_number in by_number:
            raise ValueError(
                f"Duplicate match number: {record.match_number}"
            )
        by_number[record.match_number] = record

    if set(by_number) != set(range(1, 19)):
        raise ValueError("Database match numbers must be 1 through 18.")

    # Validate all matches before changing any records.
    updates = []

    for row in groups.itertuples(index=False):
        source_id = int(row.match_id)
        day_number = int(row.day)
        map_name = str(row.map).strip()
        match_number = int(row.match)

        record = by_number.get(source_id)

        if record is None:
            raise ValueError(f"Database match M{source_id} not found.")

        if (record.map_name or "").strip().lower() != map_name.lower():
            raise ValueError(
                f"Map mismatch for M{source_id}: "
                f"database={record.map_name!r}, CSV={map_name!r}"
            )

        updates.append((record, source_id, day_number, match_number))

    for record, source_id, day_number, match_number in updates:
        record.source_match_id = source_id
        record.day_number = day_number
        record.sequence_number = source_id
        record.match_number = match_number

    db.commit()

    print("Match metadata updated successfully!")
    print(f"Tournament: {tournament.name} (ID: {tournament.id})")
    print(f"Matches updated: {len(updates)}")

    for record, source_id, day_number, match_number in updates:
        print(
            f"M{source_id} | Day {day_number} | "
            f"Match {match_number} | {record.map_name}"
        )

except Exception:
    db.rollback()
    raise
finally:
    db.close()