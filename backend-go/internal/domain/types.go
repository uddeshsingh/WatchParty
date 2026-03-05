package domain

import (
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID       string
	Conn     *websocket.Conn `json:"-"`
	Username string
	IsHost   bool
	Send     chan Message `json:"-"`
}

type RoomState struct {
	VideoID     int                    `json:"video_id"`
	Timestamp   float64                `json:"timestamp"`
	Playing     bool                   `json:"playing"`
	LastUpdated time.Time              `json:"last_updated"`
	Clients     map[string]UserSummary `json:"clients"`
}

type RoomSummary struct {
	Name    string `json:"name"`
	Count   int    `json:"count"`
	VideoID int    `json:"video_id"`
}

type UserSummary struct {
	ID       string    `json:"id"`
	Username string    `json:"username"`
	IsHost   bool      `json:"is_host"`
	JoinedAt time.Time `json:"joined_at"`
}

type Message struct {
	Type      string        `json:"type" validate:"required"`
	Username  string        `json:"username" validate:"required,min=1,max=64"`
	UserID    string        `json:"user_id"`
	Content   string        `json:"content"`
	Timestamp float64       `json:"timestamp"`
	VideoID   int           `json:"video_id"`
	Room      string        `json:"room" validate:"required"`
	IsHost    bool          `json:"is_host"`
	UserList  []UserSummary `json:"user_list,omitempty"`
	Data      interface{}   `json:"data,omitempty"`
}
