from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base

class UserModel(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    # Rotated on each login; JWT must carry matching "sid" claim (single active session).
    session_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    

class VideoModel(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    video_url = Column(String, nullable=False)
    thumbnail = Column(String, nullable=True)
    room = Column(String(50), default="general", index=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    # TMDB-backed playlist items (nullable for legacy YouTube-only rows)
    tmdb_id = Column(Integer, nullable=True, index=True)
    media_type = Column(String(10), nullable=True)
    season = Column(Integer, nullable=True)
    episode = Column(Integer, nullable=True)

    