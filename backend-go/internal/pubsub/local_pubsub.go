package pubsub

import (
	"context"
	"wpbe/internal/domain"
)

// LocalBus acts as a fallback if GCP Pub/Sub is unavailable
type LocalBus struct {
	subscribers []func(domain.Message)
}

func NewLocalBus() *LocalBus {
	return &LocalBus{}
}

func (b *LocalBus) Publish(ctx context.Context, msg domain.Message) error {
	for _, handler := range b.subscribers {
		// Run handlers asynchronously to mimic network behavior
		go handler(msg)
	}
	return nil
}

func (b *LocalBus) Subscribe(ctx context.Context, handler func(domain.Message)) error {
	b.subscribers = append(b.subscribers, handler)
	return nil
}
