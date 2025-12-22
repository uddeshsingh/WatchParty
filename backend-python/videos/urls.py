from django.urls import path
from .views import VideoList, AddVideo

urlpatterns = [
    path('videos/', VideoList.as_view(), name='video-list'),
    path('videos/add/', AddVideo.as_view(), name='video-add'),
]