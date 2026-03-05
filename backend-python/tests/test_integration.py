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
        
        assert "Rick Astley" in video.title
        assert "Never Gonna Give You Up" in video.title
        assert video.room == "integration-room"
    finally:
        db.close()