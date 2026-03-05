from app.domain.interfaces import VideoManager, VideoRepository
from app.domain.schemas import VideoCreateReq, VideoResponse
from app.utils.scraper import fetch_video_metadata  # 🚨 Import our new scraper

class VideoService(VideoManager):
    def __init__(self, repo: VideoRepository, publisher=None):
        self.repo = repo
        self.publisher = publisher

    def process_and_add_video(self, req: VideoCreateReq) -> VideoResponse:
        # 1. Trust the frontend if it sends metadata
        if req.title and req.thumbnail:
            data = {
                "title": req.title,
                "video_url": str(req.url), 
                "thumbnail": str(req.thumbnail),
                "room": req.room
            }

            saved_video = self.repo.save_video(data)
        
            if self.publisher:
                video_json_data = saved_video.model_dump(mode='json')
                self.publisher.broadcast_video_added(req.room, video_json_data)
                
            return saved_video

        # 2. Otherwise, fetch it securely WITHOUT yt-dlp
        metadata = fetch_video_metadata(str(req.url))

        data = {
            "title": metadata.get('title') or 'Unknown Video',
            "video_url": str(req.url), 
            # Use fetched thumbnail or a generic fallback image
            "thumbnail": metadata.get('thumbnail') or "https://via.placeholder.com/640x360.png?text=Video+Added",
            "room": req.room
        }
        
        saved_video = self.repo.save_video(data)
        
        if self.publisher:
            video_json_data = saved_video.model_dump(mode='json')
            self.publisher.broadcast_video_added(req.room, video_json_data)
            
        return saved_video

    def clear_room_playlist(self, room: str) -> None:
        self.repo.delete_videos_by_room(room)