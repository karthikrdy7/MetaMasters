from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class MatchResult(Base):
    __tablename__ = "match_results"

    id = Column(Integer, primary_key=True, index=True)

    match_id = Column(
        Integer,
        ForeignKey("matches.id"),
        nullable=False,
        index=True,
    )

    team_id = Column(
        Integer,
        ForeignKey("teams.id"),
        nullable=False,
        index=True,
    )

    placement = Column(Integer)
    eliminations = Column(Integer, default=0)
    placement_points = Column(Integer, default=0)
    total_points = Column(Integer, default=0)

    match = relationship("Match")
    team = relationship("Team")

    __table_args__ = (
        UniqueConstraint(
            "match_id",
            "team_id",
            name="uq_match_team_result",
        ),
    )
