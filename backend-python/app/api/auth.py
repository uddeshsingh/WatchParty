from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import jwt
import os
import bcrypt
import secrets

from app.repository.database import SessionLocal
from app.repository.models import UserModel
from app.domain.schemas import UserCreate, UserResponse, UserLogin, AuthResponse
from app.auth_session_redis import mirror_auth_session

router = APIRouter(prefix="/api/auth")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

security = HTTPBearer(auto_error=False)


class GoogleAuth(BaseModel):
    access_token: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_token(username: str, session_id: str) -> str:
    return jwt.encode(
        {
            "sub": username,
            "sid": session_id,
            "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        sid_claim = payload.get("sid")
        user = db.query(UserModel).filter(UserModel.username == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        if user.session_id and sid_claim != user.session_id:
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please log in again.",
            )
        return username
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password.startswith("$2"):
        return False

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except ValueError:
        return False


def _rotate_session(db: Session, user: UserModel) -> str:
    sid = secrets.token_hex(16)
    user.session_id = sid
    db.add(user)
    db.commit()
    db.refresh(user)
    mirror_auth_session(user.username, sid)
    return sid


@router.post("/registration/", response_model=AuthResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if user_in.password1 != user_in.password2:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if db.query(UserModel).filter(UserModel.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    clean_email = user_in.email if user_in.email and user_in.email.strip() != "" else None

    hashed_pw = hash_password(user_in.password1)
    sid = secrets.token_hex(16)
    new_user = UserModel(
        username=user_in.username,
        email=clean_email,
        hashed_password=hashed_pw,
        session_id=sid,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    mirror_auth_session(new_user.username, sid)

    return {"user": new_user, "token": create_token(new_user.username, sid)}


@router.post("/login/", response_model=AuthResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == user_in.username).first()

    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    sid = _rotate_session(db, user)
    return {"user": user, "token": create_token(user.username, sid)}


@router.post("/google/", response_model=AuthResponse)
def google_login(token_req: GoogleAuth, db: Session = Depends(get_db)):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    try:
        idinfo = id_token.verify_oauth2_token(
            token_req.access_token, google_requests.Request(), client_id
        )
        email = idinfo["email"]
        suggested_username = idinfo.get("name", email.split("@")[0])

        user = db.query(UserModel).filter(UserModel.email == email).first()
        if not user:
            user = UserModel(
                username=suggested_username,
                email=email,
                hashed_password=f"!sso:{secrets.token_hex(32)}",
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        sid = _rotate_session(db, user)
        return {"user": user, "token": create_token(user.username, sid)}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google Token")
