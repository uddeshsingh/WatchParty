from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Video
from .serializers import VideoSerializer
import yt_dlp
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from django.conf import settings
import sys        # <--- Added for logging
import traceback  # <--- Added for logging

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = settings.FRONTEND_URL 
    client_class = OAuth2Client

class VideoList(generics.ListCreateAPIView):
    serializer_class = VideoSerializer

    def get_queryset(self):
        room_name = self.request.query_params.get('room', 'general')
        return Video.objects.filter(room=room_name).order_by('-uploaded_at')

class AddVideo(APIView):
    def post(self, request):
        url = request.data.get('url')
        room = request.data.get('room', 'general')
        
        if not url:
            return Response({"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # --- IMPROVED YT-DLP OPTIONS ---
            ydl_opts = {
                'quiet': True,
                'skip_download': True,
                'nocheckcertificate': True, # Fixes SSL errors in some containers
                'ignoreerrors': True,       # Prevents crashing on minor warnings
                'no_warnings': True,
                'default_search': 'auto',
                'source_address': '0.0.0.0', # Force IPv4 (Fixes deployment networking issues)
                'extract_flat': False,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Handle cases where ignoreerrors=True returns None
                if not info:
                    print("❌ yt-dlp failed to extract info (returned None)", file=sys.stderr)
                    return Response({"error": "Failed to extract video info"}, status=status.HTTP_400_BAD_REQUEST)

                # 'entries' is present if it's a playlist or search result
                if 'entries' in info:
                    info = info['entries'][0]

                title = info.get('title', 'Unknown Video')
                thumbnail = info.get('thumbnail', '')

                # Save to Database
                video = Video.objects.create(
                    title=title,
                    video_url=url,
                    thumbnail=thumbnail,
                    room=room
                )
                
                print(f"✅ Successfully added video: {title}")
                return Response(VideoSerializer(video).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            # --- LOGGING THE ACTUAL ERROR ---
            print(f"❌ ERROR ADDING VIDEO: {str(e)}", file=sys.stderr)
            traceback.print_exc() # Prints full stack trace to server logs
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)