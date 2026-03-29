import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.api.routes import get_video_service, get_db
from app.api.auth import create_token
from app.domain.schemas import VideoResponse
from datetime import datetime

@pytest.fixture
def mock_service():
    return MagicMock()

@pytest.fixture
def auth_headers(db_session):
    from app.repository.models import UserModel
    from app.api.auth import hash_password

    sid = "unit-test-session-id-for-api-routes-1"
    db_session.add(
        UserModel(
            username="test-user",
            email="test-user@example.com",
            hashed_password=hash_password("pw"),
            session_id=sid,
        )
    )
    db_session.commit()
    token = create_token("test-user", sid)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def api_client(mock_service):
    original_service = app.dependency_overrides.get(get_video_service)
    original_db = app.dependency_overrides.get(get_db)
    
    app.dependency_overrides[get_video_service] = lambda: mock_service
    app.dependency_overrides[get_db] = lambda: MagicMock()
    
    yield TestClient(app)
    
    if original_service:
        app.dependency_overrides[get_video_service] = original_service
    else:
        del app.dependency_overrides[get_video_service]
        
    if original_db:
        app.dependency_overrides[get_db] = original_db
    else:
        del app.dependency_overrides[get_db]

def test_get_videos_unauthenticated(api_client, mock_service):
    response = api_client.get("/api/videos?room=general")
    assert response.status_code == 401

def test_get_videos_empty(api_client, mock_service, auth_headers):
    mock_service.repo.get_videos_by_room.return_value = []
    
    response = api_client.get("/api/videos?room=general", headers=auth_headers)
    
    assert response.status_code == 200
    assert response.json() == []
    mock_service.repo.get_videos_by_room.assert_called_with("general")

def test_add_video_endpoint(api_client, mock_service, auth_headers):
    mock_service.process_and_add_video.return_value = VideoResponse(
        id=10,
        title="API Title",
        video_url="https://youtube.com/watch?v=api",
        thumbnail="https://example.com/api.png",
        room="api-room",
        uploaded_at=datetime.now()
    )
    
    payload = {"url": "https://youtube.com/watch?v=api", "room": "api-room"}
    response = api_client.post("/api/videos/add", json=payload, headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "API Title"
    assert data["id"] == 10
    mock_service.process_and_add_video.assert_called_once()

def test_delete_video_endpoint(api_client, auth_headers):
    response = api_client.delete("/api/videos/10?room=api-room", headers=auth_headers)
    
    assert response.status_code == 200
    assert response.json() == {"status": "deleted"}
