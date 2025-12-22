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

// JoinRoom handles a new user, adds them to the map, and calculates the Sync State
// Returns: ClientID, IsHost, RealTimestamp, IsPlaying
func JoinRoom(roomID, username string, ws *websocket.Conn, clientID string) (bool, float64, bool) {
	mutex.Lock()
	defer mutex.Unlock()

	// Use the helper to ensure room exists
	if rooms[roomID] == nil {
		rooms[roomID] = &RoomState{
			VideoID: 0, Timestamp: 0, Playing: false, LastUpdated: time.Now(),
			Clients: make(map[string]*Client),
		}
	}
	room := rooms[roomID]

	// Determine Host Status
	isFirst := len(room.Clients) == 0

	// Add Client
	client := &Client{ID: clientID, Conn: ws, Username: username, IsHost: isFirst}
	room.Clients[clientID] = client

	// CALCULATE TIME FOR SYNC
	// This fixes the "0:00" bug on reload
	realTime := room.Timestamp
	if room.Playing {
		elapsed := time.Since(room.LastUpdated).Seconds()
		realTime += elapsed
		// Optional: Log here to debug
		fmt.Printf("🧮 JOIN CALC: Saved=%.2f + Elapsed=%.2f = Sending=%.2f\n", room.Timestamp, elapsed, realTime)
	}

	return isFirst, realTime, room.Playing
}

// --- 2. COMMAND LOGIC ---

// HandleVideoCommand updates the room state safely
// Returns: ShouldBroadcast (bool)
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
	} // Only Host can command

	// Update State
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
		// Notify target directly
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

	// SAVE STATE (Fixes "Reset to 0" on host leave)
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
		// Check for other hosts
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
	mutex.Unlock() // Unlock before broadcast

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

	// Only Host can change the video
	sender := room.Clients[clientID]
	if sender == nil || !sender.IsHost {
		return false
	}

	// RESET STATE
	room.VideoID = msg.VideoID
	room.Timestamp = 0   // <--- THE FIX: Reset time to 0
	room.Playing = false // Pause automatically
	room.LastUpdated = time.Now()

	return true // Broadcast this change
}

// --- 4. BROADCAST HELPERS ---

func Broadcast(roomID string, msg Message) {
	mutex.Lock()
	room := rooms[roomID]
	if room == nil {
		mutex.Unlock()
		return
	}
	var conns []*websocket.Conn
	for _, c := range room.Clients {
		conns = append(conns, c.Conn)
	}
	mutex.Unlock()

	for _, conn := range conns {
		conn.WriteJSON(msg)
	}
}

func BroadcastUserList(roomID string) {
	mutex.Lock()
	room := rooms[roomID]
	if room == nil {
		mutex.Unlock()
		return
	}
	var list []UserSummary
	var conns []*websocket.Conn
	for _, c := range room.Clients {
		list = append(list, UserSummary{ID: c.ID, Username: c.Username, IsHost: c.IsHost})
		conns = append(conns, c.Conn)
	}
	mutex.Unlock()

	msg := Message{Type: "user_list", UserList: list}
	for _, conn := range conns {
		conn.WriteJSON(msg)
	}
}
