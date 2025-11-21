package llm

import (
	"context"
	"fmt"
	"strings"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

type CreatePlanOpts struct {
	ChatMessages  []workspacetypes.Chat
	Chart         *workspacetypes.Chart
	RelevantFiles []workspacetypes.File
	IsUpdate      bool
	ModelID       string
}

func CreatePlan(ctx context.Context, streamCh chan string, doneCh chan error, opts CreatePlanOpts) error {
	fileNameArgs := []string{}
	for _, file := range opts.RelevantFiles {
		fileNameArgs = append(fileNameArgs, file.FilePath)
	}
	logger.Debug("Creating plan with relevant files",
		zap.Int("relevantFiles", len(opts.RelevantFiles)),
		zap.String("relevantFiles", strings.Join(fileNameArgs, ", ")),
		zap.Bool("isUpdate", opts.IsUpdate),
	)

	// Use model from opts, default to DefaultModel if not set
	modelID := opts.ModelID
	if modelID == "" {
		modelID = DefaultModel
	}

	// Use OpenRouter if model is OpenRouter format
	if isOpenRouterModel(modelID) {
		return createPlanOpenRouter(ctx, streamCh, doneCh, opts, modelID)
	}

	// Use Anthropic
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return fmt.Errorf("failed to create anthropic client: %w", err)
	}

	chartStructure, err := getChartStructure(ctx, opts.Chart)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	messages := []anthropic.MessageParam{}

	if !opts.IsUpdate {
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanSystemPrompt)))
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(initialPlanInstructions)))
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`Chart structure: %s`, chartStructure))))

	} else {
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(updatePlanSystemPrompt)))
		messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(updatePlanInstructions)))
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`Chart structure: %s`, chartStructure))))
		for _, file := range opts.RelevantFiles {
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content))))
		}
	}

	for _, chatMessage := range opts.ChatMessages {
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(chatMessage.Prompt)))
		if chatMessage.Response != "" {
			messages = append(messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(chatMessage.Response)))
		}
	}

	verb := "create"
	if opts.IsUpdate {
		verb = "edit"
	}
	initialUserMessage := fmt.Sprintf("Describe the plan only (do not write code) to %s a helm chart based on the previous discussion. ", verb)

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(initialUserMessage)))

	// tools := []anthropic.ToolParam{
	// 	{
	// 		Name:        anthropic.F("recommended_dependency"),
	// 		Description: anthropic.F("Recommend a specific subchart or version of a subchart given a requirement"),
	// 		InputSchema: anthropic.F(interface{}(map[string]interface{}{
	// 			"type": "object",
	// 			"properties": map[string]interface{}{
	// 				"requirement": map[string]interface{}{
	// 					"type":        "string",
	// 					"description": "The requirement to recommend a dependency for, e.g. Redis, Mysql",
	// 				},
	// 			},
	// 			"required": []string{"requirement"},
	// 		})),
	// 	},
	// }

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(modelID),
		MaxTokens: anthropic.F(int64(8192)),
		// Tools:     anthropic.F(tools),
		Messages: anthropic.F(messages),
	})

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				streamCh <- delta.Text
			}
		}
	}

	if stream.Err() != nil {
		doneCh <- stream.Err()
	}

	doneCh <- nil
	return nil
}

// createPlanOpenRouter handles plan creation using OpenRouter
func createPlanOpenRouter(ctx context.Context, streamCh chan string, doneCh chan error, opts CreatePlanOpts, modelID string) error {
	chartStructure, err := getChartStructure(ctx, opts.Chart)
	if err != nil {
		return fmt.Errorf("failed to get chart structure: %w", err)
	}

	messages := []OpenRouterMessage{}

	if !opts.IsUpdate {
		messages = append(messages, OpenRouterMessage{Role: "system", Content: initialPlanSystemPrompt + "\n\n" + initialPlanInstructions})
		messages = append(messages, OpenRouterMessage{Role: "user", Content: fmt.Sprintf("Chart structure: %s", chartStructure)})
	} else {
		messages = append(messages, OpenRouterMessage{Role: "system", Content: updatePlanSystemPrompt + "\n\n" + updatePlanInstructions})
		messages = append(messages, OpenRouterMessage{Role: "user", Content: fmt.Sprintf("Chart structure: %s", chartStructure)})
		for _, file := range opts.RelevantFiles {
			messages = append(messages, OpenRouterMessage{Role: "user", Content: fmt.Sprintf("File: %s, Content: %s", file.FilePath, file.Content)})
		}
	}

	for _, chatMessage := range opts.ChatMessages {
		messages = append(messages, OpenRouterMessage{Role: "user", Content: chatMessage.Prompt})
		if chatMessage.Response != "" {
			messages = append(messages, OpenRouterMessage{Role: "assistant", Content: chatMessage.Response})
		}
	}

	verb := "create"
	if opts.IsUpdate {
		verb = "edit"
	}
	initialUserMessage := fmt.Sprintf("Describe the plan only (do not write code) to %s a helm chart based on the previous discussion. ", verb)
	messages = append(messages, OpenRouterMessage{Role: "user", Content: initialUserMessage})

	// Stream the response
	err = streamOpenRouter(ctx, modelID, messages, 8192, streamCh)
	if err != nil {
		doneCh <- err
		return err
	}

	doneCh <- nil
	return nil
}
