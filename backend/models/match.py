from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(150), unique=True, index=True)

    tournament_id = Column(
        Integer,
        ForeignKey("tournaments.id"),
        nullable=False,
        index=True,
    )

    match_number = Column(Integer, nullable=False)
    map_name = Column(String(50))

    source_match_id = Column(Integer, nullable=True, index=True)
    day_number = Column(Integer, nullable=True)
    sequence_number = Column(Integer, nullable=True)

    status = Column(String(30), default="scheduled")
    played_at = Column(DateTime)

    tournament = relationship("Tournament")
