//go:build integration

package service_test

import (
	"context"
	"os"
	"testing"
	"wpbe/internal/domain"
	"wpbe/internal/pubsub"
	"wpbe/internal/repository"
	"wpbe/internal/service"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoomService_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()

	// 1. Connect to ACTUAL Redis
	repo, err := repository.NewRedisRepo("redis://localhost:6379")
	require.NoError(t, err, "Must have Redis running on localhost:6379")

	projectID := os.Getenv("GCP_PROJECT_ID")
	if projectID == "" {
		projectID = "watchparty-482106"
	}

	bus, err := pubsub.NewGCPPubSub(ctx, projectID, "watchparty-events")
	require.NoError(t, err, "Must be authenticated with GCP")

	// 3. Initialize the real service
	svc := service.NewRoomService(repo, bus)
	roomID := "integration-test-room"

	// Cleanup real DB before and after tests
	repo.DeleteRoomState(ctx, roomID)
	defer repo.DeleteRoomState(ctx, roomID)

	clientA := &domain.Client{ID: "user-A", Username: "Alice", Conn: nil}
	clientB := &domain.Client{ID: "user-B", Username: "Bob", Conn: nil}

	t.Run("Create Room & Assign Host", func(t *testing.T) {
		err := svc.JoinRoom(ctx, roomID, "create", clientA)
		assert.NoError(t, err)
		assert.True(t, clientA.IsHost, "First user should be promoted to host")

		state, err := repo.GetRoomState(ctx, roomID)
		assert.NoError(t, err)
		assert.NotNil(t, state)
		assert.Equal(t, 1, len(state.Clients))
	})

	t.Run("Second User Joins as Guest", func(t *testing.T) {
		err := svc.JoinRoom(ctx, roomID, "join", clientB)
		assert.NoError(t, err)
		assert.False(t, clientB.IsHost, "Second user should not be host")

		state, _ := repo.GetRoomState(ctx, roomID)
		assert.Equal(t, 2, len(state.Clients))
	})

	t.Run("Handle Video Command (Play)", func(t *testing.T) {
		msg := domain.Message{Type: "play", Timestamp: 12.5, VideoID: 1, Room: roomID}
		err := svc.HandleVideoCommand(ctx, roomID, msg)
		assert.NoError(t, err)

		// Verify it actually saved to Redis
		state, _ := repo.GetRoomState(ctx, roomID)
		assert.True(t, state.Playing)
		assert.Equal(t, 12.5, state.Timestamp)
	})

	t.Run("Handle Host Change", func(t *testing.T) {
		msg := domain.Message{Type: "grant_control", Content: clientB.ID, Room: roomID}
		err := svc.HandleHostChange(ctx, roomID, msg)
		assert.NoError(t, err)

		state, _ := repo.GetRoomState(ctx, roomID)
		assert.True(t, state.Clients[clientB.ID].IsHost)
	})
}
