from typing import List

from app.domain.interfaces import VideoManager, VideoRepository
from app.domain.schemas import VideoCreateReq, VideoResponse
from app.utils.scraper import fetch_video_metadata


class VideoService(VideoManager):
    def __init__(self, repo: VideoRepository, publisher=None):
        self.repo = repo
        self.publisher = publisher

    def _broadcast(self, room: str, data: dict) -> None:
        if self.publisher:
            self.publisher.broadcast_video_added(room, data)

    def process_and_add_video(self, req: VideoCreateReq) -> VideoResponse:
        if req.title and req.thumbnail:
            data = {
                "title": req.title,
                "video_url": str(req.url),
                "thumbnail": str(req.thumbnail),
                "room": req.room,
            }
            saved_video = self.repo.save_video(data)
            self._broadcast(req.room, saved_video.model_dump(mode="json"))
            return saved_video

        cached_video = self.repo.get_video_by_url(str(req.url))

        if cached_video:
            title = cached_video.title
            thumbnail = cached_video.thumbnail
        else:
            metadata = fetch_video_metadata(str(req.url))
            title = metadata.get("title") or "Unknown Video"
            thumbnail = metadata.get("thumbnail") or "https://via.placeholder.com/640x360.png?text=Video+Added"

        data = {
            "title": title,
            "video_url": str(req.url),
            "thumbnail": thumbnail,
            "room": req.room,
        }

        saved_video = self.repo.save_video(data)
        self._broadcast(req.room, saved_video.model_dump(mode="json"))
        return saved_video

    def delete_video(self, video_id: int, room: str) -> None:
        self.repo.delete_video_by_id(video_id)
        self._broadcast(room, {})

    def clear_room_playlist(self, room: str) -> None:
        self.repo.delete_videos_by_room(room)

    def get_videos_metadata(self, video_ids: List[int]) -> List[VideoResponse]:
        return self.repo.get_videos_by_ids(video_ids)