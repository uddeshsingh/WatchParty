from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from pydantic import BaseModel
import jwt
import os
import bcrypt

from app.repository.database import SessionLocal
from app.repository.models import UserModel
from app.domain.schemas import UserCreate, UserResponse, UserLogin, AuthResponse 

router = APIRouter(prefix="/api/auth")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-fallback")

class GoogleAuth(BaseModel):
    access_token: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_token(username: str):
    return jwt.encode({"sub": username}, JWT_SECRET, algorithm="HS256")

# --- NEW SECURE HASHING HELPERS ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Bcrypt hashes always start with $2a$, $2b$, etc. 
    # If it doesn't, it's an old plaintext password.
    if not hashed_password.startswith("$2"):
        return False
    
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

@router.post("/registration/", response_model=AuthResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if user_in.password1 != user_in.password2:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    if db.query(UserModel).filter(UserModel.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    clean_email = user_in.email if user_in.email and user_in.email.strip() != "" else None
    
    hashed_pw = hash_password(user_in.password1)
    
    # Pass the clean_email instead of user_in.email
    new_user = UserModel(username=user_in.username, email=clean_email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"user": new_user, "token": create_token(new_user.username)}

@router.post("/login/", response_model=AuthResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.username == user_in.username).first()
    
    # 🔒 Verify the password
    if not user or not verify_password(user_in.password, user.hashed_password):
        # Gracefully handle legacy accounts
        if user and not user.hashed_password.startswith("$2"):
             raise HTTPException(
                status_code=401, 
                detail="Legacy account detected. Please create a new account with upgraded security."
            )
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {"user": user, "token": create_token(user.username)}

@router.post("/google/", response_model=AuthResponse)
def google_login(token_req: GoogleAuth, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
            token_req.access_token, google_requests.Request(), 
            os.getenv("GOOGLE_CLIENT_ID", "274181282324-9c82amhm2ogob1qlb112ndu3mkdlorfa.apps.googleusercontent.com")
        )
        email = idinfo['email']
        username = idinfo.get('name', email.split('@')[0])
        
        user = db.query(UserModel).filter(UserModel.email == email).first()
        if not user:
            user = UserModel(username=username, email=email, hashed_password="google_sso_user")
            db.add(user)
            db.commit()
            db.refresh(user)

        return {"user": user, "token": create_token(user.username)}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google Token")