from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
import os

# 1. SET ENVIRONMENT VARIABLES BEFORE ANY APP IMPORTS
os.environ["PUBSUB_EMULATOR_HOST"] = "localhost:8085"
os.environ["GCP_PROJECT_ID"] = "test-project"
os.environ["JWT_SECRET"] = "supersecret_test_key_that_is_at_least_32_characters_long"
os.environ["GOOGLE_CLIENT_ID"] = "test-google-client-id"

# Ensure we have a default DATABASE_URL if none is set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/watchparty"

from app.main import app
from app.api.routes import get_db
from app.api.auth import get_db as auth_get_db
from app.repository.database import Base

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool, 
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(autouse=True)
def mock_external_io(monkeypatch):
    """
    Automatically applied to ALL tests. 
    Prevents GitHub Actions from being rate-limited by YouTube.
    """
    # Mock the scraper
    def fake_fetch_metadata(url):
        return {"title": "Mocked CI Video", "thumbnail": "https://via.placeholder.com/150"}
    
    monkeypatch.setattr("app.service.video_service.fetch_video_metadata", fake_fetch_metadata)

    # Optional: Mock the publisher to avoid Pub/Sub connectivity issues in unit tests
    # Note: Integration tests can still use patch or manually override this if they want real Pub/Sub logic
    mock_pub = MagicMock()
    monkeypatch.setattr("app.pubsub.gcp_publisher.GCPPubSubPublisher", lambda *args, **kwargs: mock_pub)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def db_session():
    """
    Returns a fresh database session for SQLite memory DB.
    """
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Force FastAPI to use the test database for both route modules
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[auth_get_db] = override_get_db


@pytest.fixture
def postgres_api_client():
    """
    TestClient with route + auth DB deps bound to SessionLocal (DATABASE_URL).
    Use with @pytest.mark.integration when exercising HTTP against Postgres.
    Restores SQLite overrides after the test.
    """
    from fastapi.testclient import TestClient
    from app.main import app
    from app.repository.database import SessionLocal

    def pg_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = pg_get_db
    app.dependency_overrides[auth_get_db] = pg_get_db
    yield TestClient(app)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[auth_get_db] = override_get_db


@pytest.fixture
def integration_user_headers():
    """JWT for integration_test_user; row is upserted in DATABASE_URL."""
    from app.repository.database import SessionLocal
    from app.repository.models import UserModel
    from app.api.auth import hash_password, create_token

    sid = "integration-test-session-id-fixed-1"
    db = SessionLocal()
    try:
        u = (
            db.query(UserModel)
            .filter(UserModel.username == "integration_test_user")
            .first()
        )
        if not u:
            u = UserModel(
                username="integration_test_user",
                email="integration@test.dev",
                hashed_password=hash_password("x"),
                session_id=sid,
            )
            db.add(u)
        else:
            u.session_id = sid
        db.commit()
        db.refresh(u)
        return {"Authorization": f"Bearer {create_token('integration_test_user', sid)}"}
    finally:
        db.close()