import csv
import io
import re
import uuid
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import Match, MatchResult, Team, Tournament

router = APIRouter(
    prefix="/api/import",
    tags=["CSV Import"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_ROWS = 100_000

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


def save_imported_csv(
    content: bytes,
    original_filename: str | None,
    tournament_id: int,
) -> str:
    """Archive a successfully imported CSV under a unique filename."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    original_name = Path(original_filename or "import.csv").name
    safe_stem = re.sub(
        r"[^a-zA-Z0-9_-]+",
        "_",
        Path(original_name).stem,
    ).strip("_")

    if not safe_stem:
        safe_stem = "import"

    unique_name = (
        f"tournament_{tournament_id}_"
        f"{safe_stem}_{uuid.uuid4().hex[:12]}.csv"
    )

    destination = UPLOADS_DIR / unique_name

    # Exclusive creation prevents accidentally overwriting another archive.
    with destination.open("xb") as output:
        output.write(content)

    return unique_name


REQUIRED_COLUMNS = {
    "match_id",
    "day",
    "map",
    "match",
    "team_name",
    "team_placement",
    "eliminations",
    "placement_points",
    "total_points",
}
COLUMN_ALIASES = {
    # Match ID
    "match_id": "match_id",
    "matchid": "match_id",
    "match_identifier": "match_id",
    "game_id": "match_id",
    "gameid": "match_id",
    "match_uid": "match_id",
    "match_uuid": "match_id",
    "id": "match_id",

    # Day
    "day": "day",
    "day_number": "day",
    "day_no": "day",
    "day_num": "day",
    "day_id": "day",
    "match_day": "day",
    "matchday": "day",
    "tournament_day": "day",
    "round_day": "day",

    # Map
    "map": "map",
    "map_name": "map",
    "mapname": "map",
    "battle_map": "map",
    "battleground": "map",
    "arena": "map",

    # Match number
    "match": "match",
    "match_number": "match",
    "match_no": "match",
    "match_num": "match",
    "matchname": "match",
    "match_name": "match",
    "game_number": "match",
    "game_no": "match",
    "game_num": "match",
    "round_match": "match",

    # Team name
    "team": "team_name",
    "team_name": "team_name",
    "teamname": "team_name",
    "team_name_": "team_name",
    "squad": "team_name",
    "squad_name": "team_name",
    "squadname": "team_name",
    "clan": "team_name",
    "clan_name": "team_name",
    "organization": "team_name",
    "org": "team_name",
    "team_tag": "team_name",
    "squad_tag": "team_name",

    # Team placement / rank
    "rank": "team_placement",
    "team_rank": "team_placement",
    "position": "team_placement",
    "pos": "team_placement",
    "place": "team_placement",
    "placement": "team_placement",
    "team_placement": "team_placement",
    "placement_rank": "team_placement",
    "final_rank": "team_placement",
    "overall_rank": "team_placement",
    "finish_position": "team_placement",
    "finishing_position": "team_placement",
    "standing": "team_placement",
    "position_points_rank": "team_placement",

    # Eliminations / kill points
    "elim": "eliminations",
    "elims": "eliminations",
    "elim_pts": "eliminations",
    "elim_point": "eliminations",
    "elim_points": "eliminations",
    "elims_pts": "eliminations",
    "elimination": "eliminations",
    "elimination_point": "eliminations",
    "elimination_points": "eliminations",
    "kill": "eliminations",
    "kills": "eliminations",
    "kill_point": "eliminations",
    "kill_points": "eliminations",
    "frag": "eliminations",
    "frags": "eliminations",
    "frag_points": "eliminations",
    "eliminations": "eliminations",
    "elim_count": "eliminations",
    "kill_count": "eliminations",

    # Placement points
    "place_pts": "placement_points",
    "place_point": "placement_points",
    "place_points": "placement_points",
    "placement_point": "placement_points",
    "placement_pts": "placement_points",
    "placement_points": "placement_points",
    "position_points": "placement_points",
    "position_pts": "placement_points",
    "rank_points": "placement_points",
    "survival_points": "placement_points",
    "survival_pts": "placement_points",
    "finish_points": "placement_points",
    "finishing_points": "placement_points",

    # Total points
    "total": "total_points",
    "total_pts": "total_points",
    "total_point": "total_points",
    "total_points": "total_points",
    "total_score": "total_points",
    "total_points_scored": "total_points",
    "points": "total_points",
    "pts": "total_points",
    "overall_points": "total_points",
    "combined_points": "total_points",
    "aggregate_points": "total_points",
    "score": "total_points",

    # Winner / Winner Winner Chicken Dinner
    "wwcd": "wwcd",
    "wwcd_count": "wwcd",
    "winner": "wwcd",
    "is_winner": "wwcd",
    "chicken_dinner": "wwcd",
    "winner_winner_chicken_dinner": "wwcd",
    "won_match": "wwcd",
}

class ImportRequest(BaseModel):
    tournament_id: int | None = Field(default=None, gt=0)
    tournament_name: str | None = Field(default=None, min_length=1, max_length=200)
    tournament_slug: str | None = Field(default=None, min_length=1, max_length=200)
    game: str = Field(default="BGMI", max_length=50)
    create_tournament: bool = False


def normalize_header(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.strip().lower()
    value = re.sub(r"[\s\-]+", "_", value)
    value = re.sub(r"_+", "_", value)

    return COLUMN_ALIASES.get(value, value)


def normalize_team_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def parse_csv(content: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="CSV file exceeds the 10 MB upload limit.",
        )

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="CSV must use UTF-8 encoding.",
        )

    if not text.strip():
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    reader = csv.reader(io.StringIO(text))

    try:
        raw_headers = next(reader)
    except StopIteration:
        raise HTTPException(status_code=400, detail="CSV has no header row.")

    headers = [normalize_header(header) for header in raw_headers]

    if len(headers) != len(set(headers)):
        raise HTTPException(
            status_code=400,
            detail="CSV contains duplicate column names after normalization.",
        )

    header_set = set(headers)

    is_match_table = {
        "match",
        "map",
        "team_placement",
        "team_name",
        "eliminations",
        "placement_points",
        "total_points",
    }.issubset(header_set)

    if not is_match_table:
        missing = REQUIRED_COLUMNS - header_set

        if missing:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Required columns are missing.",
                    "missing_columns": sorted(missing),
                    "received_columns": headers,
                },
            )

    records = []
    errors = []

    for line_number, values in enumerate(reader, start=2):
        if not values or all(not value.strip() for value in values):
            continue

        if len(records) + len(errors) >= MAX_ROWS:
            raise HTTPException(
                status_code=413,
                detail=f"CSV exceeds the maximum of {MAX_ROWS:,} rows.",
            )

        if len(values) != len(headers):
            errors.append({
                "row": line_number,
                "error": (
                    f"Expected {len(headers)} columns, "
                    f"received {len(values)}."
                ),
            })
            continue

        row = dict(zip(headers, values))
        parsed = {}

        try:
            match_label = row.get("match", "").strip()
            team_name = normalize_team_name(row.get("team_name", ""))

            if not match_label:
                raise ValueError("'match' cannot be empty.")

            if not team_name:
                raise ValueError("'team_name' cannot be empty.")

            if not row.get("map", "").strip():
                raise ValueError("'map' cannot be empty.")

            match_match = re.fullmatch(
                r"M(\d+)",
                match_label,
                flags=re.IGNORECASE,
            )

            if is_match_table and match_match:
                match_number = int(match_match.group(1))
                match_id = match_number
            else:
                match_number = int(match_label)

                if is_match_table:
                    match_id = match_number
                else:
                    match_id = int(row["match_id"])

            # Automatically read the day from supported CSV columns.
            day_value = (
                row.get("day")
                or row.get("day_number")
                or row.get("Day")
                or ""
            ).strip()

            if day_value:
                day_match = re.fullmatch(
                    r"(?:Day\s*)?(\d+)",
                    day_value,
                    flags=re.IGNORECASE,
                )

                if not day_match:
                    raise ValueError(
                        f"Invalid day '{day_value}' for match {match_label}."
                    )

                day = int(day_match.group(1))
            else:
                raise ValueError(
                    f"Missing day for match {match_label}. "
                    "Please include a Day column in the CSV."
                ) 
            parsed = {
                "match_id": match_id,
                "day": day,
                "match": match_number,
                "map": row["map"].strip(),
                "team_name": team_name,
                "team_placement": int(row["team_placement"]),
                "eliminations": int(row["eliminations"]),
                "placement_points": int(row["placement_points"]),
                "total_points": int(row["total_points"]),
                "wwcd": None,
                "line_number": line_number,
            }

            if "wwcd" in row and row["wwcd"].strip():
                parsed["wwcd"] = int(row["wwcd"])

                if parsed["wwcd"] not in (0, 1):
                    raise ValueError("'wwcd' must be 0 or 1.")

            for field in (
                "match_id",
                "day",
                "match",
                "team_placement",
                "eliminations",
                "placement_points",
                "total_points",
            ):
                if parsed[field] < 0:
                    raise ValueError(f"'{field}' cannot be negative.")

            if parsed["match_id"] < 1 or parsed["day"] < 1:
                raise ValueError("'match_id' and 'day' must be positive.")

            if parsed["match"] < 1 or parsed["team_placement"] < 1:
                raise ValueError(
                    "'match' and 'team_placement' must be positive."
                )

            if parsed["total_points"] != (
                parsed["eliminations"] + parsed["placement_points"]
            ):
                raise ValueError(
                    "Total points must equal eliminations + placement points."
                )

            records.append(parsed)

        except (ValueError, TypeError) as exc:
            errors.append({
                "row": line_number,
                "team": row.get("team_name", ""),
                "error": str(exc),
            })

    if not records and not errors:
        raise HTTPException(
            status_code=400,
            detail="CSV contains no data rows.",
        )

    # Check WWCD consistency without modifying the uploaded records.
    if is_match_table and all(record["wwcd"] is not None for record in records):
        winners = {}

        for record in records:
            key = (
                record["match_id"],
                record["day"],
                record["map"].casefold(),
                record["match"],
            )
            winners[key] = winners.get(key, 0) + record["wwcd"]

        for key, count in winners.items():
            if count != 1:
                errors.append({
                    "error": (
                        f"Match M{key[3]} must have exactly one WWCD winner; "
                        f"found {count}."
                    ),
                })

    return records, errors

def validate_records(
    records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    errors = []
    valid = []
    seen = set()

    for record in records:
        key = (
            record["match_id"],
            record["day"],
            record["map"].casefold(),
            record["match"],
            record["team_name"].casefold(),
        )

        if key in seen:
            errors.append({
                "row": record["line_number"],
                "team": record["team_name"],
                "error": "Duplicate team record within the uploaded CSV.",
            })
            continue

        seen.add(key)
        valid.append(record)

    return valid, errors


def get_preview(
    records: list[dict[str, Any]],
    errors: list[dict[str, Any]],
) -> dict[str, Any]:
    matches = {
        (
            row["match_id"],
            row["day"],
            row["map"].casefold(),
            row["match"],
        )
        for row in records
    }

    teams = {row["team_name"].casefold() for row in records}

    return {
        "valid": len(errors) == 0 and len(records) > 0,
        "rows_received": len(records) + len(errors),
        "valid_rows": len(records),
        "error_count": len(errors),
        "matches_detected": len(matches),
        "teams_detected": len(teams),
        "preview": [
            {
                "match_id": row["match_id"],
                "day": row["day"],
                "map": row["map"],
                "match": row["match"],
                "team_name": row["team_name"],
                "placement": row["team_placement"],
                "eliminations": row["eliminations"],
                "placement_points": row["placement_points"],
                "total_points": row["total_points"],
            }
            for row in records[:10]
        ],
        "errors": errors[:100],
        "errors_truncated": len(errors) > 100,
    }


async def read_upload(file: UploadFile) -> bytes:
    filename = (file.filename or "").lower()

    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only .csv files are supported.",
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="CSV file exceeds the 10 MB upload limit.",
        )

    return content


@router.post("/preview")
async def preview_csv(file: UploadFile = File(...)):
    content = await read_upload(file)
    records, errors = parse_csv(content)
    records, duplicate_errors = validate_records(records)
    errors.extend(duplicate_errors)

    return get_preview(records, errors)


@router.post("/tournaments/{tournament_id}/preview")
async def preview_csv_for_tournament(
    tournament_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(
        Tournament.id == tournament_id
    ).first()

    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found.")

    content = await read_upload(file)
    records, errors = parse_csv(content)
    records, duplicate_errors = validate_records(records)
    errors.extend(duplicate_errors)

    return {
        "tournament_id": tournament.id,
        "tournament_name": tournament.name,
        **get_preview(records, errors),
    }

@router.post("/import")
async def import_csv(
    file: UploadFile = File(...),
    tournament_id: int | None = None,
    tournament_name: str | None = None,
    tournament_slug: str | None = None,
    game: str = "BGMI",
    db: Session = Depends(get_db),
):
    original_filename = file.filename
    content = await read_upload(file)
    records, errors = parse_csv(content)
    records, duplicate_errors = validate_records(records)
    errors.extend(duplicate_errors)

    if errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Import cancelled because the CSV contains errors.",
                "errors": errors[:100],
                "errors_truncated": len(errors) > 100,
            },
        )

    if not records:
        raise HTTPException(status_code=400, detail="No valid records to import.")

    if tournament_id is None:
        if not tournament_name or not tournament_slug:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Provide tournament_id for an existing tournament, "
                    "or tournament_name and tournament_slug for a new one."
                ),
            )

        tournament_slug = slugify(tournament_slug)

        if not tournament_slug:
            raise HTTPException(
                status_code=400,
                detail="Tournament slug must contain letters or numbers.",
            )

        tournament = db.query(Tournament).filter(
            Tournament.slug == tournament_slug
        ).first()

        if tournament is not None:
            raise HTTPException(
                status_code=409,
                detail="Tournament slug already exists. Select the existing tournament instead.",
            )

        tournament = Tournament(
            name=tournament_name.strip(),
            slug=tournament_slug,
            game=game.strip() or "BGMI",
            status="completed",
            total_teams=0,
        )
        db.add(tournament)
        db.flush()

    else:
        tournament = db.query(Tournament).filter(
            Tournament.id == tournament_id
        ).first()

        if tournament is None:
            raise HTTPException(status_code=404, detail="Tournament not found.")

    # Refuse to mix this import with matches already present.
    existing_matches = db.query(Match.id).filter(
        Match.tournament_id == tournament.id
    ).first()

    if existing_matches is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "This tournament already has matches. "
                "Incremental imports are not enabled yet. "
                "Choose a new tournament or implement a dedicated merge workflow."
            ),
        )

    team_names = {}

    for record in records:
        key = record["team_name"].casefold()

        if key not in team_names:
            team_names[key] = record["team_name"]

    team_map = {}

    try:
        for normalized_name, display_name in team_names.items():
            team = Team(
                name=display_name,
                slug=slugify(display_name),
                tournament_id=tournament.id,
            )
            db.add(team)
            db.flush()
            team_map[normalized_name] = team

        match_map = {}

        unique_matches = {}

        for record in records:
            key = (
                record["match_id"],
                record["day"],
                record["map"].casefold(),
                record["match"],
            )
            unique_matches[key] = record

        ordered_matches = sorted(
            unique_matches.items(),
            key=lambda item: (
                item[1]["day"],
                item[1]["match"],
                item[1]["map"].casefold(),
                item[1]["match_id"],
            ),
        )

        for sequence_number, (key, record) in enumerate(
            ordered_matches,
            start=1,
        ):
            source_match_id, day, map_key, match_number = key

            external_id = (
                f"import-{tournament.id}-"
                f"source-{source_match_id}-day-{day}-"
                f"{map_key}-match-{match_number}"
            )

            match = Match(
                external_id=external_id,
                tournament_id=tournament.id,
                match_number=match_number,
                map_name=record["map"],
                source_match_id=source_match_id,
                day_number=day,
                sequence_number=sequence_number,
                status="completed",
            )

            db.add(match)
            db.flush()
            match_map[key] = match

        for record in records:
            match_key = (
                record["match_id"],
                record["day"],
                record["map"].casefold(),
                record["match"],
            )

            team = team_map[record["team_name"].casefold()]
            match = match_map[match_key]

            db.add(
                MatchResult(
                    match_id=match.id,
                    team_id=team.id,
                    placement=record["team_placement"],
                    eliminations=record["eliminations"],
                    placement_points=record["placement_points"],
                    total_points=record["total_points"],
                )
            )

        tournament.total_teams = len(team_map)

        db.commit()

    except Exception:
        db.rollback()
        raise

    # Archive the source CSV after the database import succeeds.
    try:
        saved_filename = save_imported_csv(
            content=content,
            original_filename=original_filename,
            tournament_id=tournament.id,
        )
    except OSError as exc:
        return {
            "status": "success",
            "message": (
                "CSV imported successfully, but the source file "
                "could not be archived."
            ),
            "archive_status": "failed",
            "archive_error": str(exc),
            "tournament_id": tournament.id,
            "tournament_name": tournament.name,
            "teams_imported": len(team_map),
            "matches_imported": len(match_map),
            "results_imported": len(records),
        }

    return {
        "status": "success",
        "message": "CSV imported and archived successfully.",
        "archive_status": "saved",
        "saved_filename": saved_filename,
        "tournament_id": tournament.id,
        "tournament_name": tournament.name,
        "teams_imported": len(team_map),
        "matches_imported": len(match_map),
        "results_imported": len(records),
    }


@router.get("/tournaments/{tournament_id}/status")
def get_import_status(
    tournament_id: int,
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter(
        Tournament.id == tournament_id
    ).first()

    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found.")

    teams_count = db.query(Team).filter(
        Team.tournament_id == tournament_id
    ).count()

    matches_count = db.query(Match).filter(
        Match.tournament_id == tournament_id
    ).count()

    results_count = (
        db.query(MatchResult)
        .join(Match, Match.id == MatchResult.match_id)
        .filter(Match.tournament_id == tournament_id)
        .count()
    )

    return {
        "tournament_id": tournament.id,
        "tournament_name": tournament.name,
        "teams": teams_count,
        "matches": matches_count,
        "results": results_count,
    }