package service

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"wpbe/internal/domain"
)

type RoomService struct {
	repo         domain.RoomRepository
	bus          domain.EventBus
	localClients map[string]map[string]*domain.Client
	mu           sync.RWMutex
}

func NewRoomService(repo domain.RoomRepository, bus domain.EventBus) *RoomService {
	return &RoomService{
		repo:         repo,
		bus:          bus,
		localClients: make(map[string]map[string]*domain.Client),
	}
}

func (s *RoomService) RegisterLocalClient(roomID string, client *domain.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.localClients[roomID] == nil {
		s.localClients[roomID] = make(map[string]*domain.Client)
	}
	s.localClients[roomID][client.ID] = client
}

func (s *RoomService) RemoveLocalClient(roomID string, client *domain.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if clients, ok := s.localClients[roomID]; ok {
		if existing, exists := clients[client.ID]; exists && existing == client {
			delete(clients, client.ID)
			if len(clients) == 0 {
				delete(s.localClients, roomID)
			}
		}
	}
}

func (s *RoomService) HandleVideoCommand(ctx context.Context, roomID string, msg domain.Message) error {
	state, err := s.repo.GetRoomState(ctx, roomID)
	if err != nil {
		return err
	}
	if state == nil {
		state = &domain.RoomState{}
	}

	switch msg.Type {
	case "play":
		state.Playing = true
	case "pause":
		state.Playing = false
	}

	state.Timestamp = msg.Timestamp
	state.VideoID = msg.VideoID

	if err := s.repo.SaveRoomState(ctx, roomID, state); err != nil {
		return err
	}

	return s.bus.Publish(ctx, msg)
}

func (s *RoomService) HandleHostChange(ctx context.Context, roomID string, msg domain.Message) error {
	state, err := s.repo.GetRoomState(ctx, roomID)
	if err != nil || state == nil {
		return err
	}

	targetID := msg.Content
	isPromoting := msg.Type == "grant_control"

	if user, ok := state.Clients[targetID]; ok {
		user.IsHost = isPromoting
		state.Clients[targetID] = user
		s.repo.SaveRoomState(ctx, roomID, state)

		s.bus.Publish(ctx, domain.Message{
			Type:   "host_updated",
			Room:   roomID,
			UserID: targetID,
			IsHost: isPromoting,
		})
	}

	s.BroadcastUserList(ctx, roomID, state)
	return nil
}

func (s *RoomService) HandleChangeVideo(ctx context.Context, roomID string, msg domain.Message) error {
	state, err := s.repo.GetRoomState(ctx, roomID)
	if err != nil {
		return err
	}
	if state == nil {
		state = &domain.RoomState{}
	}

	state.VideoID = msg.VideoID
	state.Playing = true
	state.LastUpdated = time.Now()

	if err := s.repo.SaveRoomState(ctx, roomID, state); err != nil {
		return err
	}

	return s.bus.Publish(ctx, msg)
}

func (s *RoomService) PublishDirectEvent(ctx context.Context, msg domain.Message) error {
	return s.bus.Publish(ctx, msg)
}

func (s *RoomService) HandleIncomingPubSubMessage(msg domain.Message) {
	s.mu.RLock()
	clientsMap, hasLocalClients := s.localClients[msg.Room]

	if hasLocalClients {
		finalMsg := msg
		if msg.Type == "video_added" {
			finalMsg.Type = "playlist_updated"
		}

		for _, client := range clientsMap {
			select {
			case client.Send <- finalMsg:
			default:
				// If the channel is full, the client is too slow.
				// The connection will be cleaned up by the handler.
				log.Printf("Dropping message for slow client: %s", client.ID)
			}
		}
	}
	s.mu.RUnlock()
}

func (s *RoomService) JoinRoom(ctx context.Context, roomID, action string, client *domain.Client) error {
	state, err := s.repo.GetRoomState(ctx, roomID)
	if err != nil {
		return err
	}

	exists := state != nil && len(state.Clients) > 0

	if action == "join" && !exists {
		return fmt.Errorf("room_not_found_silent")
	}

	isReconnect := false
	if exists {
		for id, existingClient := range state.Clients {
			if existingClient.Username == client.Username {
				isReconnect = true
				client.IsHost = existingClient.IsHost
				client.ID = existingClient.ID
				delete(state.Clients, id)
				break
			}
		}
	}

	if action == "create" && exists && !isReconnect {
		return fmt.Errorf("room_exists")
	}

	if state == nil {
		state = &domain.RoomState{
			Clients: make(map[string]domain.UserSummary),
		}
	}
	if state.Clients == nil {
		state.Clients = make(map[string]domain.UserSummary)
	}

	if len(state.Clients) == 0 {
		client.IsHost = true
	}

	state.Clients[client.ID] = domain.UserSummary{
		ID:       client.ID,
		Username: client.Username,
		IsHost:   client.IsHost,
		JoinedAt: time.Now(),
	}

	s.RegisterLocalClient(roomID, client)
	s.repo.SaveRoomState(ctx, roomID, state)

	if client.Conn != nil {
		client.Conn.WriteJSON(domain.Message{Type: "identity", UserID: client.ID, IsHost: client.IsHost})

		s.bus.Publish(ctx, domain.Message{
			Type: "request_sync",
			Room: roomID,
		})
	}

	s.BroadcastUserList(ctx, roomID, state)

	if !isReconnect {
		s.bus.Publish(ctx, domain.Message{
			Type:    "system",
			Room:    roomID,
			Content: client.Username + " joined the party!",
		})
	}
	return nil
}

func (s *RoomService) LeaveRoom(ctx context.Context, roomID string, client *domain.Client) {
	s.RemoveLocalClient(roomID, client)

	state, _ := s.repo.GetRoomState(ctx, roomID)
	if state != nil && state.Clients != nil {
		user, exists := state.Clients[client.ID]

		if exists {
			delete(state.Clients, client.ID)

			if len(state.Clients) == 0 {
				s.repo.DeleteRoomState(ctx, roomID)
				s.bus.Publish(ctx, domain.Message{
					Type: "room_empty",
					Room: roomID,
				})
				return
			}

			hasHost := false
			for _, u := range state.Clients {
				if u.IsHost {
					hasHost = true
					break
				}
			}
			if !hasHost {
				if !hasHost {
					var oldestUser string
					var oldestTime time.Time
					first := true

					for id, u := range state.Clients {
						if first || u.JoinedAt.Before(oldestTime) {
							oldestTime = u.JoinedAt
							oldestUser = id
							first = false
						}
					}

					if oldestUser != "" {
						u := state.Clients[oldestUser]
						u.IsHost = true
						state.Clients[oldestUser] = u
					}
				}
			}

			s.repo.SaveRoomState(ctx, roomID, state)
			s.BroadcastUserList(ctx, roomID, state)

			s.bus.Publish(ctx, domain.Message{
				Type:    "system",
				Room:    roomID,
				Content: user.Username + " left the party.",
			})
		}
	}
}

func (s *RoomService) BroadcastUserList(ctx context.Context, roomID string, state *domain.RoomState) {
	var list []domain.UserSummary
	for _, u := range state.Clients {
		list = append(list, u)
	}
	s.bus.Publish(ctx, domain.Message{Type: "user_list", Room: roomID, UserList: list})
}

func (s *RoomService) GetActiveRooms(ctx context.Context) ([]domain.RoomSummary, error) {
	return s.repo.GetActiveRooms(ctx)
}
