package llm

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

const (
	DefaultOpenRouterModel = "anthropic/claude-sonnet-4.5"
	DefaultModel           = DefaultOpenRouterModel
)

// GetUserModelPreference gets the user's model preference from the database
// Returns the model ID (which can be either Anthropic or OpenRouter format)
func GetUserModelPreference(ctx context.Context, userID string) (string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT value FROM chartsmith_user_setting 
		WHERE user_id = $1 AND key = 'anthropic_model'`
	
	var modelID sql.NullString
	err := conn.QueryRow(ctx, query, userID).Scan(&modelID)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Return default OpenRouter model if no preference set
			return DefaultOpenRouterModel, nil
		}
		return "", fmt.Errorf("failed to get user model preference: %w", err)
	}

	if !modelID.Valid || modelID.String == "" {
		return DefaultOpenRouterModel, nil
	}

	return modelID.String, nil
}

// GetUserModelPreferenceFromWorkspace gets the model preference for the user who created the workspace
func GetUserModelPreferenceFromWorkspace(ctx context.Context, workspaceID string) (string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	// Get the user ID from the workspace
	query := `SELECT created_by_user_id FROM workspace WHERE id = $1`
	var userID sql.NullString
	err := conn.QueryRow(ctx, query, workspaceID).Scan(&userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return DefaultOpenRouterModel, nil
		}
		return "", fmt.Errorf("failed to get workspace user: %w", err)
	}

	if !userID.Valid || userID.String == "" {
		return DefaultOpenRouterModel, nil
	}

	return GetUserModelPreference(ctx, userID.String)
}

