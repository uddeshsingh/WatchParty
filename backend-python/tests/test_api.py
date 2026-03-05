import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

# Import your actual app and DB dependencies
from app.main import app
from app.repository.database import Base
from app.repository.models import UserModel, VideoModel

# Point to your ACTUAL local postgres
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/watchparty"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Recreate tables to ensure clean state
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_register_user_actual_db():
    unique_username = f"testuser_{uuid.uuid4().hex[:6]}"
    response = client.post(
        "/api/auth/registration/",
        json={
            "username": unique_username,
            "email": f"{unique_username}@test.com",
            "password1": "securepass",
            "password2": "securepass"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == unique_username
    assert "id" in data

def test_add_and_fetch_video_actual_db():
    room_name = "test_integration_room"
    
    # 1. Add a video (This will trigger yt-dlp and actual GCP PubSub if credentials exist)
    response = client.post(
        "/api/videos/add",
        json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "room": room_name
        }
    )
    assert response.status_code == 200
    added_video = response.json()
    assert added_video["video_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    
    # 2. Fetch it back
    res_get = client.get(f"/api/videos?room={room_name}")
    assert res_get.status_code == 200
    videos = res_get.json()
    assert len(videos) > 0
    assert any(v["id"] == added_video["id"] for v in videos)

    # Cleanup the actual database to prevent bloat
    db = TestingSessionLocal()
    db.query(VideoModel).filter(VideoModel.room == room_name).delete()
    db.commit()
    db.close()