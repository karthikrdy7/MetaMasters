import csv
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# ============================================================
# CONFIGURATION
# ============================================================

BASE = "https://www.andern.live"
TOURNAMENT = "bmsd-2026-last-chance"

ROOT = f"{BASE}/{TOURNAMENT}"
MATCH_LIST_URL = f"{ROOT}/all-matches"

OUT = Path("data")
OUT.mkdir(parents=True, exist_ok=True)

DB_PATH = OUT / "meta_masters.db"

POLL_SECONDS = 1
REQUEST_DELAY = 0.2
MAX_RUNS = 5
MIN_TEAMS = 10

HEADERS = {
    "User-Agent": "Mozilla/5.0 MetaMasters student project"
}

session = requests.Session()
session.headers.update(HEADERS)


# ============================================================
# UTILITIES
# ============================================================

def now_utc():
    return datetime.now(timezone.utc).isoformat()


def get_soup(url):
    """Fetch a webpage and parse its HTML."""
    response = session.get(url, timeout=25)
    response.raise_for_status()

    return BeautifulSoup(response.text, "html.parser")


# ============================================================
# DATABASE
# ============================================================

def init_db(con):
    """Create the SQLite tables if they do not exist."""

    con.executescript("""
        CREATE TABLE IF NOT EXISTS matches (
            match_id TEXT PRIMARY KEY,
            day INTEGER,
            match_no INTEGER,
            map TEXT,
            url TEXT
        );

        CREATE TABLE IF NOT EXISTS results (
            match_id TEXT,
            team TEXT,
            rank INTEGER,
            finish INTEGER,
            placement_pts INTEGER,
            total INTEGER,
            updated_at TEXT,
            PRIMARY KEY (match_id, team)
        );

        CREATE TABLE IF NOT EXISTS result_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            match_id TEXT,
            team TEXT,
            rank INTEGER,
            finish INTEGER,
            placement_pts INTEGER,
            total INTEGER,
            fetched_at TEXT
        );
    """)

    con.commit()


# ============================================================
# MATCH DISCOVERY
# ============================================================

def discover_matches(soup):
    """
    Discover match-detail URLs exposed by the actual page.

    Expected slug pattern:
        day1-match1
        day1-match2
        ...
        day2-match6

    No URLs are fabricated.
    """

    found = {}

    for a in soup.find_all("a", href=True):

        href = a["href"]

        if "/match-details/" not in href:
            continue

        url = urljoin(ROOT + "/", href)
        slug = url.rstrip("/").split("/")[-1]

        match = re.search(
            r"day(\d+)-match(\d+)",
            slug,
            flags=re.IGNORECASE
        )

        if not match:
            continue

        day, match_no = map(int, match.groups())

        # This tournament has two days and six matches per day.
        if day not in (1, 2):
            continue

        if match_no not in range(1, 7):
            continue

        text = a.get_text(" ", strip=True)

        map_match = re.search(
            r"\b(Rondo|Erangel|Miramar)\b",
            text,
            flags=re.IGNORECASE
        )

        map_name = (
            map_match.group(1).title()
            if map_match
            else None
        )

        match_id = (
            f"{TOURNAMENT}:day{day}-match{match_no}"
        )

        found[match_id] = {
            "match_id": match_id,
            "day": day,
            "match_no": match_no,
            "map": map_name,
            "url": url
        }

    return sorted(
        found.values(),
        key=lambda item: (
            item["day"],
            item["match_no"]
        )
    )


# ============================================================
# POINTS TABLE PARSING
# ============================================================

def parse_points_table(soup):
    """
    Parse an actual HTML table.

    Expected columns:
        Rank | Team | ... | Finish | Pos | Total

    The parser does not guess scores from concatenated digits.
    """

    rows = []

    for table in soup.find_all("table"):

        for tr in table.find_all("tr"):

            cells = tr.find_all(
                ["th", "td"],
                recursive=False
            )

            values = [
                cell.get_text(" ", strip=True)
                for cell in cells
            ]

            if len(values) < 5:
                continue

            # Ignore table headers.
            try:
                rank = int(values[0])
                finish = int(values[-3])
                placement = int(values[-2])
                total = int(values[-1])

            except (ValueError, IndexError):
                continue

            team = values[1].strip()

            if not team:
                continue

            # Validate the scoring relationship.
            if finish + placement != total:
                continue

            rows.append({
                "rank": rank,
                "team": team,
                "finish": finish,
                "placement_pts": placement,
                "total": total
            })

        if rows:
            break

    # Never accept an incomplete table.
    if len(rows) < MIN_TEAMS:
        return []

    return rows


# ============================================================
# SAVE MATCH RESULTS
# ============================================================

def save_match(con, match, rows, fetched_at):
    """Update current results and append historical snapshots."""

    with con:

        con.execute("""
            INSERT INTO matches (
                match_id,
                day,
                match_no,
                map,
                url
            )
            VALUES (?, ?, ?, ?, ?)

            ON CONFLICT(match_id) DO UPDATE SET
                day = excluded.day,
                match_no = excluded.match_no,
                map = COALESCE(excluded.map, matches.map),
                url = excluded.url
        """, (
            match["match_id"],
            match["day"],
            match["match_no"],
            match["map"],
            match["url"]
        ))

        for row in rows:

            values = (
                match["match_id"],
                row["team"],
                row["rank"],
                row["finish"],
                row["placement_pts"],
                row["total"]
            )

            # Latest result for each team and match.
            con.execute("""
                INSERT INTO results (
                    match_id,
                    team,
                    rank,
                    finish,
                    placement_pts,
                    total,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)

                ON CONFLICT(match_id, team) DO UPDATE SET
                    rank = excluded.rank,
                    finish = excluded.finish,
                    placement_pts = excluded.placement_pts,
                    total = excluded.total,
                    updated_at = excluded.updated_at
            """, values + (fetched_at,))

            # Append historical snapshot.
            con.execute("""
                INSERT INTO result_snapshots (
                    match_id,
                    team,
                    rank,
                    finish,
                    placement_pts,
                    total,
                    fetched_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, values + (fetched_at,))


# ============================================================
# CSV EXPORT
# ============================================================

def export_csv(con):
    """Export the current results, history, and match list."""

    exports = {

        "match_results.csv": """
            SELECT
                m.day,
                m.match_no,
                m.map,
                r.team,
                r.rank,
                r.finish,
                r.placement_pts,
                r.total,
                r.updated_at

            FROM results r
            JOIN matches m USING(match_id)

            ORDER BY
                m.day,
                m.match_no,
                r.rank
        """,

        "score_history.csv": """
            SELECT
                m.day,
                m.match_no,
                m.map,
                s.team,
                s.rank,
                s.finish,
                s.placement_pts,
                s.total,
                s.fetched_at

            FROM result_snapshots s
            JOIN matches m USING(match_id)

            ORDER BY
                s.fetched_at,
                m.day,
                m.match_no,
                s.rank
        """,

        "matches.csv": """
            SELECT
                day,
                match_no,
                map,
                url

            FROM matches

            ORDER BY day, match_no
        """
    }

    for filename, query in exports.items():

        cursor = con.execute(query)

        headers = [
            column[0]
            for column in cursor.description
        ]

        output_file = OUT / filename

        with output_file.open(
            "w",
            newline="",
            encoding="utf-8"
        ) as file:

            writer = csv.writer(file)
            writer.writerow(headers)
            writer.writerows(cursor.fetchall())

        print(f"Exported: {output_file}")


# ============================================================
# ONE COLLECTION ATTEMPT
# ============================================================

def run_once(con):

    print(f"\n[{now_utc()}] Checking Andern...")

    # Fetch the match listing.
    try:
        soup = get_soup(MATCH_LIST_URL)

    except requests.RequestException as error:
        print(f"Could not fetch match list: {error}")
        return

    # Discover actual match URLs.
    matches = discover_matches(soup)

    print(f"Discovered {len(matches)} match links")

    if not matches:
        print(
            "No matching links found. "
            "Inspect the actual HTML or browser Network response."
        )
        return

    valid_matches = 0

    # Process the discovered match pages.
    for match in matches:

        time.sleep(REQUEST_DELAY)

        try:
            match_soup = get_soup(match["url"])

        except requests.RequestException as error:
            print(
                f"Fetch failed for "
                f"{match['match_id']}: {error}"
            )
            continue

        rows = parse_points_table(match_soup)

        if not rows:
            print(
                f"Skipped {match['match_id']}: "
                "no valid points table found"
            )
            continue

        fetched_at = now_utc()

        save_match(
            con,
            match,
            rows,
            fetched_at
        )

        valid_matches += 1

        print(
            f"Saved {match['match_id']}: "
            f"{len(rows)} teams"
        )

    # Export even if some match pages failed.
    export_csv(con)

    print(
        f"Completed collection attempt: "
        f"{valid_matches} matches updated."
    )


# ============================================================
# MAIN: RUN FIVE TIMES
# ============================================================
def main():
    print("MetaMasters — Andern Live Collector")
    print("Polling interval: 1 second")
    print("Press Ctrl+C to stop.\n")

    con = sqlite3.connect(DB_PATH)

    try:
        init_db(con)

        while True:
            started = time.monotonic()

            try:
                run_once(con)

            except requests.RequestException as error:
                print(f"Network error: {error}")

            except sqlite3.Error as error:
                print(f"Database error: {error}")

            except Exception as error:
                print(f"Collection error: {error}")

            elapsed = time.monotonic() - started
            remaining = max(0, POLL_SECONDS - elapsed)

            print(
                f"Cycle finished in {elapsed:.2f}s. "
                f"Next cycle in {remaining:.2f}s."
            )

            time.sleep(remaining)

    except KeyboardInterrupt:
        print("\nCollector stopped by user.")

    finally:
        con.close()
        print("Database connection closed.")


if __name__ == "__main__":
    main()