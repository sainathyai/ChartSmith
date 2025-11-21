import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { NextRequest } from 'next/server';
import { validateSession } from '@/lib/auth/actions/validate-session';
import { cookies } from 'next/headers';
import { listMessagesForWorkspace } from '@/lib/workspace/chat';
import { logger } from '@/lib/utils/logger';
import { DEFAULT_MODEL, AnthropicModelId } from '@/lib/llm/models';
import { DEFAULT_OPENROUTER_MODEL, OpenRouterModelId } from '@/lib/llm/models-openrouter';
import { getUser } from '@/lib/auth/user';
import { getModelProvider } from '@/lib/llm/models-unified';

// API route using Vercel AI SDK for chat
// Integrates with existing workspace system

export async function POST(req: NextRequest) {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const session = await validateSession(sessionToken);
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { messages, workspaceId, chatMessageId, model } = body;

    // Get user to access their model preference
    const user = await getUser(session.user.id);
    const selectedModel = model || user?.settings?.anthropicModel || DEFAULT_OPENROUTER_MODEL;
    
    // Determine provider from model ID
    const providerType = getModelProvider(selectedModel);
    const useOpenRouterProvider = providerType === 'openrouter';

    if (!workspaceId) {
      return new Response('workspaceId is required', { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      logger.error('Invalid messages format', { messages, body });
      return new Response('messages must be an array', { status: 400 });
    }

    // Check for required API keys based on provider
    if (useOpenRouterProvider) {
      if (!process.env.OPENROUTER_API_KEY) {
        return new Response('OPENROUTER_API_KEY not configured', { status: 500 });
      }
    } else {
      if (!process.env.ANTHROPIC_API_KEY) {
        return new Response('ANTHROPIC_API_KEY not configured', { status: 500 });
      }
    }

    // Get existing chat history from database for context
    const existingMessages = await listMessagesForWorkspace(workspaceId);
    
    // Build message history for the LLM (last 10 conversational messages)
    const messageHistory = existingMessages
      .filter(msg => msg.response && !msg.responsePlanId && !msg.responseRenderId)
      .slice(-10)
      .flatMap(msg => [
        { role: 'user' as const, content: msg.prompt },
        { role: 'assistant' as const, content: msg.response || '' }
      ]);

    // Add current user message from useChat
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === 'user') {
      messageHistory.push({ role: 'user', content: lastUserMessage.content });
    }

    // System prompt matching Go backend's chatOnlySystemPrompt
    const systemPrompt = `You are ChartSmith, an expert AI assistant and a highly skilled senior software developer specializing in the creation, improvement, and maintenance of Helm charts.

Your primary responsibility is to help users transform, refine, and optimize Helm charts based on a variety of inputs.

Your guidance should be exhaustive, thorough, and precisely tailored to the user's needs.
Always ensure that your output is a valid, production-ready Helm chart setup adhering to Helm best practices.

Use only valid Markdown for your responses.
NEVER use the word "artifact" in your final messages to the user.

<question_instructions>
  - You will be asked to answer a question.
  - You will be given the question and the context of the question.
  - You will be given the current chat history.
  - You will be asked to answer the question based on the context and the chat history.
  - You can provide small examples of code, but just use markdown.
</question_instructions>`;

    // Create provider and model based on selection
    let modelInstance;
    if (useOpenRouterProvider) {
      const openrouter = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      modelInstance = openrouter(selectedModel as OpenRouterModelId);
    } else {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      modelInstance = anthropic(selectedModel as AnthropicModelId);
    }

    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: messageHistory,
      maxTokens: 8192,
      onFinish: async ({ text }) => {
        // Save response to database
        try {
          if (chatMessageId) {
            const { getDB } = await import('@/lib/data/db');
            const { getParam } = await import('@/lib/data/param');
            const db = getDB(await getParam('DB_URI'));
            await db.query(
              `UPDATE workspace_chat SET response = $1, is_intent_complete = true, is_intent_conversational = true WHERE id = $2`,
              [text, chatMessageId]
            );
          }
        } catch (error) {
          logger.error('Failed to save chat response', error, { chatMessageId });
        }
      },
    });

    // Return the streaming response
    // In AI SDK v5, streamText result has toTextStreamResponse() method
    return result.toTextStreamResponse();
  } catch (error) {
    logger.error('Chat API error', error, {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        message: error instanceof Error ? error.message : String(error) 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

