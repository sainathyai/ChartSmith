// Models available through OpenRouter (restricted list)
// Format: provider/model-id
export const OPENROUTER_MODELS = {
  // OpenAI
  'openai/gpt-5.1-codex': {
    id: 'openai/gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    provider: 'OpenAI',
    description: 'OpenAI GPT-5.1 Codex via OpenRouter',
  },

  // Anthropic
  'anthropic/claude-haiku-4.5': {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    description: 'Claude Haiku 4.5 via OpenRouter',
  },
  'anthropic/claude-sonnet-4.5': {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description: 'Claude Sonnet 4.5 via OpenRouter',
  },

  // Google
  'google/gemini-3-pro-preview': {
    id: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    provider: 'Google',
    description: 'Google Gemini 3 Pro preview via OpenRouter',
  },

  // xAI
  'x-ai/grok-code-fast-1': {
    id: 'x-ai/grok-code-fast-1',
    name: 'Grok Code Fast 1',
    provider: 'xAI',
    description: 'xAI Grok Code Fast 1 via OpenRouter',
  },
} as const;

export type OpenRouterModelId = keyof typeof OPENROUTER_MODELS;

export const DEFAULT_OPENROUTER_MODEL: OpenRouterModelId = 'anthropic/claude-sonnet-4.5';

export function getModelName(modelId: string): string {
  return OPENROUTER_MODELS[modelId as OpenRouterModelId]?.name || modelId;
}

export function getModelProvider(modelId: string): string {
  return OPENROUTER_MODELS[modelId as OpenRouterModelId]?.provider || 'Unknown';
}

