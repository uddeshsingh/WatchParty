package service_test

import (
	"context"
	"testing"
	"wpbe/internal/domain"
	"wpbe/internal/pubsub"
	"wpbe/internal/repository"
	"wpbe/internal/service"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoomService_LiveIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()

	// 1. Connect to actual local Redis
	repo, err := repository.NewRedisRepo("redis://localhost:6379")
	require.NoError(t, err)

	// 2. Connect to actual GCP Pub/Sub
	bus, err := pubsub.NewGCPPubSub(ctx, "watchparty-482106", "watchparty-events")
	require.NoError(t, err)

	svc := service.NewRoomService(repo, bus)
	roomID := "live-test-room"
	client := &domain.Client{ID: "test-user-1", Username: "Alice"}

	t.Run("Full Room Lifecycle", func(t *testing.T) {
		// Join/Create room
		err := svc.JoinRoom(ctx, roomID, "create", client)
		assert.NoError(t, err)

		// Verify state in Redis
		state, _ := repo.GetRoomState(ctx, roomID)
		assert.NotNil(t, state)
		assert.True(t, state.Clients[client.ID].IsHost)

		// Cleanup
		repo.DeleteRoomState(ctx, roomID)
	})
}
