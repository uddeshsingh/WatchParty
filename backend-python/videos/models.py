from django.db import models

class Video(models.Model):
    title = models.CharField(max_length=255)
    video_url = models.URLField()
    thumbnail = models.URLField(blank=True, null=True)
    room = models.CharField(max_length=50, default='general')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.room})"