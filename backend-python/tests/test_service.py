import pytest
from app.service.video_service import VideoService
from app.repository.video_repo import VideoRepoImpl
from app.pubsub.gcp_publisher import GCPPubSubPublisher
from app.repository.database import SessionLocal, engine, Base
from app.repository.models import VideoModel
from app.domain.schemas import VideoCreateReq

def test_full_video_pipeline():
    # 1. Ensure tables exist in actual Postgres
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # 2. Use real dependencies
        repo = VideoRepoImpl(db)
        publisher = GCPPubSubPublisher(project_id="watchparty-482106", topic_id="watchparty-events")
        service = VideoService(repo=repo, publisher=publisher)
        
        req = VideoCreateReq(url="https://www.youtube.com/watch?v=dQw4w9WgXcQ", room="test-room")
        
        # 3. Execute - This will hit real Postgres and real (or emulated) GCP Pub/Sub
        video = service.process_and_add_video(req)
        
        assert video.title is not None
        assert "youtube.com" in video.video_url
        assert video.room == "test-room"
        
    finally:
        # Cleanup actual DB
        db.query(VideoModel).filter(VideoModel.room == "test-room").delete()
        db.commit()
        db.close()