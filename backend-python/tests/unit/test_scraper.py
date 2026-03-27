import pytest
from unittest.mock import MagicMock, patch
from app.utils.scraper import fetch_video_metadata

def test_fetch_video_metadata_youtube_oembed():
    # GIVEN: A YouTube URL that returns JSON oEmbed
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "title": "Rick Astley - Never Gonna Give You Up",
        "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    }

    with patch("requests.get", return_value=mock_response) as mock_get:
        # WHEN: Fetching metadata
        result = fetch_video_metadata(url)
        
        # THEN: The oEmbed API should be called
        mock_get.assert_called_with(f"https://www.youtube.com/oembed?url={url}&format=json", timeout=3)
        assert result["title"] == "Rick Astley - Never Gonna Give You Up"
        assert result["thumbnail"] == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"

def test_fetch_video_metadata_universal_scraper():
    # GIVEN: An external URL that requires HTML scraping
    url = "https://example.com/video"
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = """
    <html>
        <head>
            <title>Example Video</title>
            <meta property="og:title" content="OG Example Title" />
            <meta property="og:image" content="https://example.com/og.png" />
        </head>
    </html>
    """

    with patch("requests.get", return_value=mock_response) as mock_get:
        # WHEN: Fetching metadata
        result = fetch_video_metadata(url)
        
        # THEN: The universal scraper should be used
        assert result["title"] == "OG Example Title"
        assert result["thumbnail"] == "https://example.com/og.png"

def test_fetch_video_metadata_failure_graceful():
    # GIVEN: A URL that fails to respond
    url = "https://broken-link.com"
    
    with patch("requests.get", side_effect=Exception("Connection Error")):
        # WHEN: Fetching metadata
        result = fetch_video_metadata(url)
        
        # THEN: It should return a fallback title
        assert result["title"] == "WatchParty Video"
        assert result["thumbnail"] is None
