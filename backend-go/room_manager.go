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

// --- 1. JOIN LOGIC ---
func JoinRoom(roomID, username string, ws *websocket.Conn, clientID string) (string, bool, float64, bool) {
	mutex.Lock()
	defer mutex.Unlock()

	if rooms[roomID] == nil {
		rooms[roomID] = &RoomState{
			VideoID: 0, Timestamp: 0, Playing: false, LastUpdated: time.Now(),
			Clients: make(map[string]*Client),
		}
	}
	room := rooms[roomID]

	client := &Client{ID: clientID, Conn: ws, Username: username}

	// This updates client.ID if a previous session is found
	room.AddClient(client)

	// Sync Calculation
	realTime := room.Timestamp
	if room.Playing {
		elapsed := time.Since(room.LastUpdated).Seconds()
		realTime += elapsed
	}

	// 2. CRITICAL FIX: Return client.ID so main.go uses the correct one!
	return client.ID, client.IsHost, realTime, room.Playing
}

// AddClient handles Deduping: If "Alice" joins again, close her old tab and reuse her info
func (r *RoomState) AddClient(client *Client) {
	// Note: We do NOT lock here because JoinRoom already holds the global 'mutex'

	// 1. Check for existing user with same name
	for id, existingClient := range r.Clients {
		if existingClient.Username == client.Username {
			fmt.Printf("♻️  Reclaiming session for %s\n", client.Username)

			// Inherit status and ID
			client.IsHost = existingClient.IsHost
			client.ID = existingClient.ID // IMPORTANT: Frontend keeps the old ID

			// Close the old connection (kicks the other tab)
			existingClient.Conn.Close()
			delete(r.Clients, id)
			break
		}
	}

	// 2. If nobody was found (or after cleaning up old one), check if they should be host
	if len(r.Clients) == 0 {
		client.IsHost = true
	}

	// 3. Register the client
	r.Clients[client.ID] = client
}

// --- 2. COMMAND LOGIC ---

// HandleVideoCommand updates the room state safely
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

// HandleAdminCommand grants/revokes host
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

// --- 3. DISCONNECT LOGIC ---

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
