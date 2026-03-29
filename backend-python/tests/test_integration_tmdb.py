"""TMDB add-video paths against a live PostgreSQL DATABASE_URL."""

import pytest
from app.domain.schemas import VideoCreateReq
from app.pubsub.gcp_publisher import GCPPubSubPublisher
from app.repository.database import Base, SessionLocal, engine
from app.repository.models import VideoModel
from app.repository.video_repo import VideoRepoImpl
from app.service.video_service import VideoService


@pytest.mark.integration
def test_tmdb_movie_roundtrip_via_video_service():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    room = "integration-tmdb-movie"
    try:
        db.query(VideoModel).filter(VideoModel.room == room).delete()
        db.commit()

        repo = VideoRepoImpl(db)
        publisher = GCPPubSubPublisher(
            project_id="test-project", topic_id="watchparty-events"
        )
        service = VideoService(repo=repo, publisher=publisher)

        req = VideoCreateReq(
            tmdb_id=550,
            media_type="movie",
            title="Fight Club",
            thumbnail="https://example.com/poster.jpg",
            room=room,
        )
        video = service.process_and_add_video(req)

        assert video.title == "Fight Club"
        assert video.video_url == "tmdb://movie/550"
        assert video.room == room
        assert video.tmdb_id == 550
        assert video.media_type == "movie"
        assert video.season is None
        assert video.episode is None

        row = db.query(VideoModel).filter(VideoModel.id == video.id).one()
        assert row.video_url == "tmdb://movie/550"
    finally:
        db.query(VideoModel).filter(VideoModel.room == room).delete()
        db.commit()
        db.close()


@pytest.mark.integration
def test_tmdb_tv_roundtrip_via_video_service():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    room = "integration-tmdb-tv"
    try:
        db.query(VideoModel).filter(VideoModel.room == room).delete()
        db.commit()

        repo = VideoRepoImpl(db)
        publisher = GCPPubSubPublisher(
            project_id="test-project", topic_id="watchparty-events"
        )
        service = VideoService(repo=repo, publisher=publisher)

        req = VideoCreateReq(
            tmdb_id=1396,
            media_type="tv",
            title="Breaking Bad",
            season=1,
            episode=1,
            room=room,
        )
        video = service.process_and_add_video(req)

        assert video.video_url == "tmdb://tv/1396/1/1"
        assert video.tmdb_id == 1396
        assert video.media_type == "tv"
        assert video.season == 1
        assert video.episode == 1
    finally:
        db.query(VideoModel).filter(VideoModel.room == room).delete()
        db.commit()
        db.close()


@pytest.mark.integration
def test_rest_post_add_tmdb_movie_persists(postgres_api_client, integration_user_headers):
    Base.metadata.create_all(bind=engine)
    room = "integration-rest-tmdb"
    db = SessionLocal()
    try:
        db.query(VideoModel).filter(VideoModel.room == room).delete()
        db.commit()
    finally:
        db.close()

    client = postgres_api_client
    headers = integration_user_headers

    res = client.post(
        "/api/videos/add",
        json={
            "tmdb_id": 27205,
            "media_type": "movie",
            "title": "Inception",
            "room": room,
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["video_url"] == "tmdb://movie/27205"
    assert body["title"] == "Inception"
    assert body["tmdb_id"] == 27205

    db = SessionLocal()
    try:
        row = (
            db.query(VideoModel)
            .filter(VideoModel.room == room, VideoModel.tmdb_id == 27205)
            .one()
        )
        assert row.media_type == "movie"
    finally:
        db.query(VideoModel).filter(VideoModel.room == room).delete()
        db.commit()
        db.close()
