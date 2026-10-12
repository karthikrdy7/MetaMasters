from sqlalchemy import inspect, text

from database import engine

new_columns = {
    "source_match_id": "INTEGER",
    "day_number": "INTEGER",
    "sequence_number": "INTEGER",
}

with engine.begin() as connection:
    inspector = inspect(connection)
    existing = {
        column["name"]
        for column in inspector.get_columns("matches")
    }

    for column_name, column_type in new_columns.items():
        if column_name not in existing:
            connection.execute(
                text(
                    f"ALTER TABLE matches "
                    f"ADD COLUMN {column_name} {column_type}"
                )
            )
            print(f"Added column: {column_name}")
        else:
            print(f"Already exists: {column_name}")

print("Migration completed.")
