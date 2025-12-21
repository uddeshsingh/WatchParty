from rest_framework import generics
from .models import Video
from .serializers import VideoSerializer

class VideoList(generics.ListCreateAPIView):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer