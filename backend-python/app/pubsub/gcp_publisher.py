import json
from google.cloud import pubsub_v1
from app.domain.schemas import PubSubMessage # 🚨 Import the unified schema

class GCPPubSubPublisher:
    def __init__(self, project_id: str, topic_id: str):
        self.publisher = pubsub_v1.PublisherClient()
        self.topic_path = self.publisher.topic_path(project_id, topic_id)

    def broadcast_video_added(self, room_id: str, video_data: dict):
        validated_msg = PubSubMessage(
            type="video_added",
            room=room_id,
            username="system", # Required by Go validator
            data=video_data
        )
        
        data = json.dumps(validated_msg.model_dump()).encode("utf-8")
        self.publisher.publish(self.topic_path, data)
        print(f"📡 Broadcast video update for room: {room_id}")