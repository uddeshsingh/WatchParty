package repository

import (
	"context"
	"encoding/json"
	"time"

	"wpbe/internal/domain"

	"github.com/redis/go-redis/v9"
)

type RedisRepo struct {
	client *redis.Client
}

func NewRedisRepo(addr string) (*RedisRepo, error) {
	client := redis.NewClient(&redis.Options{
		Addr: addr,
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}

	ctx := context.Background()
	iter := client.Scan(ctx, 0, "room_state:*", 0).Iterator()
	for iter.Next(ctx) {
		client.Del(ctx, iter.Val())
	}

	return &RedisRepo{client: client}, nil
}

func (r *RedisRepo) GetRoomState(ctx context.Context, roomID string) (*domain.RoomState, error) {
	data, err := r.client.Get(ctx, "room_state:"+roomID).Result()
	if err == redis.Nil {
		return nil, nil // Room doesn't exist
	} else if err != nil {
		return nil, err
	}

	var state domain.RoomState
	if err := json.Unmarshal([]byte(data), &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (r *RedisRepo) SaveRoomState(ctx context.Context, roomID string, state *domain.RoomState) error {
	state.LastUpdated = time.Now()
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, "room_state:"+roomID, data, 24*time.Hour).Err()
}

func (r *RedisRepo) DeleteRoomState(ctx context.Context, roomID string) error {
	return r.client.Del(ctx, "room_state:"+roomID).Err()
}

// Add to the bottom of internal/repository/redis.go

func (r *RedisRepo) GetActiveRooms(ctx context.Context) ([]domain.RoomSummary, error) {
	var summaries []domain.RoomSummary

	// Use Redis SCAN to find all room keys without blocking the database
	var cursor uint64
	for {
		var keys []string
		var err error
		keys, cursor, err = r.client.Scan(ctx, cursor, "room_state:*", 100).Result()
		if err != nil {
			return nil, err
		}

		for _, key := range keys {
			// Extract roomID from "room_state:xyz"
			roomID := key[len("room_state:"):]

			// Fetch the state to see how many users are in it
			state, err := r.GetRoomState(ctx, roomID)
			if err == nil && state != nil && len(state.Clients) > 0 {
				summaries = append(summaries, domain.RoomSummary{
					Name:    roomID,
					Count:   len(state.Clients),
					VideoID: state.VideoID,
				})
			}
		}

		if cursor == 0 {
			break
		}
	}

	// Return empty array instead of nil for JSON serialization
	if summaries == nil {
		return []domain.RoomSummary{}, nil
	}
	return summaries, nil
}
