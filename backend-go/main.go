package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
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
	http.HandleFunc("/rooms", handleGetRooms)

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
	fmt.Println("=============================================")
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	// 1. PARSE PARAMS
	roomID := r.URL.Query().Get("room")
	username := r.URL.Query().Get("username")

	// CHANGED: Get 'action' (defaults to 'join')
	action := r.URL.Query().Get("action")
	if action == "" {
		action = "join"
	}

	if roomID == "" {
		roomID = "general"
	}
	if username == "" {
		username = "Anon"
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	tempID := uuid.New().String()

	// CHANGED: Pass 'action' and handle error
	finalID, isHost, realTime, isPlaying, currentVideoID, joinErr := JoinRoom(roomID, username, ws, tempID, action)
	// CHANGED: Handle Join Errors (Room exists / Not found)
	if joinErr != nil {
		ws.WriteJSON(Message{
			Type:    "error",
			Content: joinErr.Error(),
		})
		time.Sleep(500 * time.Millisecond)
		ws.Close()
		return
	}

	ws.WriteJSON(Message{Type: "identity", UserID: finalID, IsHost: isHost})

	status := "paused"
	if isPlaying {
		status = "playing"
	}
	ws.WriteJSON(Message{
		Type:      "sync_state",
		Timestamp: realTime,
		Content:   status,
		VideoID:   currentVideoID,
	})

	BroadcastUserList(roomID)

	defer func() {
		ws.Close()
		HandleDisconnect(roomID, finalID)
	}()

	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			break
		}

		msg.Room = roomID
		msg.UserID = finalID

		switch msg.Type {
		case "play", "pause", "seek":
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

		case "typing":
			Broadcast(roomID, msg)

		case "reaction":
			Broadcast(roomID, msg)
		}
	}
}

func handleGetRooms(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	rooms := GetActiveRooms()

	if rooms == nil {
		rooms = []RoomSummary{}
	}

	json.NewEncoder(w).Encode(rooms)
}
