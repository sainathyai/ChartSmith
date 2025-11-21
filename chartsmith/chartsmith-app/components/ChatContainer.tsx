"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Users, Code, User, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Session } from "@/lib/types/session";
import { ChatMessage } from "./ChatMessage";
import { messagesAtom, workspaceAtom, isRenderingAtom } from "@/atoms/workspace";
import { useAtom } from "jotai";
import { createChatMessageAction } from "@/lib/workspace/actions/create-chat-message";
import { cancelMessageAction } from "@/lib/workspace/actions/cancel-message";
import { getWorkspaceMessagesAction } from "@/lib/workspace/actions/get-workspace-messages";
import { updateUserSettingAction } from "@/lib/auth/actions/update-user-setting";
import { ScrollingContent } from "./ScrollingContent";
import { NewChartChatMessage } from "./NewChartChatMessage";
import { NewChartContent } from "./NewChartContent";
import { ModelSelector } from "./ModelSelector";
import { useChat } from '@ai-sdk/react';
import { DEFAULT_MODEL } from "@/lib/llm/models";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/llm/models-openrouter";
import { getModelProvider, ProviderType } from "@/lib/llm/models-unified";

interface ChatContainerProps {
  session: Session;
}

export function ChatContainer({ session }: ChatContainerProps) {
  const { theme } = useTheme();
  const [workspace] = useAtom(workspaceAtom)
  const [messages, setMessages] = useAtom(messagesAtom)
  const [isRendering] = useAtom(isRenderingAtom)
  const [selectedRole, setSelectedRole] = useState<"auto" | "developer" | "operator">("auto");
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  
  // Model selection - use user's preference or default to OpenRouter
  const [selectedModel, setSelectedModel] = useState<string>(
    session.user?.settings?.anthropicModel || DEFAULT_OPENROUTER_MODEL
  );
  
  // Determine provider from selected model (default to OpenRouter)
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(() => {
    const model = session.user?.settings?.anthropicModel || DEFAULT_OPENROUTER_MODEL;
    return getModelProvider(model);
  });
  
  // Store abort controllers for each active request, keyed by messageId
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  
  // Use local state for input
  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Use Vercel AI SDK's useChat hook for chat functionality (for streaming)
  const chatHook = useChat({
    api: '/api/chat',
    body: {
      workspaceId: workspace?.id,
    },
    onFinish: async (message) => {
      // When AI finishes, ensure the message is saved to database
      // The API route already handles this, but we can sync here if needed
      // Clear local input when message is finished
      setLocalInput('');
      setIsLoading(false);
    },
  });
  
  // Extract what we can from useChat, but handle missing functions gracefully
  const { input, handleSubmit } = chatHook;
  const chatIsLoading = chatHook.isLoading || isLoading;
  
  // Use local input state
  const currentInput = localInput;
  
  // Create handleInputChange using local state
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalInput(e.target.value);
  };
  
  // No need for refs as ScrollingContent manages its own scrolling

  // Close the role menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setIsRoleMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      // Abort all active requests on unmount
      abortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
      abortControllersRef.current.clear();
    };
  }, []);

  // Track if we're changing provider to prevent circular updates
  const isChangingProviderRef = useRef(false);
  
  // Handle model change and save to user settings
  const handleModelChange = async (modelId: string) => {
    // Don't update provider if we're in the middle of a provider change
    if (!isChangingProviderRef.current) {
      setSelectedModel(modelId);
      setSelectedProvider(getModelProvider(modelId));
      try {
        await updateUserSettingAction(session, 'anthropic_model', modelId);
      } catch (error) {
        console.error('Failed to save model preference:', error);
      }
    }
  };
  
  // Handle provider change
  const handleProviderChange = async (provider: ProviderType) => {
    isChangingProviderRef.current = true;
    setSelectedProvider(provider);
    // Update model to default for the new provider
    const defaultModel = provider === "openrouter" ? DEFAULT_OPENROUTER_MODEL : DEFAULT_MODEL;
    setSelectedModel(defaultModel);
    // Save to user settings
    try {
      await updateUserSettingAction(session, 'anthropic_model', defaultModel);
    } catch (error) {
      console.error('Failed to save model preference:', error);
    }
    // Reset flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isChangingProviderRef.current = false;
    }, 100);
  };

  // Cancel function that can be called from ChatMessage
  const handleCancelMessage = async (messageId: string) => {
    // Abort the fetch request if it exists
    const controller = abortControllersRef.current.get(messageId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(messageId);
      setIsLoading(false); // Update loading state when canceling
    }
    
    // Mark as canceled in database
    try {
      const chatMessage = await cancelMessageAction(session, messageId);
      if (chatMessage && setMessages) {
        setMessages((messages) => messages.map((m) => m.id === messageId ? (chatMessage as any) : m));
      }
    } catch (error) {
      console.error('Error canceling message:', error);
    }
  };

  const handleSubmitChat = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const messageText = currentInput?.trim() || '';
    
    console.log('handleSubmitChat called', { messageText, isRendering, isLoading, hasSession: !!session, hasWorkspace: !!workspace });
    
    // Prevent double submission
    if (!messageText || isRendering || chatIsLoading || isLoading) {
      return;
    }

    if (!session || !workspace) {
      console.log('Missing session or workspace');
      return;
    }

    let chatMessage: any = null;
    try {
      console.log('Creating chat message...');
      // Create chat message in database first
      chatMessage = await createChatMessageAction(session, workspace.id, messageText, selectedRole);
      console.log('Chat message created:', chatMessage.id);
      setMessages(prev => [...prev, chatMessage]);

      // Clear local input immediately
      setLocalInput('');
      setIsLoading(true);

      console.log('Calling API route...');
      
      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllersRef.current.set(chatMessage.id, abortController);
      
      try {
        // Call the API route directly using fetch
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          body: JSON.stringify({
            messages: [
              { role: 'user', content: messageText }
            ],
            workspaceId: workspace.id,
            chatMessageId: chatMessage.id,
            model: selectedModel,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Handle streaming response - consume the stream
        // The API route handles saving to database in onFinish callback
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              // Decode chunk (we don't need to process it, just consume the stream)
              decoder.decode(value, { stream: true });
            }
            // Finalize decoding
            decoder.decode();
          } catch (streamError) {
            // Check if it was aborted
            if (streamError instanceof Error && streamError.name === 'AbortError') {
              console.log('Request aborted');
              return; // Don't update loading state, cancel handler will do it
            }
            console.error('Error reading stream:', streamError);
            // Don't throw - the message was already created in the database
          }
        }
        
        console.log('API call completed');
        // Remove abort controller on successful completion
        abortControllersRef.current.delete(chatMessage.id);
        setIsLoading(false);
        
        // Refresh messages to get updated state from database
        try {
          const updatedMessages = await getWorkspaceMessagesAction(session, workspace.id);
          setMessages(updatedMessages);
        } catch (error) {
          console.error('Failed to refresh messages:', error);
        }
      } catch (error) {
        // Clean up abort controller
        if (chatMessage) {
          abortControllersRef.current.delete(chatMessage.id);
        }
        
        // Check if it was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request aborted');
          setIsLoading(false);
          return; // Don't throw, just return
        }
        throw error; // Re-throw other errors
      }
    } catch (error) {
      console.error('Error submitting chat:', error);
      // Clean up abort controller on error
      if (chatMessage) {
        abortControllersRef.current.delete(chatMessage.id);
      }
      setIsLoading(false);
      // Optionally show error to user
    }
  };

  if (!messages || !workspace) {
    return null;
  }
  
  const getRoleLabel = (role: "auto" | "developer" | "operator"): string => {
    switch (role) {
      case "auto":
        return "Auto-detect";
      case "developer":
        return "Chart Developer";
      case "operator":
        return "End User";
      default:
        return "Auto-detect";
    }
  };

  // ScrollingContent will now handle all the scrolling behavior

  if (workspace?.currentRevisionNumber === 0) {
    // For NewChartContent, create a simpler version of handleSubmitChat that doesn't use role selector
    const handleNewChartSubmitChat = async (e: React.FormEvent) => {
      e.preventDefault();
      const messageText = currentInput?.trim() || '';
      if (!messageText || isRendering || chatIsLoading) return;
      if (!session || !workspace) return;

      // Always use AUTO for new chart creation
      const chatMessage = await createChatMessageAction(session, workspace.id, messageText, "auto");
      setMessages(prev => [...prev, chatMessage]);
      
      // Clear local input
      setLocalInput('');
      setIsLoading(true);
      
      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllersRef.current.set(chatMessage.id, abortController);
      
      try {
        // Call the API route directly
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          body: JSON.stringify({
            messages: [
              { role: 'user', content: messageText }
            ],
            workspaceId: workspace.id,
            chatMessageId: chatMessage.id,
            model: selectedModel,
            useOpenRouter: selectedProvider === 'openrouter',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // Handle streaming response - consume the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              decoder.decode(value, { stream: true });
            }
            decoder.decode();
          } catch (streamError) {
            // Check if it was aborted
            if (streamError instanceof Error && streamError.name === 'AbortError') {
              console.log('Request aborted');
              return;
            }
            console.error('Error reading stream:', streamError);
          }
        }
        
        // Remove abort controller on successful completion
        abortControllersRef.current.delete(chatMessage.id);
        setIsLoading(false);
      } catch (error) {
        // Clean up abort controller
        abortControllersRef.current.delete(chatMessage.id);
        
        // Check if it was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request aborted');
          setIsLoading(false);
          return;
        }
        throw error;
      }
    };
    
    return <NewChartContent
      session={session}
      chatInput={currentInput}
      setChatInput={setLocalInput}
      handleSubmitChat={handleNewChartSubmitChat}
      onCancel={handleCancelMessage}
    />
  }

  return (
    <div className={`h-[calc(100vh-3.5rem)] border-r flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out w-full relative ${theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"}`}>
      <div className="flex-1 h-full">
        <ScrollingContent forceScroll={true}>
          <div className={workspace?.currentRevisionNumber === 0 ? "" : "pb-32"}>
            {messages.map((item, index) => (
              <div key={item.id}>
                <ChatMessage
                  key={item.id}
                  messageId={item.id}
                  session={session}
                  onCancel={handleCancelMessage}
                  onContentUpdate={() => {
                    // No need to update state - ScrollingContent will handle scrolling
                  }}
                />
              </div>
            ))}
          </div>
        </ScrollingContent>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 ${theme === "dark" ? "bg-dark-surface" : "bg-white"} border-t ${theme === "dark" ? "border-dark-border" : "border-gray-200"}`}>
        <form onSubmit={handleSubmitChat} className="p-3 relative" id="chat-form">
          <textarea
            value={currentInput}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isRendering && !chatIsLoading && currentInput?.trim()) {
                  // Trigger form submission
                  const form = e.currentTarget.closest('form');
                  if (form) {
                    form.requestSubmit();
                  }
                }
              }
            }}
            placeholder="Ask a question or ask for a change..."
            rows={3}
            style={{ height: 'auto', minHeight: '72px', maxHeight: '150px' }}
            className={`w-full px-3 py-1.5 pr-24 text-sm rounded-md border resize-none overflow-hidden ${
              theme === "dark"
                ? "bg-dark border-dark-border/60 text-white placeholder-gray-500"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
            } focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50`}
          />

          <div className="absolute right-4 top-[18px] flex gap-2 items-center">
            {/* Role selector button */}
            <div ref={roleMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className={`p-1.5 rounded-full ${
                  theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                } ${selectedRole !== "auto" ? "bg-blue-500/10" : ""}`}
                title={`Perspective: ${getRoleLabel(selectedRole)}`}
              >
                {selectedRole === "auto" && <Sparkles className="w-4 h-4" />}
                {selectedRole === "developer" && <Code className="w-4 h-4" />}
                {selectedRole === "operator" && <User className="w-4 h-4" />}
              </button>
              
              {/* Role selector dropdown */}
              {isRoleMenuOpen && (
                <div 
                  className={`absolute bottom-full right-0 mb-1 w-56 rounded-lg shadow-lg border py-1 z-50 ${
                    theme === "dark" ? "bg-dark-surface border-dark-border" : "bg-white border-gray-200"
                  }`}
                >
                  <div className={`px-3 py-2 text-xs font-medium ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}>
                    Ask questions from...
                  </div>
                  {(["auto", "developer", "operator"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role);
                        setIsRoleMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                        selectedRole === role
                          ? theme === "dark" 
                            ? "bg-dark-border/60 text-white" 
                            : "bg-gray-100 text-gray-900"
                          : theme === "dark"
                            ? "text-gray-300 hover:bg-dark-border/40 hover:text-white"
                            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {role === "auto" && <Sparkles className="w-4 h-4" />}
                        {role === "developer" && <Code className="w-4 h-4" />}
                        {role === "operator" && <User className="w-4 h-4" />}
                        <span>{getRoleLabel(role)}</span>
                      </div>
                      {selectedRole === role && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Send button */}
            <button
              type="submit"
              disabled={isRendering || chatIsLoading}
              className={`p-1.5 rounded-full ${
                isRendering || isLoading
                  ? theme === "dark" ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
                  : theme === "dark"
                    ? "text-gray-400 hover:text-gray-200 hover:bg-dark-border/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {isRendering || chatIsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* Model selector row */}
          <div className="mt-3 flex items-center gap-3 relative z-10">
            <div className="max-w-[280px] w-full">
              <ModelSelector
                value={selectedModel}
                onChange={handleModelChange}
                provider={selectedProvider}
                onProviderChange={handleProviderChange}
                compact
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
