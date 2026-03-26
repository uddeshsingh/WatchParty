package service_test

import (
	"context"
	"wpbe/internal/domain"

	"github.com/stretchr/testify/mock"
)

// MockRoomRepository implements domain.RoomRepository
type MockRoomRepository struct {
	mock.Mock
}

func (m *MockRoomRepository) GetRoomState(ctx context.Context, roomID string) (*domain.RoomState, error) {
	args := m.Called(ctx, roomID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domain.RoomState), args.Error(1)
}

func (m *MockRoomRepository) SaveRoomState(ctx context.Context, roomID string, state *domain.RoomState) error {
	args := m.Called(ctx, roomID, state)
	return args.Error(0)
}

func (m *MockRoomRepository) DeleteRoomState(ctx context.Context, roomID string) error {
	args := m.Called(ctx, roomID)
	return args.Error(0)
}

func (m *MockRoomRepository) GetActiveRooms(ctx context.Context) ([]domain.RoomSummary, error) {
	args := m.Called(ctx)
	return args.Get(0).([]domain.RoomSummary), args.Error(1)
}

// MockEventBus implements domain.EventBus
type MockEventBus struct {
	mock.Mock
}

func (m *MockEventBus) Publish(ctx context.Context, msg domain.Message) error {
	args := m.Called(ctx, msg)
	return args.Error(0)
}

func (m *MockEventBus) Subscribe(ctx context.Context, handler func(domain.Message)) error {
	args := m.Called(ctx, handler)
	return args.Error(0)
}
