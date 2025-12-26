package main

import (
	"time"

	"github.com/gorilla/websocket"
)

// --- DATA STRUCTURES ---

type Client struct {
	ID       string
	Conn     *websocket.Conn
	Username string
	IsHost   bool
}

type RoomState struct {
	VideoID     int                `json:"video_id"`
	Timestamp   float64            `json:"timestamp"`
	Playing     bool               `json:"playing"`
	LastUpdated time.Time          `json:"-"`
	Clients     map[string]*Client `json:"-"`
}

type Message struct {
	Type      string        `json:"type"`
	Username  string        `json:"username"`
	UserID    string        `json:"user_id"`
	Content   string        `json:"content"`
	Timestamp float64       `json:"timestamp"`
	VideoID   int           `json:"video_id"`
	Room      string        `json:"room"`
	IsHost    bool          `json:"is_host"`
	UserList  []UserSummary `json:"user_list,omitempty"`
}

type UserSummary struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	IsHost   bool   `json:"is_host"`
}

type RoomSummary struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}
