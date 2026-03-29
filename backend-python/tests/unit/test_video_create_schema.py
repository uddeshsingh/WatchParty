import pytest
from pydantic import ValidationError

from app.domain.schemas import VideoCreateReq


def test_video_create_requires_url_xor_tmdb():
    with pytest.raises(ValidationError):
        VideoCreateReq(url="https://a.com", tmdb_id=1, media_type="movie", title="T")
    with pytest.raises(ValidationError):
        VideoCreateReq(room="r")


def test_video_create_tmdb_movie_ok():
    r = VideoCreateReq(
        tmdb_id=123,
        media_type="movie",
        title="Film",
        thumbnail="https://example.com/p.jpg",
        room="r1",
    )
    assert r.tmdb_id == 123


def test_video_create_tmdb_tv_requires_season_episode():
    with pytest.raises(ValidationError):
        VideoCreateReq(tmdb_id=1, media_type="tv", title="Show", room="r")


def test_video_create_tmdb_tv_ok():
    r = VideoCreateReq(
        tmdb_id=9,
        media_type="tv",
        title="Show",
        season=2,
        episode=5,
        room="r",
    )
    assert r.season == 2
