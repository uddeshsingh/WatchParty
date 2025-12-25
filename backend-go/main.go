package main

import (
	"fmt"
	"log"
	"net"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	http.HandleFunc("/ws", handleConnections)

	printLocalIP()

	fmt.Println("🚀 Modular Server (Sync Fixed) started on :8080")
	log.Fatal(http.ListenAndServe("0.0.0.0:8080", nil))
}

func printLocalIP() {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)

	fmt.Println("\n=============================================")
	fmt.Printf("📲 Connect your Phone to: http://%s:5173\n", localAddr.IP)
	fmt.Println("=============================================\n")
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	// 1. PARSE PARAMS
	roomID := r.URL.Query().Get("room")
	username := r.URL.Query().Get("username")
	if roomID == "" {
		roomID = "general"
	}
	if username == "" {
		username = "Anon"
	}

	// 2. UPGRADE CONNECTION (Only do this ONCE)
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	// Generate a temporary ID (this might be discarded if we reclaim an old session)
	tempID := uuid.New().String()

	// 3. JOIN ROOM & GET FINAL ID
	// CHANGE: Accept the 5th return value (currentVideoID)
	finalID, isHost, realTime, isPlaying, currentVideoID := JoinRoom(roomID, username, ws, tempID)

	// 4. SEND WELCOME PACKETS
	// Crucial: Send 'finalID' to frontend so it knows its real Identity
	ws.WriteJSON(Message{Type: "identity", UserID: finalID, IsHost: isHost})

	status := "paused"
	if isPlaying {
		status = "playing"
	}
	// CHANGE: Include 'VideoID' in the sync_state message
	ws.WriteJSON(Message{
		Type:      "sync_state",
		Timestamp: realTime,
		Content:   status,
		VideoID:   currentVideoID,
	})

	BroadcastUserList(roomID)

	// 5. CLEANUP ON EXIT
	defer func() {
		ws.Close()
		// Use finalID so we remove the correct user from the map
		HandleDisconnect(roomID, finalID)
	}()

	// 6. MESSAGE LOOP
	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			break
		}

		msg.Room = roomID
		msg.UserID = finalID // Use finalID for all commands to match the map key

		// Route Commands
		switch msg.Type {
		case "play", "pause", "seek":
			// Only the host (checked inside HandleVideoCommand) can control video
			if HandleVideoCommand(roomID, finalID, msg) {
				Broadcast(roomID, msg)
			}

		case "new_video":
			Broadcast(roomID, msg)

		case "grant_control", "revoke_control":
			HandleAdminCommand(roomID, finalID, msg)
			BroadcastUserList(roomID)

		case "chat":
			Broadcast(roomID, msg)

		case "change_video":
			if HandleChangeVideo(roomID, finalID, msg) {
				Broadcast(roomID, msg)
			}

		case "request_control":
			Broadcast(roomID, msg)
		}
	}
}
