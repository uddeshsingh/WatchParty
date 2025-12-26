package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Global State
var rooms = make(map[string]*RoomState)
var mutex = &sync.Mutex{}

// CHANGED: Added 'action' parameter and 'error' return type
func JoinRoom(roomID, username string, ws *websocket.Conn, clientID string, action string) (string, bool, float64, bool, int, error) {
	mutex.Lock()
	defer mutex.Unlock()

	exists := rooms[roomID] != nil

	// RULE 1: If joining via Link (action="join"), Room MUST exist
	if action == "join" && !exists {
		return "", false, 0, false, 0, fmt.Errorf("room_not_found")
	}

	// RULE 2: If Creating (action="create"), Room MUST NOT exist
	if action == "create" && exists {
		return "", false, 0, false, 0, fmt.Errorf("room_exists")
	}

	// If room doesn't exist (and action is 'create'), make it
	if !exists {
		rooms[roomID] = &RoomState{
			VideoID: 0, Timestamp: 0, Playing: false, LastUpdated: time.Now(),
			Clients: make(map[string]*Client),
		}
	}
	room := rooms[roomID]

	client := &Client{ID: clientID, Conn: ws, Username: username}
	room.AddClient(client)

	realTime := room.Timestamp
	if room.Playing {
		elapsed := time.Since(room.LastUpdated).Seconds()
		realTime += elapsed
	}

	return client.ID, client.IsHost, realTime, room.Playing, room.VideoID, nil
}

func (r *RoomState) AddClient(client *Client) {
	for id, existingClient := range r.Clients {
		if existingClient.Username == client.Username {
			fmt.Printf("♻️  Reclaiming session for %s\n", client.Username)

			client.IsHost = existingClient.IsHost
			client.ID = existingClient.ID

			existingClient.Conn.Close()
			delete(r.Clients, id)
			break
		}
	}

	if len(r.Clients) == 0 {
		client.IsHost = true
	}

	r.Clients[client.ID] = client
}

func HandleVideoCommand(roomID, clientID string, msg Message) bool {
	mutex.Lock()
	defer mutex.Unlock()

	room := rooms[roomID]
	if room == nil {
		return false
	}

	sender := room.Clients[clientID]
	if sender == nil || !sender.IsHost {
		return false
	}

	if msg.Type == "play" {
		room.Playing = true
		room.Timestamp = msg.Timestamp
		room.LastUpdated = time.Now()
	} else if msg.Type == "pause" {
		room.Playing = false
		room.Timestamp = msg.Timestamp
		room.LastUpdated = time.Now()
	} else if msg.Type == "seek" {
		room.Timestamp = msg.Timestamp
		room.LastUpdated = time.Now()
	}

	return true
}

func HandleAdminCommand(roomID, clientID string, msg Message) {
	mutex.Lock()
	defer mutex.Unlock()

	room := rooms[roomID]
	if room == nil {
		return
	}

	sender := room.Clients[clientID]
	if sender == nil || !sender.IsHost {
		return
	}

	targetID := msg.Content
	if target, ok := room.Clients[targetID]; ok {
		target.IsHost = (msg.Type == "grant_control")
		target.Conn.WriteJSON(Message{Type: "identity", UserID: target.ID, IsHost: target.IsHost})
	}
}

func HandleDisconnect(roomID, clientID string) {
	mutex.Lock()

	room := rooms[roomID]
	if room == nil {
		mutex.Unlock()
		return
	}

	leavingClient := room.Clients[clientID]
	if leavingClient == nil {
		mutex.Unlock()
		return
	}

	// SAVE STATE
	if room.Playing {
		room.Timestamp += time.Since(room.LastUpdated).Seconds()
		room.LastUpdated = time.Now()
	}

	delete(room.Clients, clientID)

	if len(room.Clients) == 0 {
		delete(rooms, roomID)
		mutex.Unlock()
		return
	}

	// HOST TRANSFER
	var newHost *Client
	if leavingClient.IsHost {
		// Check if anyone else is already host (shouldn't happen usually)
		hasOtherHost := false
		for _, c := range room.Clients {
			if c.IsHost {
				hasOtherHost = true
				break
			}
		}
		if !hasOtherHost {
			// Promote first available
			for _, c := range room.Clients {
				c.IsHost = true
				newHost = c
				break
			}
		}
	}
	mutex.Unlock() // Unlock before broadcasting

	if newHost != nil {
		fmt.Printf("👑 Host left. New Host: %s\n", newHost.Username)
		newHost.Conn.WriteJSON(Message{Type: "identity", UserID: newHost.ID, IsHost: true})
		Broadcast(roomID, Message{Type: "system", Content: newHost.Username + " is now the Host."})
	}

	BroadcastUserList(roomID)
}

func HandleChangeVideo(roomID, clientID string, msg Message) bool {
	mutex.Lock()
	defer mutex.Unlock()

	room := rooms[roomID]
	if room == nil {
		return false
	}

	sender := room.Clients[clientID]
	if sender == nil || !sender.IsHost {
		return false
	}

	room.VideoID = msg.VideoID
	room.Timestamp = 0
	room.Playing = false
	room.LastUpdated = time.Now()

	return true
}

func GetActiveRooms() []RoomSummary {
	mutex.Lock()
	defer mutex.Unlock()

	var summaries []RoomSummary
	for name, state := range rooms {
		if len(state.Clients) > 0 {
			summaries = append(summaries, RoomSummary{
				Name:  name,
				Count: len(state.Clients),
			})
		}
	}
	return summaries
}

// --- 4. BROADCAST HELPERS ---

func Broadcast(roomID string, msg Message) {
	mutex.Lock()
	room := rooms[roomID]
	// We need to copy clients to a slice so we can unlock quickly
	// This prevents deadlocks if a WriteJSON blocks
	var conns []*websocket.Conn
	if room != nil {
		for _, c := range room.Clients {
			conns = append(conns, c.Conn)
		}
	}
	mutex.Unlock()

	for _, conn := range conns {
		conn.WriteJSON(msg)
	}
}

func BroadcastUserList(roomID string) {
	mutex.Lock()
	room := rooms[roomID]
	var list []UserSummary
	var conns []*websocket.Conn

	if room != nil {
		for _, c := range room.Clients {
			list = append(list, UserSummary{ID: c.ID, Username: c.Username, IsHost: c.IsHost})
			conns = append(conns, c.Conn)
		}
	}
	mutex.Unlock()

	msg := Message{Type: "user_list", UserList: list}
	for _, conn := range conns {
		conn.WriteJSON(msg)
	}
}
