package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"wpbe/internal/domain"

	"github.com/go-playground/validator/v10"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	validate = validator.New()
)

func WebSocketHandler(rm domain.RoomManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.URL.Query().Get("room")
		action := r.URL.Query().Get("action")
		tokenStr := r.URL.Query().Get("token")

		if action == "" {
			action = "join"
		}
		if roomID == "" {
			roomID = "general"
		}

		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			secret = "super-secret-fallback"
		}

		token, _ := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		})

		var username string
		if token != nil && token.Valid {
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if sub, ok := claims["sub"].(string); ok {
					username = sub
				}
			}
		}

		if username == "" {
			log.Printf("WS connection rejected: Invalid or missing token")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		ws, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade WS connection: %v", err)
			return
		}

		clientID := uuid.New().String()
		client := &domain.Client{
			ID:       clientID,
			Conn:     ws,
			Username: username,
			IsHost:   false,
			Send:     make(chan domain.Message, 256),
		}

		if err := rm.JoinRoom(r.Context(), roomID, action, client); err != nil {
			log.Printf("Join rejected: %v", err)
			ws.WriteJSON(domain.Message{Type: "error", Content: err.Error()})
			time.Sleep(500 * time.Millisecond)
			ws.Close()
			return
		}

		go func() {
			ticker := time.NewTicker(25 * time.Second) // Ping interval
			defer func() {
				ticker.Stop()
				ws.Close()
			}()

			for {
				select {
				case message, ok := <-client.Send:
					if !ok {
						ws.WriteMessage(websocket.CloseMessage, []byte{})
						return
					}
					if err := ws.WriteJSON(message); err != nil {
						log.Printf("Write error for %s: %v", client.ID, err)
						return
					}
				case <-ticker.C:
					if err := ws.WriteMessage(websocket.PingMessage, nil); err != nil {
						return
					}
				}
			}
		}()

		// Clean up when the read loop breaks
		defer func() {
			rm.LeaveRoom(r.Context(), roomID, client)
			ws.Close()
		}()

		// READ LOOP
		for {
			var msg domain.Message
			if err := ws.ReadJSON(&msg); err != nil {
				close(client.Send)
				break
			}

			msg.Room = roomID
			msg.UserID = client.ID

			if err := validate.Struct(msg); err != nil {
				log.Printf("Validation failed: %v", err)
				client.Send <- domain.Message{Type: "error", Content: "Invalid message format"}
				continue
			}

			switch msg.Type {
			case "ping":
				continue
			case "play", "pause", "seek", "sync_state":
				if err := rm.HandleVideoCommand(r.Context(), roomID, msg); err != nil {
					log.Printf("Failed video command: %v", err)
				}
			case "change_video":
				if err := rm.HandleChangeVideo(r.Context(), roomID, msg); err != nil {
					log.Printf("Failed change video: %v", err)
				}
			case "chat", "reaction", "typing", "new_video":
				if err := rm.PublishDirectEvent(r.Context(), msg); err != nil {
					log.Printf("Failed direct event: %v", err)
				}
			case "grant_control", "revoke_control":
				if err := rm.HandleHostChange(r.Context(), roomID, msg); err != nil {
					log.Printf("Host change failed: %v", err)
				}
			}
		}
	}
}

func GetRoomsHandler(rm domain.RoomManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		rooms, err := rm.GetActiveRooms(r.Context())
		if err != nil {
			log.Printf("Failed to fetch active rooms: %v", err)
			rooms = []domain.RoomSummary{}
		}
		json.NewEncoder(w).Encode(rooms)
	}
}
