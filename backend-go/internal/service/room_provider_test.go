package service_test

import (
	"context"
	"testing"
	"wpbe/internal/domain"
	"wpbe/internal/service"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestRoomService_HandleChangeProvider(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRoomRepository)
	mockBus := new(MockEventBus)
	svc := service.NewRoomService(mockRepo, mockBus)
	roomID := "r1"
	state := &domain.RoomState{
		Provider: "videasy",
		Clients: map[string]domain.UserSummary{
			"host": {ID: "host", Username: "Alice", IsHost: true},
		},
	}

	t.Run("Host can switch provider", func(t *testing.T) {
		mockRepo.On("GetRoomState", ctx, roomID).Return(state, nil).Once()
		mockRepo.On("SaveRoomState", ctx, roomID, mock.MatchedBy(func(s *domain.RoomState) bool {
			return s.Provider == "vidlink"
		})).Return(nil).Once()
		mockBus.On("Publish", ctx, mock.MatchedBy(func(m domain.Message) bool {
			return m.Type == "change_provider" && m.Provider == "vidlink"
		})).Return(nil).Once()

		err := svc.HandleChangeProvider(ctx, roomID, domain.Message{
			UserID:   "host",
			Username: "Alice",
			Provider: "vidlink",
		})
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockBus.AssertExpectations(t)
	})

	t.Run("Invalid provider rejected", func(t *testing.T) {
		err := svc.HandleChangeProvider(ctx, roomID, domain.Message{
			UserID:   "host",
			Username: "Alice",
			Provider: "evil",
		})
		assert.Error(t, err)
	})

	t.Run("Non-host rejected", func(t *testing.T) {
		st := &domain.RoomState{
			Provider: "videasy",
			Clients: map[string]domain.UserSummary{
				"host":  {ID: "host", Username: "Alice", IsHost: true},
				"guest": {ID: "guest", Username: "Bob", IsHost: false},
			},
		}
		mockRepo.On("GetRoomState", ctx, roomID).Return(st, nil).Once()
		err := svc.HandleChangeProvider(ctx, roomID, domain.Message{
			UserID:   "guest",
			Username: "Bob",
			Provider: "vidfast",
		})
		assert.Error(t, err)
	})
}

func TestRoomService_HandleRecommendVideo(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRoomRepository)
	mockBus := new(MockEventBus)
	svc := service.NewRoomService(mockRepo, mockBus)
	roomID := "r1"

	hostCh := make(chan domain.Message, 2)
	host := &domain.Client{
		ID:       "h1",
		Username: "Alice",
		IsHost:   true,
		Send:     hostCh,
	}
	guest := &domain.Client{
		ID:       "g1",
		Username: "Bob",
		IsHost:   false,
		Send:     make(chan domain.Message, 2),
	}
	svc.RegisterLocalClient(roomID, host)
	svc.RegisterLocalClient(roomID, guest)

	msg := domain.Message{
		Type:     "recommend_video",
		Username: "Bob",
		Room:     roomID,
		Data:     map[string]any{"tmdb_id": 1.0, "title": "X"},
	}
	err := svc.HandleRecommendVideo(ctx, roomID, msg)
	assert.NoError(t, err)

	select {
	case got := <-hostCh:
		assert.Equal(t, "recommend_video", got.Type)
	default:
		t.Fatal("host should receive recommendation")
	}
}
