import json
import os
from google.cloud import pubsub_v1
from app.domain.interfaces import VideoManager

class GCPPubSubListener:
    def __init__(self, project_id: str, topic_id: str, sub_id: str, video_service: VideoManager):
        # Allow the emulator during local development
        if "PUBSUB_EMULATOR_HOST" in os.environ:
            print(f"🔗 Using Pub/Sub Emulator at {os.environ['PUBSUB_EMULATOR_HOST']}")
            
        self.subscriber = pubsub_v1.SubscriberClient()
        self.subscription_path = self.subscriber.subscription_path(project_id, sub_id)
        self.video_service = video_service

        try:
            topic_path = self.subscriber.topic_path(project_id, topic_id)
            self.subscriber.create_subscription(
                request={"name": self.subscription_path, "topic": topic_path}
            )
            print(f"✅ Created subscription {sub_id}")
        except Exception as e:
            # Subscription already exists or emulator handled it
            pass

    def callback(self, message: pubsub_v1.subscriber.message.Message):
        try:
            data = json.loads(message.data.decode("utf-8"))
            
            if data.get("type") == "room_empty":
                room_id = data.get("room")
                print(f"🗑️ Go reported room '{room_id}' is empty. Clearing database playlist.")
                self.video_service.clear_room_playlist(room_id)
                
            message.ack()
        except Exception as e:
            print(f"PubSub Error: {e}")
            message.nack()

    def listen(self):
        print(f"👂 Python listening to Pub/Sub: {self.subscription_path}")
        self.streaming_pull_future = self.subscriber.subscribe(
            self.subscription_path, 
            callback=self.callback
        )
        
        try:
            self.streaming_pull_future.result()
        except Exception as e:
            print(f"Error in Pub/Sub listener: {e}")
            self.streaming_pull_future.cancel()
    
    def stop(self):
        print("🛑 Shutting down Pub/Sub listener...")
        if hasattr(self, 'streaming_pull_future'):
            self.streaming_pull_future.cancel()