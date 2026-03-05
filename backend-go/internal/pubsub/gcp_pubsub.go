package pubsub

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"wpbe/internal/domain"

	"cloud.google.com/go/pubsub"
	"github.com/google/uuid"
)

// GCPPubSub implements domain.EventBus
type GCPPubSub struct {
	client *pubsub.Client
	topic  *pubsub.Topic
	subID  string
}

func NewGCPPubSub(ctx context.Context, projectID, topicID string) (*GCPPubSub, error) {
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("pubsub client error: %w", err)
	}

	topic := client.Topic(topicID)

	// 🚨 DevEx Upgrade: Auto-create the topic if it doesn't exist
	exists, err := topic.Exists(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check if topic exists (check GCP auth): %w", err)
	}
	if !exists {
		log.Printf("Topic '%s' not found. Auto-creating it...", topicID)
		topic, err = client.CreateTopic(ctx, topicID)
		if err != nil {
			return nil, fmt.Errorf("failed to auto-create topic: %w", err)
		}
	}

	// Create a completely unique subscription ID for this specific container replica
	subID := fmt.Sprintf("watchparty-sub-%s", uuid.New().String())

	// Ensure the ephemeral subscription is created dynamically
	_, err = client.CreateSubscription(ctx, subID, pubsub.SubscriptionConfig{
		Topic:            topic,
		AckDeadline:      10 * time.Second,
		ExpirationPolicy: 24 * time.Hour,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create ephemeral subscription: %w", err)
	}

	return &GCPPubSub{
		client: client,
		topic:  topic,
		subID:  subID,
	}, nil
}

func (g *GCPPubSub) Publish(ctx context.Context, msg domain.Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	res := g.topic.Publish(ctx, &pubsub.Message{Data: data})

	// Block until the message is confirmed sent
	_, err = res.Get(ctx)
	return err
}

func (g *GCPPubSub) Subscribe(ctx context.Context, handler func(domain.Message)) error {
	sub := g.client.Subscription(g.subID)

	return sub.Receive(ctx, func(ctx context.Context, m *pubsub.Message) {
		var msg domain.Message
		if err := json.Unmarshal(m.Data, &msg); err == nil {
			handler(msg)
		}
		m.Ack()
	})
}
