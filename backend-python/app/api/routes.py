from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os

from app.domain.schemas import VideoCreateReq, VideoResponse, MetadataReq
from app.service.video_service import VideoService
from app.repository.video_repo import VideoRepoImpl
from app.repository.database import SessionLocal
from app.pubsub.gcp_publisher import GCPPubSubPublisher

router = APIRouter(prefix="/api")

# Read Project ID from Environment or fallback
project_id = os.getenv("GCP_PROJECT_ID", "watchparty-482106")
publisher = GCPPubSubPublisher(project_id=project_id, topic_id="watchparty-events")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_video_service(db: Session = Depends(get_db)):
    repo = VideoRepoImpl(db)
    return VideoService(repo=repo, publisher=publisher)

@router.get("/videos", response_model=List[VideoResponse])
def get_videos(room: str = "general", service: VideoService = Depends(get_video_service)):
    return service.repo.get_videos_by_room(room)

@router.post("/videos/add", response_model=VideoResponse)
def add_video(req: VideoCreateReq, service: VideoService = Depends(get_video_service)):
    try:
        return service.process_and_add_video(req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/videos/{video_id}")
def delete_video(video_id: int, room: str, db: Session = Depends(get_db)):
    from app.repository.models import VideoModel
    db.query(VideoModel).filter(VideoModel.id == video_id).delete()
    db.commit()
    
    # Trigger Pub/Sub playlist refresh
    publisher.broadcast_video_added(room, {})
    return {"status": "deleted"}

@router.post("/videos/metadata", response_model=List[VideoResponse])
def get_videos_metadata(req: MetadataReq, db: Session = Depends(get_db)):
    from app.repository.models import VideoModel
    if not req.video_ids:
        return []
    videos = db.query(VideoModel).filter(VideoModel.id.in_(req.video_ids)).all()
    return videos