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
import sys
import traceback

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
            # --- ROBUST YT-DLP OPTIONS ---
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
                'nocheckcertificate': True, 
                
                # CRITICAL FIX 1: See the REAL error if it fails
                'ignoreerrors': False, 

                # CRITICAL FIX 2: Pretend to be a real browser (Anti-blocking)
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                
                # CRITICAL FIX 3: Force IPv4 (Cloud Run IPv6 is often blocked)
                'source_address': '0.0.0.0',
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 'process': False avoids downloading/processing, just grabs JSON
                info = ydl.extract_info(url, download=False)
                
                if not info:
                    raise Exception("YouTube returned no data (likely blocked).")

                # Handle playlist/search results
                if 'entries' in info:
                    info = info['entries'][0]

                title = info.get('title', 'Unknown Video')
                thumbnail = info.get('thumbnail', '')

                # Fallback for thumbnail if missing
                if not thumbnail and 'id' in info:
                    thumbnail = f"https://img.youtube.com/vi/{info['id']}/hqdefault.jpg"

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
            # Log the full error to your Cloud Run logs
            error_msg = str(e)
            print(f"❌ ERROR ADDING VIDEO: {error_msg}", file=sys.stderr)
            traceback.print_exc() 
            
            # Return the SPECIFIC error to the frontend so we know what's wrong
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)