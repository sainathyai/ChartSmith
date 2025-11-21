// Unified model definitions that work with both direct Anthropic and OpenRouter
import { ANTHROPIC_MODELS, AnthropicModelId, DEFAULT_MODEL } from './models';
import { OPENROUTER_MODELS, OpenRouterModelId, DEFAULT_OPENROUTER_MODEL } from './models-openrouter';

export type ProviderType = 'anthropic' | 'openrouter';

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  description: string;
}

// Combine all models into a unified list
export const ALL_MODELS: Record<string, ModelInfo> = {
  // Direct Anthropic models
  ...Object.entries(ANTHROPIC_MODELS).reduce((acc, [id, model]) => {
    acc[id] = {
      id,
      name: model.name,
      provider: 'anthropic' as ProviderType,
      description: model.description,
    };
    return acc;
  }, {} as Record<string, ModelInfo>),
  
  // OpenRouter models
  ...Object.entries(OPENROUTER_MODELS).reduce((acc, [id, model]) => {
    acc[id] = {
      id,
      name: model.name,
      provider: 'openrouter' as ProviderType,
      description: model.description,
    };
    return acc;
  }, {} as Record<string, ModelInfo>),
};

export function getModelProvider(modelId: string): ProviderType {
  const model = ALL_MODELS[modelId];
  if (!model) {
    // Default to openrouter if it contains a slash (provider/model format)
    return modelId.includes('/') ? 'openrouter' : 'anthropic';
  }
  return model.provider;
}

export function getDefaultModel(provider: ProviderType): string {
  return provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_MODEL;
}

