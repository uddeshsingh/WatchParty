from pydantic import BaseModel, model_validator
from typing import Optional, List, Any
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password1: str
    password2: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    user: UserResponse
    token: str


class VideoCreateReq(BaseModel):
    url: Optional[str] = None
    room: str = "general"
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    tmdb_id: Optional[int] = None
    media_type: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None

    @model_validator(mode="after")
    def url_xor_tmdb(self) -> "VideoCreateReq":
        has_url = self.url is not None and str(self.url).strip() != ""
        has_tmdb = self.tmdb_id is not None
        if has_url == has_tmdb:
            raise ValueError("Provide exactly one of url or tmdb_id")
        if has_tmdb:
            if not self.media_type or self.media_type not in ("movie", "tv"):
                raise ValueError("media_type must be 'movie' or 'tv' when tmdb_id is set")
            if self.media_type == "tv":
                if self.season is None or self.episode is None:
                    raise ValueError("season and episode are required for TV content")
            if not self.title or not str(self.title).strip():
                raise ValueError("title is required for TMDB content")
        return self


class VideoResponse(BaseModel):
    id: int
    title: str
    video_url: str
    thumbnail: Optional[str] = None
    room: str
    uploaded_at: datetime
    tmdb_id: Optional[int] = None
    media_type: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None

    model_config = {"from_attributes": True}


class MetadataReq(BaseModel):
    video_ids: List[int]


class PubSubMessage(BaseModel):
    type: str
    username: str
    user_id: str = ""
    content: str = ""
    timestamp: float = 0.0
    video_id: int = 0
    room: str
    is_host: bool = False
    data: Optional[dict] = None


class TMDBSearchResult(BaseModel):
    tmdb_id: int
    title: str
    media_type: str
    poster_path: Optional[str] = None
    release_date: Optional[str] = None
    first_air_date: Optional[str] = None
    vote_average: Optional[float] = None
    overview: Optional[str] = None
