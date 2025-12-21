package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	http.HandleFunc("/ws", handleConnections)

	// --- NEW: DEBUG LOGGER ---
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		for range ticker.C {
			// LOCK to read safely
			mutex.Lock()
			for id, room := range rooms {
				currentState := "Paused"
				realTime := room.Timestamp

				if room.Playing {
					currentState = "Playing"
					elapsed := time.Since(room.LastUpdated).Seconds()
					realTime += elapsed
				}

				fmt.Printf("⏱️ [Room %s] Status: %s | Base: %.2f | Calculated Time: %.2f\n",
					id, currentState, room.Timestamp, realTime)
			}
			mutex.Unlock()
		}
	}()
	// -------------------------

	fmt.Println("🚀 Modular Server (Sync Fixed) started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	// 1. SETUP
	roomID := r.URL.Query().Get("room")
	username := r.URL.Query().Get("username")
	if roomID == "" {
		roomID = "general"
	}
	if username == "" {
		username = "Anon"
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatal(err)
	}

	clientID := uuid.New().String()

	// 2. JOIN ROOM (Logic moved to room_manager.go)
	isHost, realTime, isPlaying := JoinRoom(roomID, username, ws, clientID)

	// 3. SEND WELCOME PACKETS
	ws.WriteJSON(Message{Type: "identity", UserID: clientID, IsHost: isHost})

	status := "paused"
	if isPlaying {
		status = "playing"
	}
	ws.WriteJSON(Message{Type: "sync_state", Timestamp: realTime, Content: status})

	BroadcastUserList(roomID)

	// 4. CLEANUP ON EXIT
	defer func() {
		ws.Close()
		HandleDisconnect(roomID, clientID)
	}()

	// 5. MESSAGE LOOP
	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			break
		}

		msg.Room = roomID
		msg.UserID = clientID

		// Route Commands
		switch msg.Type {
		case "play", "pause", "seek":
			// Update state internally, return true if we should broadcast
			if HandleVideoCommand(roomID, clientID, msg) {
				Broadcast(roomID, msg)
			}

		case "grant_control", "revoke_control":
			HandleAdminCommand(roomID, clientID, msg)
			BroadcastUserList(roomID)

		case "chat":
			Broadcast(roomID, msg)

		case "request_control":
			Broadcast(roomID, msg)
		}
	}
}
