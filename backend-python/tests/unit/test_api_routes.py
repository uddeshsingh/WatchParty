import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.api.routes import get_video_service, get_db
from app.domain.schemas import VideoResponse
from datetime import datetime

@pytest.fixture
def mock_service():
    return MagicMock()

@pytest.fixture
def api_client(mock_service):
    # Setup overrides
    original_service = app.dependency_overrides.get(get_video_service)
    original_db = app.dependency_overrides.get(get_db)
    
    app.dependency_overrides[get_video_service] = lambda: mock_service
    app.dependency_overrides[get_db] = lambda: MagicMock()
    
    yield TestClient(app)
    
    # Restore overrides
    if original_service:
        app.dependency_overrides[get_video_service] = original_service
    else:
        del app.dependency_overrides[get_video_service]
        
    if original_db:
        app.dependency_overrides[get_db] = original_db
    else:
        del app.dependency_overrides[get_db]

def test_get_videos_empty(api_client, mock_service):
    # GIVEN: A mock repo that returns an empty list
    mock_service.repo.get_videos_by_room.return_value = []
    
    # WHEN: Calling the GET /api/videos endpoint
    response = api_client.get("/api/videos?room=general")
    
    # THEN: It should return a 200 OK and an empty list
    assert response.status_code == 200
    assert response.json() == []
    mock_service.repo.get_videos_by_room.assert_called_with("general")

def test_add_video_endpoint(api_client, mock_service):
    # GIVEN: A mock service that returns a VideoResponse
    mock_service.process_and_add_video.return_value = VideoResponse(
        id=10,
        title="API Title",
        video_url="https://youtube.com/watch?v=api",
        thumbnail="https://example.com/api.png",
        room="api-room",
        uploaded_at=datetime.now()
    )
    
    # WHEN: Calling the POST /api/videos/add endpoint
    payload = {"url": "https://youtube.com/watch?v=api", "room": "api-room"}
    response = api_client.post("/api/videos/add", json=payload)
    
    # THEN: It should return a 200 OK and the video data
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "API Title"
    assert data["id"] == 10
    mock_service.process_and_add_video.assert_called_once()

def test_delete_video_endpoint(api_client):
    # The api_client fixture already mocks get_db
    # WHEN: Calling the DELETE /api/videos/{id} endpoint
    response = api_client.delete("/api/videos/10?room=api-room")
    
    # THEN: It should return a 200 OK
    assert response.status_code == 200
    assert response.json() == {"status": "deleted"}
