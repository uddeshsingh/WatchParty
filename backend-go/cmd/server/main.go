package main

import (
	"context"
	"log"
	"os"

	"wpbe/internal/api"
	"wpbe/internal/domain"
	"wpbe/internal/pubsub"
	"wpbe/internal/repository"
	"wpbe/internal/service"
)

func main() {
	ctx := context.Background()

	// 1. Initialize Configuration
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	projectID := getEnv("GCP_PROJECT_ID", "watchparty-482106")
	topicID := "watchparty-events"
	port := getEnv("PORT", "8080")

	// 2. Initialize Concrete Repositories (Satisfies domain.RoomRepository)
	redisRepo, err := repository.NewRedisRepo(redisAddr)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	// 3. Initialize Event Bus with Local Fallback (Satisfies domain.EventBus)
	var eventBus domain.EventBus
	gcpPubSub, err := pubsub.NewGCPPubSub(ctx, projectID, topicID)
	if err != nil {
		log.Printf("⚠️ GCP Pub/Sub failed (%v). Falling back to Local Memory Bus.", err)
		eventBus = pubsub.NewLocalBus()
	} else {
		log.Println("✅ Connected to GCP Pub/Sub successfully.")
		eventBus = gcpPubSub
	}

	// 4. Initialize Core Service with Injected Dependencies (Satisfies domain.RoomManager)
	roomService := service.NewRoomService(redisRepo, eventBus)

	// 5. Start Background Workers
	go func() {
		log.Println("🎧 Starting global Event Bus listener...")
		if err := eventBus.Subscribe(ctx, roomService.HandleIncomingPubSubMessage); err != nil {
			log.Printf("Event listener stopped: %v", err)
		}
	}()

	// 6. Initialize API with Injected Service
	server := api.NewServer(roomService)

	// 7. Start Server
	if err := server.Serve(port); err != nil {
		log.Fatalf("Server crashed: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
