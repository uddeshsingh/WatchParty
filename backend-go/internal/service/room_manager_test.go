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

	var bus domain.EventBus
	if os.Getenv("WP_INTEGRATION_LOCAL_BUS") == "1" {
		bus = pubsub.NewLocalBus()
	} else {
		var err error
		bus, err = pubsub.NewGCPPubSub(ctx, projectID, "watchparty-events")
		require.NoError(t, err, "Need GCP Pub/Sub or emulator; or set WP_INTEGRATION_LOCAL_BUS=1 for LocalBus-only")
	}

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
		msg := domain.Message{Type: "play", Timestamp: 12.5, VideoID: 1, Room: roomID, UserID: clientA.ID}
		err := svc.HandleVideoCommand(ctx, roomID, msg)
		assert.NoError(t, err)

		state, _ := repo.GetRoomState(ctx, roomID)
		assert.True(t, state.Playing)
		assert.Equal(t, 12.5, state.Timestamp)
	})

	t.Run("Handle Video Command Rejected for Non-Host", func(t *testing.T) {
		msg := domain.Message{Type: "play", Timestamp: 15.0, VideoID: 1, Room: roomID, UserID: clientB.ID}
		err := svc.HandleVideoCommand(ctx, roomID, msg)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "unauthorized")
	})

	t.Run("Handle Host Change", func(t *testing.T) {
		msg := domain.Message{Type: "grant_control", Content: clientB.ID, Room: roomID, UserID: clientA.ID}
		err := svc.HandleHostChange(ctx, roomID, msg)
		assert.NoError(t, err)

		state, _ := repo.GetRoomState(ctx, roomID)
		assert.True(t, state.Clients[clientB.ID].IsHost)
	})

	providerRoom := "integration-provider-room"
	repo.DeleteRoomState(ctx, providerRoom)
	defer repo.DeleteRoomState(ctx, providerRoom)

	t.Run("HandleChangeProvider persists in Redis", func(t *testing.T) {
		host := &domain.Client{ID: "provider-host", Username: "PHost", Conn: nil}
		require.NoError(t, svc.JoinRoom(ctx, providerRoom, "create", host))

		err := svc.HandleChangeProvider(ctx, providerRoom, domain.Message{
			UserID:   host.ID,
			Username: host.Username,
			Provider: "vidfast",
		})
		assert.NoError(t, err)

		st, err := repo.GetRoomState(ctx, providerRoom)
		assert.NoError(t, err)
		require.NotNil(t, st)
		assert.Equal(t, "vidfast", st.Provider)
	})
}
