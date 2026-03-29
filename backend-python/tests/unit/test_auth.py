import pytest
import jwt
import os
from unittest.mock import MagicMock, patch
from app.api.auth import hash_password, verify_password, create_token, get_current_user, JWT_SECRET

def test_hash_and_verify_password():
    password = "secret-password"
    hashed = hash_password(password)
    
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False
    assert verify_password("legacy", "plaintext") is False

def test_create_token():
    username = "test-user"
    sid = "sessid-test-user-aaaaaaaaaaaa"
    token = create_token(username, sid)

    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == username
    assert payload["sid"] == sid
    assert "exp" in payload


def test_get_current_user_valid_token(db_session):
    from unittest.mock import MagicMock
    from app.repository.models import UserModel

    sid = "sessid-alice-aaaaaaaaaaaaaaaa"
    user = UserModel(
        username="alice",
        email="alice@example.com",
        hashed_password=hash_password("pw"),
        session_id=sid,
    )
    db_session.add(user)
    db_session.commit()

    token = create_token("alice", sid)
    creds = MagicMock()
    creds.credentials = token
    assert get_current_user(credentials=creds, db=db_session) == "alice"


def test_get_current_user_stale_session_rejected(db_session):
    from unittest.mock import MagicMock
    from fastapi import HTTPException
    from app.repository.models import UserModel

    db_session.add(
        UserModel(
            username="bob",
            email="bob@example.com",
            hashed_password=hash_password("pw"),
            session_id="current-session-id-123456789012",
        )
    )
    db_session.commit()

    token = create_token("bob", "old-session-id-12345678901234")
    creds = MagicMock()
    creds.credentials = token
    with pytest.raises(HTTPException) as exc:
        get_current_user(credentials=creds, db=db_session)
    assert exc.value.status_code == 401

def test_get_current_user_missing_credentials():
    from fastapi import HTTPException
    from unittest.mock import MagicMock

    with pytest.raises(HTTPException) as excinfo:
        get_current_user(credentials=None, db=MagicMock())
    assert excinfo.value.status_code == 401

def test_get_current_user_invalid_token(db_session):
    from fastapi import HTTPException
    from unittest.mock import MagicMock

    creds = MagicMock()
    creds.credentials = "bad.token.here"
    with pytest.raises(HTTPException) as excinfo:
        get_current_user(credentials=creds, db=db_session)
    assert excinfo.value.status_code == 401

@patch("app.api.auth.id_token.verify_oauth2_token")
def test_google_login_invalid_token(mock_verify):
    from fastapi import HTTPException
    from app.api.auth import google_login, GoogleAuth
    
    mock_verify.side_effect = ValueError("Invalid token")
    token_req = GoogleAuth(access_token="invalid-token")
    mock_db = MagicMock()
    
    with pytest.raises(HTTPException) as excinfo:
        google_login(token_req, mock_db)
    
    assert excinfo.value.status_code == 401
    assert excinfo.value.detail == "Invalid Google Token"

def test_registration_mismatched_passwords():
    from fastapi import HTTPException
    from app.api.auth import register
    from app.domain.schemas import UserCreate
    
    user_in = UserCreate(username="user", email="test@example.com", password1="pass1", password2="pass2")
    mock_db = MagicMock()
    
    with pytest.raises(HTTPException) as excinfo:
        register(user_in, mock_db)
    
    assert excinfo.value.status_code == 400
    assert excinfo.value.detail == "Passwords do not match"
