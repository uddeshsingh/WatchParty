import uuid

import pytest
from fastapi.testclient import TestClient

# Import your app from main
from app.api.auth import create_token
from app.main import app
from app.repository.models import UserModel, VideoModel

client = TestClient(app)


def _integration_auth_headers(db_session) -> dict:
    from app.repository.models import UserModel
    from app.api.auth import hash_password

    sid = "integration-test-session-id-fixed-1"
    u = (
        db_session.query(UserModel)
        .filter(UserModel.username == "integration_test_user")
        .first()
    )
    if not u:
        u = UserModel(
            username="integration_test_user",
            email="integration@test.dev",
            hashed_password=hash_password("x"),
            session_id=sid,
        )
        db_session.add(u)
    else:
        u.session_id = sid
    db_session.commit()
    db_session.refresh(u)
    token = create_token("integration_test_user", sid)
    return {"Authorization": f"Bearer {token}"}


def test_register_user_actual_db():
    unique_username = f"testuser_{uuid.uuid4().hex[:6]}"
    response = client.post(
        "/api/auth/registration/",
        json={
            "username": unique_username,
            "email": f"{unique_username}@test.com",
            "password1": "securepass",
            "password2": "securepass"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == unique_username
    assert "id" in data["user"]


def test_second_login_invalidates_prior_token():
    """Each login issues a new session_id; older JWTs must fail on protected routes."""
    unique_username = f"twosess_{uuid.uuid4().hex[:6]}"
    reg = client.post(
        "/api/auth/registration/",
        json={
            "username": unique_username,
            "email": f"{unique_username}@test.com",
            "password1": "securepass",
            "password2": "securepass",
        },
    )
    assert reg.status_code == 200
    token_first = reg.json()["token"]

    login_again = client.post(
        "/api/auth/login/",
        json={"username": unique_username, "password": "securepass"},
    )
    assert login_again.status_code == 200
    token_second = login_again.json()["token"]

    stale = client.get(
        "/api/videos?room=general",
        headers={"Authorization": f"Bearer {token_first}"},
    )
    assert stale.status_code == 401

    fresh = client.get(
        "/api/videos?room=general",
        headers={"Authorization": f"Bearer {token_second}"},
    )
    assert fresh.status_code == 200

def test_add_and_fetch_video_actual_db(db_session):
    room_name = "test_integration_room"
    headers = _integration_auth_headers(db_session)

    # 1. Add a video (metadata/pubsub may be mocked by conftest)
    response = client.post(
        "/api/videos/add",
        json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "room": room_name,
        },
        headers=headers,
    )
    assert response.status_code == 200
    added_video = response.json()
    assert added_video["video_url"] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    # 2. Fetch it back
    res_get = client.get(f"/api/videos?room={room_name}", headers=headers)
    assert res_get.status_code == 200
    videos = res_get.json()
    assert len(videos) > 0
    assert any(v["id"] == added_video["id"] for v in videos)

    # Cleanup the actual database to prevent bloat
    db = db_session
    db.query(VideoModel).filter(VideoModel.room == room_name).delete()
    db.commit()
    db.close()