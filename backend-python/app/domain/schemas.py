from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password1: str
    password2: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    user: UserResponse
    token: str

class VideoCreateReq(BaseModel):
    url: str  
    room: str = "general"
    title: Optional[str] = None
    thumbnail: Optional[str] = None 

class VideoResponse(BaseModel):
    id: int
    title: str
    video_url: str
    thumbnail: str
    room: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}

class MetadataReq(BaseModel):
    video_ids: List[int]