package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/replicatedhq/chartsmith/pkg/logger"
	"github.com/replicatedhq/chartsmith/pkg/param"
	"go.uber.org/zap"
)

const OpenRouterAPIURL = "https://openrouter.ai/api/v1/chat/completions"

// OpenRouterMessage represents a message in OpenRouter API format
type OpenRouterMessage struct {
	Role         string                  `json:"role"`
	Content      interface{}             `json:"content,omitempty"` // Can be string or array
	FunctionCall *OpenRouterFunctionCall `json:"function_call,omitempty"`
	Name         string                  `json:"name,omitempty"` // For function responses
}

// OpenRouterFunctionCall represents a function call in OpenRouter format
type OpenRouterFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON string, not a map
}

// OpenRouterFunction represents a function definition for OpenRouter
type OpenRouterFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// OpenRouterRequest represents the request body for OpenRouter API
type OpenRouterRequest struct {
	Model        string               `json:"model"`
	Messages     []OpenRouterMessage  `json:"messages"`
	Stream       bool                 `json:"stream"`
	MaxTokens    *int                 `json:"max_tokens,omitempty"`
	Functions    []OpenRouterFunction `json:"functions,omitempty"`     // For older models
	FunctionCall interface{}          `json:"function_call,omitempty"` // "auto", "none", or {"name": "function_name"}
	Tools        []OpenRouterTool     `json:"tools,omitempty"`         // For newer models (OpenAI format)
	ToolChoice   interface{}          `json:"tool_choice,omitempty"`   // "auto", "none", or {"type": "function", "function": {"name": "..."}}
}

// OpenRouterTool represents a tool definition (OpenAI format)
type OpenRouterTool struct {
	Type     string             `json:"type"`
	Function OpenRouterFunction `json:"function"`
}

// OpenRouterToolCall represents a tool call in the response
type OpenRouterToolCall struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Function OpenRouterFunctionCall `json:"function"`
}

// OpenRouterResponse represents the response from OpenRouter API
type OpenRouterResponse struct {
	Choices []struct {
		Message struct {
			Content   string               `json:"content"`
			ToolCalls []OpenRouterToolCall `json:"tool_calls,omitempty"` // New format (tools)
			Role      string               `json:"role"`
			// Legacy format support
			FunctionCall *OpenRouterFunctionCall `json:"function_call,omitempty"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

// OpenRouterStreamChunk represents a streaming chunk from OpenRouter
type OpenRouterStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content      string                  `json:"content,omitempty"`
			FunctionCall *OpenRouterFunctionCall `json:"function_call,omitempty"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason,omitempty"`
	} `json:"choices"`
}

// newOpenRouterClient creates an HTTP client for OpenRouter API calls
func newOpenRouterClient() (*http.Client, error) {
	key := param.Get().OpenRouterAPIKey
	if key == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY environment variable not set")
	}
	logger.Debug("OpenRouter API key detected",
		zap.Int("key_length", len(key)),
		zap.String("key_preview", maskAPIKey(key)))
	return http.DefaultClient, nil
}

// callOpenRouter makes a non-streaming call to OpenRouter API
func callOpenRouter(ctx context.Context, model string, messages []OpenRouterMessage, maxTokens int) (string, error) {
	client, err := newOpenRouterClient()
	if err != nil {
		return "", err
	}

	reqBody := OpenRouterRequest{
		Model:     model,
		Messages:  messages,
		Stream:    false,
		MaxTokens: &maxTokens,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", OpenRouterAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", param.Get().OpenRouterAPIKey))
	req.Header.Set("HTTP-Referer", "https://chartsmith.ai")
	req.Header.Set("X-Title", "ChartSmith")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusUnauthorized {
			logger.Error(fmt.Errorf("OpenRouter authentication failed"),
				zap.Int("status_code", resp.StatusCode),
				zap.String("body", string(body)),
				zap.String("key_preview", maskAPIKey(param.Get().OpenRouterAPIKey)))
		}
		return "", fmt.Errorf("OpenRouter API error: %d - %s", resp.StatusCode, string(body))
	}

	var openRouterResp OpenRouterResponse
	if err := json.NewDecoder(resp.Body).Decode(&openRouterResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(openRouterResp.Choices) == 0 {
		return "", fmt.Errorf("no choices in OpenRouter response")
	}

	return openRouterResp.Choices[0].Message.Content, nil
}

// streamOpenRouter makes a streaming call to OpenRouter API
func streamOpenRouter(ctx context.Context, model string, messages []OpenRouterMessage, maxTokens int, streamCh chan<- string) error {
	client, err := newOpenRouterClient()
	if err != nil {
		return err
	}

	reqBody := OpenRouterRequest{
		Model:     model,
		Messages:  messages,
		Stream:    true,
		MaxTokens: &maxTokens,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", OpenRouterAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", param.Get().OpenRouterAPIKey))
	req.Header.Set("HTTP-Referer", "https://chartsmith.ai")
	req.Header.Set("X-Title", "ChartSmith")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusUnauthorized {
			logger.Error(fmt.Errorf("OpenRouter authentication failed"),
				zap.Int("status_code", resp.StatusCode),
				zap.String("body", string(body)),
				zap.String("key_preview", maskAPIKey(param.Get().OpenRouterAPIKey)))
		}
		return fmt.Errorf("OpenRouter API error: %d - %s", resp.StatusCode, string(body))
	}

	decoder := json.NewDecoder(resp.Body)
	for {
		var chunk OpenRouterStreamChunk
		if err := decoder.Decode(&chunk); err != nil {
			if err == io.EOF {
				break
			}
			logger.Error(fmt.Errorf("failed to decode stream chunk: %w", err))
			break
		}

		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			select {
			case streamCh <- chunk.Choices[0].Delta.Content:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	return nil
}

// isOpenRouterModel checks if a model ID is an OpenRouter model (contains a slash)
func isOpenRouterModel(modelID string) bool {
	// OpenRouter models are in format "provider/model-id"
	return len(modelID) > 0 && (modelID[0] != '/' && contains(modelID, "/"))
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func maskAPIKey(key string) string {
	if key == "" {
		return "<empty>"
	}
	if len(key) <= 8 {
		return "***"
	}
	return fmt.Sprintf("%s...%s", key[:4], key[len(key)-4:])
}

// callOpenRouterWithFunctions makes a non-streaming call to OpenRouter API with function calling support
// Uses tools format (OpenAI-compatible) which is preferred by OpenRouter
func callOpenRouterWithFunctions(ctx context.Context, model string, messages []OpenRouterMessage, functions []OpenRouterFunction, maxTokens int) (*OpenRouterResponse, error) {
	client, err := newOpenRouterClient()
	if err != nil {
		return nil, err
	}

	// Convert functions to tools format (OpenAI-compatible)
	tools := make([]OpenRouterTool, len(functions))
	for i, fn := range functions {
		tools[i] = OpenRouterTool{
			Type:     "function",
			Function: fn,
		}
	}

	reqBody := OpenRouterRequest{
		Model:      model,
		Messages:   messages,
		Stream:     false,
		MaxTokens:  &maxTokens,
		Tools:      tools,
		ToolChoice: "auto",
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", OpenRouterAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", param.Get().OpenRouterAPIKey))
	req.Header.Set("HTTP-Referer", "https://chartsmith.ai")
	req.Header.Set("X-Title", "ChartSmith")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == 401 {
			logger.Error(fmt.Errorf("OpenRouter authentication failed"),
				zap.Int("status_code", resp.StatusCode),
				zap.String("body", string(body)),
				zap.String("key_preview", maskAPIKey(param.Get().OpenRouterAPIKey)))
			return nil, fmt.Errorf("OpenRouter API authentication failed (401): %s. Please verify your OPENROUTER_API_KEY is set correctly in your .env file and has valid credits", string(body))
		}
		return nil, fmt.Errorf("OpenRouter API error: %d - %s", resp.StatusCode, string(body))
	}

	var openRouterResp OpenRouterResponse
	if err := json.NewDecoder(resp.Body).Decode(&openRouterResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(openRouterResp.Choices) == 0 {
		return nil, fmt.Errorf("no choices in OpenRouter response")
	}

	return &openRouterResp, nil
}
