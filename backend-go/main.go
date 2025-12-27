package main

import (
	"encoding/json"
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
	http.HandleFunc("/rooms", handleGetRooms)

	fmt.Println("🚀 WatchParty Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room")
	username := r.URL.Query().Get("username")
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
	finalID, isHost, realTime, isPlaying, currentVideoID, joinErr := JoinRoom(roomID, username, ws, tempID, action)

	if joinErr != nil {
		ws.WriteJSON(Message{Type: "error", Content: joinErr.Error()})
		time.Sleep(500 * time.Millisecond)
		ws.Close()
		return
	}

	ws.WriteJSON(Message{Type: "identity", UserID: finalID, IsHost: isHost})
	status := "paused"
	if isPlaying {
		status = "playing"
	}
	ws.WriteJSON(Message{Type: "sync_state", Timestamp: realTime, Content: status, VideoID: currentVideoID})

	BroadcastUserList(roomID)

	defer func() {
		ws.Close()
		HandleDisconnect(roomID, finalID, ws)
	}()

	for {
		var msg Message
		if err := ws.ReadJSON(&msg); err != nil {
			break
		}

		msg.Room = roomID
		msg.UserID = finalID

		switch msg.Type {
		case "play", "pause", "seek":
			if HandleVideoCommand(roomID, finalID, msg) {
				Broadcast(roomID, msg)
			}
		case "new_video", "chat", "request_control", "typing", "reaction":
			Broadcast(roomID, msg)
		case "grant_control", "revoke_control":
			HandleAdminCommand(roomID, finalID, msg)
			BroadcastUserList(roomID)
		case "change_video":
			if HandleChangeVideo(roomID, finalID, msg) {
				Broadcast(roomID, msg)
			}
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
