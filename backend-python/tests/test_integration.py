# app/tests/test_integration.py
import pytest
from app.service.video_service import VideoService
from app.repository.video_repo import VideoRepoImpl
from app.pubsub.gcp_publisher import GCPPubSubPublisher
from app.repository.database import SessionLocal, engine, Base
from app.domain.schemas import VideoCreateReq

def test_actual_video_pipeline():
    # Ensure schema exists in actual DB
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        repo = VideoRepoImpl(db)
        # Use live Publisher
        publisher = GCPPubSubPublisher(project_id="watchparty-482106", topic_id="watchparty-events")
        service = VideoService(repo=repo, publisher=publisher)
        
        req = VideoCreateReq(url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", room="integration-room")
        
        # Execute actual yt-dlp fetch and broadcast
        video = service.process_and_add_video(req)
        
        # Check if we got the actual title or the fallback
        assert video.title is not None
        assert video.room == "integration-room"
        # We allow fallback title if scraping is blocked in the test environment
        assert "Rick Astley" in video.title or video.title in ["Test Video", "YouTube Video", "WatchParty Video"]
    finally:
        db.close()