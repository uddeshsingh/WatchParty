from sqlalchemy.orm import Session
from typing import List

from app.domain.interfaces import VideoRepository
from app.domain.schemas import VideoResponse
from app.repository.models import VideoModel
from app.repository.database import SessionLocal

class VideoRepoImpl(VideoRepository):
    def __init__(self, db: Session):
        self.db = db

    def get_videos_by_room(self, room: str) -> List[VideoResponse]:
        videos = (
            self.db.query(VideoModel)
            .filter(VideoModel.room == room)
            .order_by(VideoModel.uploaded_at.desc())
            .all()
        )
        # model_validate converts the SQLAlchemy model into the Pydantic schema
        return [VideoResponse.model_validate(v) for v in videos]

    def save_video(self, video_data: dict) -> VideoResponse:
        db_video = VideoModel(**video_data)
        self.db.add(db_video)
        self.db.commit()
        self.db.refresh(db_video)
        return VideoResponse.model_validate(db_video)

    def delete_videos_by_room(self, room: str) -> None:
        self.db.query(VideoModel).filter(VideoModel.room == room).delete()
        self.db.commit()
    
    # Add to VideoRepoImpl class
    def get_video_by_url(self, url: str) -> VideoResponse | None:
        db_video = self.db.query(VideoModel).filter(VideoModel.video_url == url).first()
        if db_video:
            return VideoResponse.model_validate(db_video)
        return None