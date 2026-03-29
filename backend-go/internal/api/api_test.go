package api_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"wpbe/internal/api"
	"wpbe/internal/domain"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestMain(m *testing.M) {
	os.Setenv("JWT_SECRET", "test-secret-key-for-api-tests")
	os.Exit(m.Run())
}

// MockRoomManager implements domain.RoomManager
type MockRoomManager struct {
	mock.Mock
}

func (m *MockRoomManager) RegisterLocalClient(roomID string, client *domain.Client) {
	m.Called(roomID, client)
}

func (m *MockRoomManager) RemoveLocalClient(roomID string, client *domain.Client) {
	m.Called(roomID, client)
}

func (m *MockRoomManager) HandleVideoCommand(ctx context.Context, roomID string, msg domain.Message) error {
	args := m.Called(ctx, roomID, msg)
	return args.Error(0)
}

func (m *MockRoomManager) PublishDirectEvent(ctx context.Context, msg domain.Message) error {
	args := m.Called(ctx, msg)
	return args.Error(0)
}

func (m *MockRoomManager) JoinRoom(ctx context.Context, roomID string, action string, client *domain.Client) error {
	args := m.Called(ctx, roomID, action, client)
	return args.Error(0)
}

func (m *MockRoomManager) LeaveRoom(ctx context.Context, roomID string, client *domain.Client) {
	m.Called(ctx, roomID, client)
}

func (m *MockRoomManager) GetActiveRooms(ctx context.Context) ([]domain.RoomSummary, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]domain.RoomSummary), args.Error(1)
}

func (m *MockRoomManager) HandleChangeVideo(ctx context.Context, roomID string, msg domain.Message) error {
	args := m.Called(ctx, roomID, msg)
	return args.Error(0)
}

func (m *MockRoomManager) HandleHostChange(ctx context.Context, roomID string, msg domain.Message) error {
	args := m.Called(ctx, roomID, msg)
	return args.Error(0)
}

func (m *MockRoomManager) HandleChangeProvider(ctx context.Context, roomID string, msg domain.Message) error {
	args := m.Called(ctx, roomID, msg)
	return args.Error(0)
}

func (m *MockRoomManager) HandleRecommendVideo(ctx context.Context, roomID string, msg domain.Message) error {
	args := m.Called(ctx, roomID, msg)
	return args.Error(0)
}

func TestServer_HealthCheck(t *testing.T) {
	mockManager := new(MockRoomManager)
	server := api.NewServer(mockManager, nil)

	req, _ := http.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()

	server.Router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.JSONEq(t, `{"status":"healthy"}`, rr.Body.String())
}

func TestServer_GetRooms(t *testing.T) {
	mockManager := new(MockRoomManager)
	server := api.NewServer(mockManager, nil)

	rooms := []domain.RoomSummary{
		{Name: "room1", Count: 5},
	}
	mockManager.On("GetActiveRooms", mock.Anything).Return(rooms, nil)

	req, _ := http.NewRequest("GET", "/rooms", nil)
	rr := httptest.NewRecorder()

	server.Router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var response []domain.RoomSummary
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(response))
	assert.Equal(t, "room1", response[0].Name)
	assert.Equal(t, 5, response[0].Count)
}
