package repository

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"wpbe/internal/domain"

	"github.com/go-redis/redismock/v9"
	"github.com/stretchr/testify/assert"
)

func TestRedisClientOptions_URLAndBareAddr(t *testing.T) {
	t.Run("redis URL", func(t *testing.T) {
		opt, err := redisClientOptions("redis://localhost:6379/0")
		assert.NoError(t, err)
		assert.True(t, strings.Contains(opt.Addr, "6379"))
	})

	t.Run("bare host:port", func(t *testing.T) {
		opt, err := redisClientOptions("localhost:6379")
		assert.NoError(t, err)
		assert.Equal(t, "localhost:6379", opt.Addr)
	})

	t.Run("invalid URL scheme", func(t *testing.T) {
		_, err := redisClientOptions("http://localhost:6379")
		assert.Error(t, err)
	})
}

func TestRedisRepo_GetRoomState(t *testing.T) {
	ctx := context.Background()
	db, mockClient := redismock.NewClientMock()
	repo := &RedisRepo{client: db}

	roomID := "test-room"
	state := domain.RoomState{
		VideoID: 101,
		Playing: true,
	}
	jsonData, _ := json.Marshal(state)

	t.Run("Successfully Get State", func(t *testing.T) {
		mockClient.ExpectGet("room_state:" + roomID).SetVal(string(jsonData))

		result, err := repo.GetRoomState(ctx, roomID)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, 101, result.VideoID)
		assert.True(t, result.Playing)
		assert.NoError(t, mockClient.ExpectationsWereMet())
	})

	t.Run("Room Not Found", func(t *testing.T) {
		mockClient.ExpectGet("room_state:missing").RedisNil()

		result, err := repo.GetRoomState(ctx, "missing")

		assert.NoError(t, err)
		assert.Nil(t, result)
		assert.NoError(t, mockClient.ExpectationsWereMet())
	})
}
