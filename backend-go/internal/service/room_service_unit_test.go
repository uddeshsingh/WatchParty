package service_test

import (
	"context"
	"testing"
	"wpbe/internal/domain"
	"wpbe/internal/service"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestRoomService_JoinRoom_Unit(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRoomRepository)
	mockBus := new(MockEventBus)
	svc := service.NewRoomService(mockRepo, mockBus)

	roomID := "test-room"
	client := &domain.Client{ID: "user-1", Username: "Alice"}

	t.Run("Create Room (First User)", func(t *testing.T) {
		// GIVEN: No existing room state
		mockRepo.On("GetRoomState", ctx, roomID).Return(nil, nil).Once()
		mockRepo.On("SaveRoomState", ctx, roomID, mock.Anything).Return(nil).Once()
		mockBus.On("Publish", ctx, mock.Anything).Return(nil).Times(2) // request_sync and system message

		// WHEN: Joining room with "create" action
		err := svc.JoinRoom(ctx, roomID, "create", client)

		// THEN: Should succeed and promote user to host
		assert.NoError(t, err)
		assert.True(t, client.IsHost)
		mockRepo.AssertExpectations(t)
		mockBus.AssertExpectations(t)
	})

	t.Run("Join Non-existent Room Should Fail", func(t *testing.T) {
		// GIVEN: No existing room state
		mockRepo.On("GetRoomState", ctx, "missing").Return(nil, nil).Once()

		// WHEN: Joining with "join" action
		err := svc.JoinRoom(ctx, "missing", "join", client)

		// THEN: Should fail with room_not_found_silent
		assert.Error(t, err)
		assert.Equal(t, "room_not_found_silent", err.Error())
	})
}

func TestRoomService_HandleVideoCommand_Unit(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRoomRepository)
	mockBus := new(MockEventBus)
	svc := service.NewRoomService(mockRepo, mockBus)

	roomID := "test-room"
	initialState := &domain.RoomState{
		VideoID:   1,
		Playing:   false,
		Timestamp: 10.0,
	}

	t.Run("Play Command Updates State", func(t *testing.T) {
		// GIVEN: Existing room state
		mockRepo.On("GetRoomState", ctx, roomID).Return(initialState, nil).Once()
		
		// Expectation for state update
		expectedState := &domain.RoomState{
			VideoID:   2,
			Playing:   true,
			Timestamp: 45.5,
		}
		mockRepo.On("SaveRoomState", ctx, roomID, expectedState).Return(nil).Once()
		
		msg := domain.Message{Type: "play", VideoID: 2, Timestamp: 45.5, Room: roomID}
		mockBus.On("Publish", ctx, msg).Return(nil).Once()

		// WHEN: Handling video command
		err := svc.HandleVideoCommand(ctx, roomID, msg)

		// THEN: Should update repo and publish message
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockBus.AssertExpectations(t)
	})
}

func TestRoomService_LeaveRoom_Unit(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRoomRepository)
	mockBus := new(MockEventBus)
	svc := service.NewRoomService(mockRepo, mockBus)

	roomID := "test-room"
	client := &domain.Client{ID: "user-1", Username: "Alice", IsHost: true}

	t.Run("Last User Leaves Deletes Room", func(t *testing.T) {
		// GIVEN: A room with only one user
		state := &domain.RoomState{
			Clients: map[string]domain.UserSummary{
				"user-1": {ID: "user-1", Username: "Alice", IsHost: true},
			},
		}
		mockRepo.On("GetRoomState", ctx, roomID).Return(state, nil).Once()
		mockRepo.On("DeleteRoomState", ctx, roomID).Return(nil).Once()
		mockBus.On("Publish", ctx, mock.MatchedBy(func(msg domain.Message) bool {
			return msg.Type == "room_empty"
		})).Return(nil).Once()

		// WHEN: The user leaves
		svc.LeaveRoom(ctx, roomID, client)

		// THEN: Should delete room state and notify room empty
		mockRepo.AssertExpectations(t)
		mockBus.AssertExpectations(t)
	})
}

func TestRoomService_HandleHostChange_Unit(t *testing.T) {
	ctx := context.Background()
	mockRepo := new(MockRoomRepository)
	mockBus := new(MockEventBus)
	svc := service.NewRoomService(mockRepo, mockBus)

	roomID := "test-room"
	state := &domain.RoomState{
		Clients: map[string]domain.UserSummary{
			"user-1": {ID: "user-1", Username: "Alice", IsHost: true},
			"user-2": {ID: "user-2", Username: "Bob", IsHost: false},
		},
	}

	t.Run("Grant Control Updates Host", func(t *testing.T) {
		mockRepo.On("GetRoomState", ctx, roomID).Return(state, nil).Once()
		mockRepo.On("SaveRoomState", ctx, roomID, mock.Anything).Return(nil).Once()
		mockBus.On("Publish", ctx, mock.Anything).Return(nil).Twice() // host_updated and user_list

		msg := domain.Message{Type: "grant_control", Content: "user-2", Room: roomID}
		
		// WHEN: Granting control to user-2
		err := svc.HandleHostChange(ctx, roomID, msg)

		// THEN: Should succeed
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
		mockBus.AssertExpectations(t)
	})
}
