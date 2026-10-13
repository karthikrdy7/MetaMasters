import csv
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "meta_masters.db"
CSV = ROOT / "backend" / "uploads" / (
    "tournament_1_bmsd_2026_all_match_data_M1-M18_"
    "with_maps_and_days_e4c63b2b7afb.csv"
)

# Read and validate the source mapping.
with CSV.open(newline="", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

mapping = {}

for row in rows:
    match = re.fullmatch(r"M(\d+)", row["Match"].strip(), re.I)
    day = re.fullmatch(r"Day\s*(\d+)", row["Day"].strip(), re.I)

    if not match or not day:
        raise ValueError(f"Invalid match/day: {row}")

    number = int(match.group(1))
    day_number = int(day.group(1))
    map_name = row["Map"].strip().casefold()

    if number in mapping:
        old_day, old_map = mapping[number]
        if (old_day, old_map) != (day_number, map_name):
            raise ValueError(f"Inconsistent source data for M{number}")
    else:
        mapping[number] = (day_number, map_name)

if set(mapping) != set(range(1, 19)):
    raise ValueError("Source must contain M1 through M18.")

if {d: sum(1 for day, _ in mapping.values() if day == d)
    for d in (1, 2, 3)} != {1: 6, 2: 6, 3: 6}:
    raise ValueError("Unexpected day mapping.")

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

try:
    tournament = conn.execute(
        "SELECT id, name FROM tournaments WHERE id = 1"
    ).fetchone()

    if not tournament:
        raise ValueError("Tournament ID 1 was not found.")

    matches = conn.execute(
        """
        SELECT id, match_number, map_name
        FROM matches
        WHERE tournament_id = 1
        ORDER BY match_number
        """
    ).fetchall()

    if len(matches) != 18:
        raise ValueError(f"Expected 18 matches, found {len(matches)}.")

    # Validate every match and map before writing anything.
    for m in matches:
        number = int(m["match_number"])
        if number not in mapping:
            raise ValueError(f"Unexpected database match M{number}.")

        expected_day, expected_map = mapping[number]
        actual_map = (m["map_name"] or "").strip().casefold()

        if actual_map != expected_map:
            raise ValueError(
                f"Map mismatch for M{number}: "
                f"database={actual_map}, CSV={expected_map}. "
                "No changes made."
            )

    with conn:
        for m in matches:
            number = int(m["match_number"])
            day, _ = mapping[number]
            conn.execute(
                """
                UPDATE matches
                SET day_number = ?, sequence_number = ?
                WHERE id = ? AND tournament_id = 1
                """,
                (day, number, m["id"]),
            )

    print(f"Updated {len(matches)} matches in {tournament['name']}.")
    for day in (1, 2, 3):
        count = sum(1 for d, _ in mapping.values() if d == day)
        print(f"Day {day}: {count} matches")

finally:
    conn.close()
