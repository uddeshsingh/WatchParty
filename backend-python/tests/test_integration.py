# app/tests/test_integration.py
import pytest
from unittest.mock import patch
from app.service.video_service import VideoService
from app.repository.video_repo import VideoRepoImpl
from app.pubsub.gcp_publisher import GCPPubSubPublisher
from app.repository.database import SessionLocal, engine, Base
from app.domain.schemas import VideoCreateReq
from app.repository.models import VideoModel

@pytest.mark.integration
def test_actual_video_pipeline():
    # Ensure schema exists in actual DB
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 🚨 CLEANUP: Clear existing records for this URL to ensure scraper is triggered
        test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        db.query(VideoModel).filter(VideoModel.video_url == test_url).delete()
        db.commit()

        repo = VideoRepoImpl(db)
        # Use live Publisher (will hit emulator if PUBSUB_EMULATOR_HOST is set)
        publisher = GCPPubSubPublisher(project_id="watchparty-482106", topic_id="watchparty-events")
        service = VideoService(repo=repo, publisher=publisher)
        
        req = VideoCreateReq(url=test_url, room="integration-room")
        
        # 🚨 MOCK EXTERNAL I/O: Mock fetch_video_metadata to avoid live scraping during integration tests
        with patch("app.service.video_service.fetch_video_metadata") as mock_fetch:
            mock_fetch.return_value = {
                "title": "Rick Astley - Never Gonna Give You Up",
                "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
            }
            
            # Execute video processing (uses mocked metadata)
            video = service.process_and_add_video(req)
            
            # Check results
            assert video.title == "Rick Astley - Never Gonna Give You Up"
            assert video.room == "integration-room"
            assert video.video_url == test_url
    finally:
        db.close()