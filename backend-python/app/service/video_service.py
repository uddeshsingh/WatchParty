import yt_dlp
from app.domain.interfaces import VideoManager, VideoRepository
from app.domain.schemas import VideoCreateReq, VideoResponse

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

        # 2. Otherwise, fetch it securely with yt-dlp
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'ignoreerrors': False,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'source_address': '0.0.0.0',
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(str(req.url), download=False)
            if 'entries' in info:
                info = info['entries'][0]

            data = {
                "title": info.get('title', 'Unknown Video'),
                "video_url": str(req.url), 
                "thumbnail": info.get('thumbnail') or f"https://img.youtube.com/vi/{info.get('id')}/hqdefault.jpg",
                "room": req.room
            }
            
            saved_video = self.repo.save_video(data)
            
            if self.publisher:
                video_json_data = saved_video.model_dump(mode='json')
                self.publisher.broadcast_video_added(req.room, video_json_data)
                
            return saved_video

    def clear_room_playlist(self, room: str) -> None:
        self.repo.delete_videos_by_room(room)