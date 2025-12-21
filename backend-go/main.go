package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// --- STATE MANAGEMENT ---

// 1. Define what a Room's state looks like
type RoomState struct {
	VideoID   int     `json:"video_id"`
	Timestamp float64 `json:"timestamp"`
	Playing   bool    `json:"playing"`
}

// 2. Maps
var rooms = make(map[string]map[*websocket.Conn]bool) // Active connections
var roomStates = make(map[string]*RoomState)          // Last known state of the room
var mutex = &sync.Mutex{}

type Message struct {
	Type      string  `json:"type"` // "chat", "play", "pause", "seek", "sync_request"
	Username  string  `json:"username"`
	Content   string  `json:"content"`
	Timestamp float64 `json:"timestamp"`
	VideoID   int     `json:"video_id"`
	Room      string  `json:"room"`
}

func main() {
	http.HandleFunc("/ws", handleConnections)
	fmt.Println("🚀 Smart Server (State Aware) started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room")
	if roomID == "" {
		roomID = "general"
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
	}
	defer ws.Close()

	mutex.Lock()
	// Init room map if needed
	if rooms[roomID] == nil {
		rooms[roomID] = make(map[*websocket.Conn]bool)
	}
	// Init room state if needed (Start at 0:00, Paused)
	if roomStates[roomID] == nil {
		roomStates[roomID] = &RoomState{VideoID: 0, Timestamp: 0, Playing: false}
	}
	rooms[roomID][ws] = true

	// 3. IMMEDIATE SYNC: Send the current state to the NEW user only
	currentState := roomStates[roomID]

	// Prepare the sync message
	syncMsg := Message{
		Type:      "sync_state", // Special type for new joiners
		VideoID:   currentState.VideoID,
		Timestamp: currentState.Timestamp,
		// If playing is true, we might calculate "Time + (Now - LastUpdate)",
		// but for simplicity, we just send the last known timestamp.
	}

	// If the room is playing, tell the client to play.
	if currentState.Playing {
		syncMsg.Content = "playing"
	} else {
		syncMsg.Content = "paused"
	}

	ws.WriteJSON(syncMsg)
	mutex.Unlock()

	fmt.Printf("✅ Client joined %s. Sent state: %v\n", roomID, currentState)

	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			mutex.Lock()
			delete(rooms[roomID], ws)
			if len(rooms[roomID]) == 0 {
				delete(rooms, roomID)
				delete(roomStates, roomID) // Clean up state if empty
			}
			mutex.Unlock()
			break
		}

		msg.Room = roomID

		// 4. UPDATE STATE based on the message
		mutex.Lock()
		if state, exists := roomStates[roomID]; exists {
			if msg.Type == "play" {
				state.Playing = true
				state.Timestamp = msg.Timestamp
				state.VideoID = msg.VideoID
			} else if msg.Type == "pause" {
				state.Playing = false
				state.Timestamp = msg.Timestamp
			} else if msg.Type == "seek" {
				state.Timestamp = msg.Timestamp
			}
		}
		mutex.Unlock()

		broadcastToRoom(roomID, msg)
	}
}

func broadcastToRoom(roomID string, msg Message) {
	mutex.Lock()
	defer mutex.Unlock()
	for client := range rooms[roomID] {
		client.WriteJSON(msg)
	}
}
