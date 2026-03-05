from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=5,
    max_overflow=2,
    pool_timeout=30,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()