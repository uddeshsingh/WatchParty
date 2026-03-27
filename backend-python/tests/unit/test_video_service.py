import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
from app.service.video_service import VideoService
from app.domain.schemas import VideoCreateReq, VideoResponse

@pytest.fixture
def mock_repo():
    return MagicMock()

@pytest.fixture
def mock_publisher():
    return MagicMock()

@pytest.fixture
def video_service(mock_repo, mock_publisher):
    return VideoService(repo=mock_repo, publisher=mock_publisher)

def test_process_and_add_video_with_metadata(video_service, mock_repo, mock_publisher):
    # GIVEN: A request that already contains title and thumbnail
    req = VideoCreateReq(
        url="https://youtube.com/watch?v=123",
        room="test-room",
        title="Direct Title",
        thumbnail="https://example.com/thumb.png"
    )
    
    mock_repo.save_video.return_value = VideoResponse(
        id=1,
        title="Direct Title",
        video_url="https://youtube.com/watch?v=123",
        thumbnail="https://example.com/thumb.png",
        room="test-room",
        uploaded_at=datetime.now()
    )
    
    # WHEN: Processing the video
    result = video_service.process_and_add_video(req)
    
    # THEN: The repo should be called directly, and the publisher should broadcast
    mock_repo.save_video.assert_called_once()
    mock_publisher.broadcast_video_added.assert_called_once_with("test-room", result.model_dump(mode='json'))
    assert result.title == "Direct Title"

def test_process_and_add_video_from_cache(video_service, mock_repo, mock_publisher):
    # GIVEN: A URL that exists in the database cache
    req = VideoCreateReq(url="https://youtube.com/watch?v=cached", room="test-room")
    
    cached_video = VideoResponse(
        id=2,
        title="Cached Title",
        video_url="https://youtube.com/watch?v=cached",
        thumbnail="https://example.com/cached.png",
        room="other-room",
        uploaded_at=datetime.now()
    )
    mock_repo.get_video_by_url.return_value = cached_video
    
    mock_repo.save_video.return_value = VideoResponse(
        id=3,
        title="Cached Title",
        video_url="https://youtube.com/watch?v=cached",
        thumbnail="https://example.com/cached.png",
        room="test-room",
        uploaded_at=datetime.now()
    )
    
    # WHEN: Processing the video
    result = video_service.process_and_add_video(req)
    
    # THEN: It should hit the cache and NOT call the scraper
    mock_repo.get_video_by_url.assert_called_once_with("https://youtube.com/watch?v=cached")
    mock_repo.save_video.assert_called_once()
    assert result.title == "Cached Title"

@patch("app.service.video_service.fetch_video_metadata")
def test_process_and_add_video_via_scraper(mock_fetch, video_service, mock_repo, mock_publisher):
    # GIVEN: A new URL that is not in cache
    req = VideoCreateReq(url="https://youtube.com/watch?v=new", room="test-room")
    
    mock_repo.get_video_by_url.return_value = None
    mock_fetch.return_value = {"title": "Scraped Title", "thumbnail": "https://example.com/new.png"}
    
    mock_repo.save_video.return_value = VideoResponse(
        id=4,
        title="Scraped Title",
        video_url="https://youtube.com/watch?v=new",
        thumbnail="https://example.com/new.png",
        room="test-room",
        uploaded_at=datetime.now()
    )
    
    # WHEN: Processing the video
    result = video_service.process_and_add_video(req)
    
    # THEN: Scraper should be triggered
    mock_fetch.assert_called_once_with("https://youtube.com/watch?v=new")
    mock_repo.save_video.assert_called_once()
    assert result.title == "Scraped Title"
    assert result.thumbnail == "https://example.com/new.png"
