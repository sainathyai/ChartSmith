package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/replicatedhq/chartsmith/pkg/param"
)

// LLMClient represents a unified interface for LLM clients
type LLMClient struct {
	Type           string // "anthropic" or "openrouter"
	AnthropicClient *anthropic.Client
	Model          string // The model ID to use
}

// newAnthropicClient creates an Anthropic client
func newAnthropicClient(ctx context.Context) (*anthropic.Client, error) {
	if param.Get().AnthropicAPIKey == "" {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY environment variable not set")
	}
	client := anthropic.NewClient(
		option.WithAPIKey(param.Get().AnthropicAPIKey),
	)

	return client, nil
}

// newLLMClient creates a unified LLM client based on the model ID
// If modelID contains a slash, it's an OpenRouter model, otherwise it's Anthropic
func newLLMClient(ctx context.Context, modelID string) (*LLMClient, error) {
	if isOpenRouterModel(modelID) {
		// For OpenRouter, we don't need a client object, just return the type
		return &LLMClient{
			Type:  "openrouter",
			Model: modelID,
		}, nil
	}

	// For Anthropic, create the client
	anthropicClient, err := newAnthropicClient(ctx)
	if err != nil {
		return nil, err
	}

	return &LLMClient{
		Type:           "anthropic",
		AnthropicClient: anthropicClient,
		Model:          modelID,
	}, nil
}
