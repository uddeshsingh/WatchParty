package domain

import "context"

// AuthSessionReader returns the active login session id for a username (Redis mirror of Python DB).
type AuthSessionReader interface {
	GetAuthSession(ctx context.Context, username string) (string, error)
}

// RoomRepository defines how room state is persisted (e.g., Redis)
type RoomRepository interface {
	GetRoomState(ctx context.Context, roomID string) (*RoomState, error)
	SaveRoomState(ctx context.Context, roomID string, state *RoomState) error
	DeleteRoomState(ctx context.Context, roomID string) error
	GetActiveRooms(ctx context.Context) ([]RoomSummary, error)
}

// EventBus defines how messages are broadcasted globally (e.g., GCP Pub/Sub)
type EventBus interface {
	Publish(ctx context.Context, msg Message) error
	Subscribe(ctx context.Context, handler func(Message)) error
}

// RoomManager defines the core business logic
type RoomManager interface {
	RegisterLocalClient(roomID string, client *Client)
	RemoveLocalClient(roomID string, client *Client)
	HandleVideoCommand(ctx context.Context, roomID string, msg Message) error
	PublishDirectEvent(ctx context.Context, msg Message) error
	JoinRoom(ctx context.Context, roomID string, action string, client *Client) error
	LeaveRoom(ctx context.Context, roomID string, client *Client)
	GetActiveRooms(ctx context.Context) ([]RoomSummary, error)
	HandleChangeVideo(ctx context.Context, roomID string, msg Message) error
	HandleHostChange(ctx context.Context, roomID string, msg Message) error
}
