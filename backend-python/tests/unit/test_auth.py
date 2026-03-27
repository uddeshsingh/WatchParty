import pytest
import jwt
import os
from unittest.mock import MagicMock, patch
from app.api.auth import hash_password, verify_password, create_token, JWT_SECRET

def test_hash_and_verify_password():
    password = "secret-password"
    hashed = hash_password(password)
    
    # 1. Verify correct password works
    assert verify_password(password, hashed) is True
    
    # 2. Verify wrong password fails
    assert verify_password("wrong-password", hashed) is False
    
    # 3. Verify legacy password (not starting with $2) fails
    assert verify_password("legacy", "plaintext") is False

def test_create_token():
    username = "test-user"
    token = create_token(username)
    
    # Decode and verify the payload
    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == username

@patch("app.api.auth.id_token.verify_oauth2_token")
def test_google_login_invalid_token(mock_verify):
    from fastapi import HTTPException
    from app.api.auth import google_login, GoogleAuth
    
    # GIVEN: An invalid Google token
    mock_verify.side_effect = ValueError("Invalid token")
    token_req = GoogleAuth(access_token="invalid-token")
    mock_db = MagicMock()
    
    # WHEN / THEN: It should raise an HTTPException
    with pytest.raises(HTTPException) as excinfo:
        google_login(token_req, mock_db)
    
    assert excinfo.value.status_code == 401
    assert excinfo.value.detail == "Invalid Google Token"

def test_registration_mismatched_passwords():
    from fastapi import HTTPException
    from app.api.auth import register
    from app.domain.schemas import UserCreate
    
    # GIVEN: Mismatched passwords
    user_in = UserCreate(username="user", email="test@example.com", password1="pass1", password2="pass2")
    mock_db = MagicMock()
    
    # WHEN / THEN: It should raise an HTTPException
    with pytest.raises(HTTPException) as excinfo:
        register(user_in, mock_db)
    
    assert excinfo.value.status_code == 400
    assert excinfo.value.detail == "Passwords do not match"
