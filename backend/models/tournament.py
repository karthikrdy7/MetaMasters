from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    game = Column(String(50), default="BGMI")
    status = Column(String(30), default="upcoming")
    total_teams = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
