from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Video
from .serializers import VideoSerializer
import yt_dlp
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:5173"
    client_class = OAuth2Client

# Existing List View (for fetching)
class VideoList(generics.ListCreateAPIView):
    serializer_class = VideoSerializer

    def get_queryset(self):
        # Filter videos by the 'room' query parameter (default to 'general')
        room_name = self.request.query_params.get('room', 'general')
        return Video.objects.filter(room=room_name).order_by('-uploaded_at')

# New View (for adding by URL)
class AddVideo(APIView):
    def post(self, request):
        url = request.data.get('url')
        room = request.data.get('room', 'general')
        if not url:
            return Response({"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 1. Fetch metadata from YouTube
            ydl_opts = {'quiet': True, 'skip_download': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                title = info.get('title', 'Unknown Video')
                thumbnail = info.get('thumbnail', '')
                
                # 2. Save to Database
                video = Video.objects.create(
                    title=title,
                    video_url=url,
                    thumbnail=thumbnail,
                    room=room
                )
                
                return Response(VideoSerializer(video).data, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)