package llm

import (
	"context"
	"fmt"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	types "github.com/replicatedhq/chartsmith/pkg/llm/types"
	"github.com/replicatedhq/chartsmith/pkg/logger"
	workspacetypes "github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"go.uber.org/zap"
)

func CreateExecutePlan(ctx context.Context, planActionCreatedCh chan types.ActionPlanWithPath, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan, c *workspacetypes.Chart, relevantFiles []workspacetypes.File, modelID string) error {
	logger.Debug("Creating execution plan",
		zap.String("workspace_id", w.ID),
		zap.String("chart_id", c.ID),
		zap.Int("revision_number", w.CurrentRevision),
		zap.Int("relevant_files_len", len(relevantFiles)),
	)

	// Use OpenRouter if model is OpenRouter format
	if isOpenRouterModel(modelID) {
		return createExecutePlanOpenRouter(ctx, planActionCreatedCh, streamCh, doneCh, w, plan, c, relevantFiles, modelID)
	}

	// Use Anthropic
	client, err := newAnthropicClient(ctx)
	if err != nil {
		return err
	}

	messages := []anthropic.MessageParam{
		anthropic.NewAssistantMessage(anthropic.NewTextBlock(detailedPlanSystemPrompt)),
		anthropic.NewUserMessage(anthropic.NewTextBlock(detailedPlanInstructions)),
	}

	if w.CurrentRevision == 0 {
		bootsrapChartUserMessage, err := summarizeBootstrapChart(ctx)
		if err != nil {
			return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
		}
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(bootsrapChartUserMessage)))
	} else {
		chartStructure, err := getChartStructure(ctx, c)
		if err != nil {
			return fmt.Errorf("failed to get chart structure: %w", err)
		}
		messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`I am working on a Helm chart that has the following structure: %s`, chartStructure))))

		for _, file := range relevantFiles {
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(fmt.Sprintf(`File: %s, Content: %s`, file.FilePath, file.Content))))
		}
	}

	messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(plan.Description)))

	stream := client.Messages.NewStreaming(context.TODO(), anthropic.MessageNewParams{
		Model:     anthropic.F(modelID),
		MaxTokens: anthropic.F(int64(8192)),
		Messages:  anthropic.F(messages),
	})

	fullResponseWithTags := ""
	actionPlans := make(map[string]types.ActionPlan)

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				fullResponseWithTags += delta.Text

				aps, err := parseActionsInResponse(fullResponseWithTags)
				if err != nil {
					return fmt.Errorf("error parsing artifacts in response: %w", err)
				}

				for path, action := range aps {
					// only add if the full struct is there
					if path != "" && action.Type != "" && action.Action != "" {
						// if the item is not already in the map, we need to stream it back to the caller
						if _, ok := actionPlans[path]; !ok {
							action.Status = types.ActionPlanStatusPending
							actionPlanWithPath := types.ActionPlanWithPath{
								Path:       path,
								ActionPlan: action,
							}
							planActionCreatedCh <- actionPlanWithPath
						}

						actionPlans[path] = action
					}
				}
			}
		}
	}

	if stream.Err() != nil {
		doneCh <- stream.Err()
	}

	doneCh <- nil

	// The plan will be set to "applied" status when all actions are complete

	return nil
}

// createExecutePlanOpenRouter handles execute plan using OpenRouter
func createExecutePlanOpenRouter(ctx context.Context, planActionCreatedCh chan types.ActionPlanWithPath, streamCh chan string, doneCh chan error, w *workspacetypes.Workspace, plan *workspacetypes.Plan, c *workspacetypes.Chart, relevantFiles []workspacetypes.File, modelID string) error {
	messages := []OpenRouterMessage{
		{Role: "system", Content: detailedPlanSystemPrompt + "\n\n" + detailedPlanInstructions},
	}

	if w.CurrentRevision == 0 {
		bootsrapChartUserMessage, err := summarizeBootstrapChart(ctx)
		if err != nil {
			return fmt.Errorf("failed to summarize bootstrap chart: %w", err)
		}
		messages = append(messages, OpenRouterMessage{Role: "user", Content: bootsrapChartUserMessage})
	} else {
		chartStructure, err := getChartStructure(ctx, c)
		if err != nil {
			return fmt.Errorf("failed to get chart structure: %w", err)
		}
		messages = append(messages, OpenRouterMessage{Role: "user", Content: fmt.Sprintf("I am working on a Helm chart that has the following structure: %s", chartStructure)})

		for _, file := range relevantFiles {
			messages = append(messages, OpenRouterMessage{Role: "user", Content: fmt.Sprintf("File: %s, Content: %s", file.FilePath, file.Content)})
		}
	}

	messages = append(messages, OpenRouterMessage{Role: "user", Content: plan.Description})

	// Stream the response and parse actions
	fullResponseWithTags := ""
	actionPlans := make(map[string]types.ActionPlan)

	// Use a channel to collect streamed text
	textCh := make(chan string, 100)
	errCh := make(chan error, 1)

	go func() {
		err := streamOpenRouter(ctx, modelID, messages, 8192, textCh)
		if err != nil {
			errCh <- err
		}
		close(textCh)
	}()

	for {
		select {
		case text, ok := <-textCh:
			if !ok {
				// Stream finished
				doneCh <- nil
				return nil
			}
			fullResponseWithTags += text
			streamCh <- text

			// Parse actions from accumulated response
			aps, err := parseActionsInResponse(fullResponseWithTags)
			if err != nil {
				// Don't fail on parse errors, just log
				logger.Error(fmt.Errorf("error parsing actions in response: %w", err))
				continue
			}

			for path, action := range aps {
				// only add if the full struct is there
				if path != "" && action.Type != "" && action.Action != "" {
					// if the item is not already in the map, we need to stream it back to the caller
					if _, ok := actionPlans[path]; !ok {
						action.Status = types.ActionPlanStatusPending
						actionPlanWithPath := types.ActionPlanWithPath{
							Path:       path,
							ActionPlan: action,
						}
						planActionCreatedCh <- actionPlanWithPath
					}

					actionPlans[path] = action
				}
			}
		case err := <-errCh:
			doneCh <- err
			return err
		case <-ctx.Done():
			doneCh <- ctx.Err()
			return ctx.Err()
		}
	}
}
