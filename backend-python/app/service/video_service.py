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

        # 🚨 2. Check the Database Cache First
        cached_video = self.repo.get_video_by_url(str(req.url))
        
        if cached_video:
            title = cached_video.title
            thumbnail = cached_video.thumbnail
        else:
            # 3. Only scrape if it's a completely new URL
            metadata = fetch_video_metadata(str(req.url))
            title = metadata.get('title') or 'Unknown Video'
            thumbnail = metadata.get('thumbnail') or "https://via.placeholder.com/640x360.png?text=Video+Added"

        data = {
            "title": title,
            "video_url": str(req.url), 
            "thumbnail": thumbnail,
            "room": req.room
        }
        
        saved_video = self.repo.save_video(data)
        
        if self.publisher:
            self.publisher.broadcast_video_added(req.room, saved_video.model_dump(mode='json'))
            
        return saved_video

    def clear_room_playlist(self, room: str) -> None:
        self.repo.delete_videos_by_room(room)