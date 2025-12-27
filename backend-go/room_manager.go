package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var rooms = make(map[string]*RoomState)
var mutex = &sync.Mutex{}

// --- CORE LOGIC ---

func JoinRoom(roomID, username string, ws *websocket.Conn, clientID string, action string) (string, bool, float64, bool, int, error) {
	mutex.Lock()
	defer mutex.Unlock()

	room := rooms[roomID]
	exists := room != nil

	// 1. Handle "Join" Action (Must Exist)
	if action == "join" && !exists {
		return "", false, 0, false, 0, fmt.Errorf("room_not_found")
	}

	// 2. Handle "Create" Action (Must NOT Exist, unless reconnecting)
	if action == "create" && exists {
		isReconnect := false
		// Allow if user is ALREADY in the room (e.g. React Strict Mode refresh)
		if room != nil {
			for _, c := range room.Clients {
				if c.Username == username {
					isReconnect = true
					break
				}
			}
		}

		if len(room.Clients) > 0 && !isReconnect {
			return "", false, 0, false, 0, fmt.Errorf("room_exists")
		}
	}

	// 3. Initialize Room if needed
	if !exists {
		rooms[roomID] = &RoomState{
			VideoID: 0, Timestamp: 0, Playing: false, LastUpdated: time.Now(),
			Clients: make(map[string]*Client),
		}
		room = rooms[roomID]
	}

	// 4. Cancel Deletion (Revive Room)
	if room.DeleteTimer != nil {
		room.DeleteTimer.Stop()
		room.DeleteTimer = nil
	}

	client := &Client{ID: clientID, Conn: ws, Username: username}
	room.AddClient(client)

	// 5. Calculate Sync State
	realTime := room.Timestamp
	if room.Playing {
		realTime += time.Since(room.LastUpdated).Seconds()
	}

	return client.ID, client.IsHost, realTime, room.Playing, room.VideoID, nil
}

func (r *RoomState) AddClient(client *Client) {
	// Handle Session Swapping (Reconnects)
	for id, existingClient := range r.Clients {
		if existingClient.Username == client.Username {
			client.IsHost = existingClient.IsHost
			client.ID = existingClient.ID
			existingClient.Conn.Close() // Close old socket
			delete(r.Clients, id)
			break
		}
	}

	// Auto-Promote to Host if First
	if len(r.Clients) == 0 {
		client.IsHost = true
	}

	r.Clients[client.ID] = client
}

func HandleDisconnect(roomID, clientID string, conn *websocket.Conn) {
	mutex.Lock()

	room := rooms[roomID]
	if room == nil {
		mutex.Unlock()
		return
	}

	client := room.Clients[clientID]
	if client == nil {
		mutex.Unlock()
		return
	}

	// IGNORE if this is an old connection (already swapped)
	if client.Conn != conn {
		mutex.Unlock()
		return
	}

	// Save Timestamp before removing
	if room.Playing {
		room.Timestamp += time.Since(room.LastUpdated).Seconds()
		room.LastUpdated = time.Now()
	}

	delete(room.Clients, clientID)

	// IF EMPTY: Schedule Deletion (Grace Period)
	if len(room.Clients) == 0 {
		room.DeleteTimer = time.AfterFunc(10*time.Second, func() {
			mutex.Lock()
			defer mutex.Unlock()
			if _, ok := rooms[roomID]; ok && len(rooms[roomID].Clients) == 0 {
				delete(rooms, roomID)
			}
		})
		mutex.Unlock()
		return
	}

	// HOST TRANSFER (if needed)
	var newHost *Client
	if client.IsHost {
		for _, c := range room.Clients {
			c.IsHost = true
			newHost = c
			break
		}
	}
	mutex.Unlock()

	if newHost != nil {
		newHost.Conn.WriteJSON(Message{Type: "identity", UserID: newHost.ID, IsHost: true})
		Broadcast(roomID, Message{Type: "system", Content: newHost.Username + " is now the Host."})
	}

	BroadcastUserList(roomID)
}

// --- HELPERS ---

func GetActiveRooms() []RoomSummary {
	mutex.Lock()
	defer mutex.Unlock()
	var summaries []RoomSummary
	for name, state := range rooms {
		if len(state.Clients) > 0 {
			summaries = append(summaries, RoomSummary{Name: name, Count: len(state.Clients)})
		}
	}
	return summaries
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
	} else if msg.Type == "pause" {
		room.Playing = false
	}
	room.Timestamp = msg.Timestamp
	room.LastUpdated = time.Now()
	return true
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

	if target, ok := room.Clients[msg.Content]; ok {
		target.IsHost = (msg.Type == "grant_control")
		target.Conn.WriteJSON(Message{Type: "identity", UserID: target.ID, IsHost: target.IsHost})
	}
}

func Broadcast(roomID string, msg Message) {
	mutex.Lock()
	room := rooms[roomID]
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
