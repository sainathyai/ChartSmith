// Available Anthropic models for direct API access (not via OpenRouter)
export const ANTHROPIC_MODELS = {
  'claude-sonnet-4-5-20250929': {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Latest Claude Sonnet model (recommended)',
  },
  'claude-3-7-sonnet-20250219': {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    description: 'Previous generation Sonnet model',
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Claude 3.5 Sonnet model',
  },
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Most capable model (slower, more expensive)',
  },
  'claude-3-haiku-20240307': {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    description: 'Fastest model (less capable)',
  },
} as const;

export type AnthropicModelId = keyof typeof ANTHROPIC_MODELS;

export const DEFAULT_MODEL: AnthropicModelId = 'claude-sonnet-4-5-20250929';

export function getModelName(modelId: string): string {
  return ANTHROPIC_MODELS[modelId as AnthropicModelId]?.name || modelId;
}

