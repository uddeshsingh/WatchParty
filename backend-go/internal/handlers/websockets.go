package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"wpbe/internal/corsutil"
	"wpbe/internal/domain"

	"github.com/go-playground/validator/v10"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var validate = validator.New()

func WebSocketHandler(rm domain.RoomManager, sessions domain.AuthSessionReader) http.HandlerFunc {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	allowAny, allowedOrigins := corsutil.AllowedOrigins()
	wsUpgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			if allowAny {
				return true
			}
			origin := r.Header.Get("Origin")
			if origin == "" {
				return false
			}
			for _, allowed := range allowedOrigins {
				if origin == allowed {
					return true
				}
			}
			return false
		},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.URL.Query().Get("room")
		action := r.URL.Query().Get("action")

		if action == "" {
			action = "join"
		}
		if roomID == "" {
			roomID = "general"
		}

		ws, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Failed to upgrade WS connection: %v", err)
			return
		}

		ws.SetReadLimit(65536)
		ws.SetReadDeadline(time.Now().Add(10 * time.Second))

		var authMsg struct {
			Type  string `json:"type"`
			Token string `json:"token"`
		}
		if err := ws.ReadJSON(&authMsg); err != nil || authMsg.Type != "auth" {
			ws.WriteJSON(domain.Message{Type: "error", Content: "Authentication required"})
			ws.Close()
			return
		}

		token, err := jwt.Parse(authMsg.Token, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		var username string
		var sidClaim string
		if err == nil && token != nil && token.Valid {
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if sub, ok := claims["sub"].(string); ok {
					username = sub
				}
				if s, ok := claims["sid"].(string); ok {
					sidClaim = s
				}
			}
		}

		if username == "" {
			log.Printf("WS connection rejected: invalid or missing token")
			ws.WriteJSON(domain.Message{Type: "error", Content: "Unauthorized"})
			time.Sleep(500 * time.Millisecond)
			ws.Close()
			return
		}

		if sessions != nil {
			stored, serr := sessions.GetAuthSession(r.Context(), username)
			if serr != nil {
				log.Printf("WS auth session lookup failed: %v", serr)
				ws.WriteJSON(domain.Message{Type: "error", Content: "Session validation failed"})
				time.Sleep(500 * time.Millisecond)
				ws.Close()
				return
			}
			if stored != "" && (sidClaim == "" || sidClaim != stored) {
				ws.WriteJSON(domain.Message{Type: "error", Content: "Session expired. Please log in again."})
				time.Sleep(500 * time.Millisecond)
				ws.Close()
				return
			}
		}

		ws.SetReadDeadline(time.Time{})

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
			ticker := time.NewTicker(25 * time.Second)
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

		defer func() {
			rm.LeaveRoom(r.Context(), roomID, client)
			ws.Close()
		}()

		var recommendTimes []time.Time

		for {
			var msg domain.Message
			if err := ws.ReadJSON(&msg); err != nil {
				close(client.Send)
				break
			}

			msg.Room = roomID
			msg.UserID = client.ID

			switch msg.Type {
			case "recommend_video":
				if msg.Data != nil {
					raw, mErr := json.Marshal(msg.Data)
					if mErr != nil || len(raw) > 1024 {
						client.Send <- domain.Message{Type: "error", Content: "recommendation payload too large"}
						continue
					}
				}
				now := time.Now()
				var pruned []time.Time
				for _, t := range recommendTimes {
					if now.Sub(t) < time.Minute {
						pruned = append(pruned, t)
					}
				}
				recommendTimes = pruned
				if len(recommendTimes) >= 5 {
					client.Send <- domain.Message{Type: "error", Content: "Too many recommendations; wait a minute"}
					continue
				}
				recommendTimes = append(recommendTimes, now)
				if err := validate.Struct(msg); err != nil {
					log.Printf("Validation failed: %v", err)
					client.Send <- domain.Message{Type: "error", Content: "Invalid message format"}
					continue
				}
				if err := rm.HandleRecommendVideo(r.Context(), roomID, msg); err != nil {
					log.Printf("Recommend video failed: %v", err)
				}
				continue
			case "change_provider":
				if err := validate.Struct(msg); err != nil {
					log.Printf("Validation failed: %v", err)
					client.Send <- domain.Message{Type: "error", Content: "Invalid message format"}
					continue
				}
				if err := rm.HandleChangeProvider(r.Context(), roomID, msg); err != nil {
					log.Printf("Change provider failed: %v", err)
					client.Send <- domain.Message{Type: "error", Content: err.Error()}
				}
				continue
			}

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
