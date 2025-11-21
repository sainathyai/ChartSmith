import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { logger } from "@/lib/utils/logger";
import { DEFAULT_MODEL, AnthropicModelId } from './models';

export enum PromptType {
  Plan = "plan",
  Chat = "chat",
}

export enum PromptRole {
  Packager = "packager",
  User = "user",
}

export interface PromptIntent {
  intent: PromptType;
  role: PromptRole;
}

export async function promptType(message: string, model?: string): Promise<PromptType> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const selectedModel = (model || DEFAULT_MODEL) as AnthropicModelId;

    const { text } = await generateText({
      model: anthropic(selectedModel),
      maxTokens: 1024,
      system: `You are ChartSmith, an expert at creating Helm charts for Kuberentes.
You are invited to participate in an existing conversation between a user and an expert.
The expert just provided a recommendation on how to plan the Helm chart to the user.
The user is about to ask a question.
You should decide if the user is asking for a change to the plan/chart, or if they are just asking a conversational question.
Be exceptionally brief and precise. in your response.
Only say "plan" or "chat" in your response.
`,
      prompt: message,
    });

    if (text.toLowerCase().includes("plan")) {
      return PromptType.Plan;
    } else {
      return PromptType.Chat;
    }
  } catch (err) {
    logger.error("Error determining prompt type", err);
    throw err;
  }
}
