import requests
from bs4 import BeautifulSoup

def fetch_video_metadata(url: str) -> dict:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    # 1. oEmbed APIs (Fastest, zero blocks, perfect for YouTube/Vimeo)
    if "youtube.com" in url or "youtu.be" in url:
        try:
            res = requests.get(f"https://www.youtube.com/oembed?url={url}&format=json", timeout=3)
            if res.status_code == 200:
                data = res.json()
                return {"title": data.get("title", "YouTube Video"), "thumbnail": data.get("thumbnail_url")}
        except:
            pass 

    # 2. Universal HTML Scraper (Catches Twitch, DailyMotion, MP4s, etc.)
    try:
        res = requests.get(url, headers=headers, timeout=4)
        soup = BeautifulSoup(res.text, 'html.parser')

        og_title = soup.find("meta", property="og:title")
        title = og_title["content"] if og_title else (soup.title.string if soup.title else "External Video")

        og_image = soup.find("meta", property="og:image")
        thumbnail = og_image["content"] if og_image else None

        return {"title": title.strip(), "thumbnail": thumbnail}
    except Exception as e:
        print(f"Metadata extraction failed for {url}: {e}")
        return {"title": "WatchParty Video", "thumbnail": None}