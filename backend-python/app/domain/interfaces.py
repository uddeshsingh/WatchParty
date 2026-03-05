from abc import ABC, abstractmethod
from typing import List
from .schemas import VideoCreateReq, VideoResponse

class VideoRepository(ABC):
    @abstractmethod
    def get_videos_by_room(self, room: str) -> List[VideoResponse]: pass
    
    @abstractmethod
    def save_video(self, video_data: dict) -> VideoResponse: pass

    @abstractmethod
    def delete_videos_by_room(self, room: str) -> None: pass

class VideoManager(ABC):
    @abstractmethod
    def process_and_add_video(self, req: VideoCreateReq) -> VideoResponse: pass
    
    @abstractmethod
    def clear_room_playlist(self, room: str) -> None: pass