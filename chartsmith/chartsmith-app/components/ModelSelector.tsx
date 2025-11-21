"use client";

import React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { ALL_MODELS, getModelProvider, ProviderType } from "@/lib/llm/models-unified";
import { DEFAULT_MODEL } from "@/lib/llm/models";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/llm/models-openrouter";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  provider?: ProviderType;
  onProviderChange?: (provider: ProviderType) => void;
  className?: string;
  compact?: boolean;
}

export function ModelSelector({ 
  value, 
  onChange, 
  provider,
  onProviderChange,
  className = "",
  compact = false,
}: ModelSelectorProps) {
  const { theme } = useTheme();
  
  // Determine current provider from prop if provided, otherwise from model ID
  const currentProvider = provider !== undefined ? provider : getModelProvider(value || DEFAULT_MODEL);
  const currentModel = value || (currentProvider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_MODEL);
  
  // Filter models by provider
  const availableModels = Object.values(ALL_MODELS).filter(
    model => model.provider === currentProvider
  );

  const triggerBase = compact
    ? "px-2 py-1 text-[12px]"
    : "px-3 py-1.5 text-[13px]";

  const containerClasses =
    theme === "dark"
      ? "bg-white/5 border border-white/10 text-gray-300"
      : "bg-black/5 border border-black/10 text-gray-600";

  const contentClasses =
    theme === "dark"
      ? "bg-[#1c1c1f] border border-white/10 shadow-lg shadow-black/50"
      : "bg-white border border-black/10 shadow-lg shadow-black/10";

  const itemClasses =
    theme === "dark"
      ? "text-gray-100 data-[highlighted]:bg-white/10 data-[state=checked]:text-white"
      : "text-gray-800 data-[highlighted]:bg-black/5 data-[state=checked]:text-black";

  return (
    <div
      className={`flex items-center gap-1 rounded-full ${containerClasses} ${className} ${
        compact ? "pl-2 pr-2 py-1" : "pl-3 pr-3 py-1.5"
      }`}
    >
      {onProviderChange && (
        <RadixSelect.Root
          value={currentProvider}
          onValueChange={(newProvider) => {
            if (!newProvider) return;
            const providerValue = newProvider as ProviderType;
            // Only proceed if actually changing
            if (providerValue === currentProvider) return;
            // Update provider first
            onProviderChange(providerValue);
            // Then update model to default for that provider
            const defaultModel = providerValue === "openrouter" ? DEFAULT_OPENROUTER_MODEL : DEFAULT_MODEL;
            onChange(defaultModel);
          }}
        >
          <RadixSelect.Trigger
            className={`rounded-full bg-transparent border border-transparent cursor-pointer flex items-center gap-1 ${triggerBase}`}
          >
            <RadixSelect.Value>
              {currentProvider === "anthropic" ? "Anthropic" : "OpenRouter"}
            </RadixSelect.Value>
            <RadixSelect.Icon>
              <ChevronDown className="w-3 h-3" />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>
          <RadixSelect.Portal>
            <RadixSelect.Content
              side="top"
              sideOffset={6}
              position="popper"
              className={`${contentClasses} rounded-md overflow-hidden min-w-[140px] z-[100]`}
            >
              <RadixSelect.Viewport className="p-1">
                {["anthropic", "openrouter"].map((prov) => (
                  <RadixSelect.Item
                    key={prov}
                    value={prov}
                    className={`px-3 py-1.5 rounded-md cursor-pointer flex items-center justify-between ${itemClasses} text-[12px]`}
                  >
                    <RadixSelect.ItemText>
                      {prov === "anthropic" ? "Anthropic" : "OpenRouter"}
                    </RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator>
                      <Check className="w-4 h-4" />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
      )}

      {onProviderChange && (
        <span
          className={`${
            theme === "dark" ? "text-white/20" : "text-black/30"
          } ${compact ? "mx-1 text-xs" : "mx-2 text-sm"}`}
        >
          |
        </span>
      )}
      
      <RadixSelect.Root value={currentModel} onValueChange={onChange}>
        <RadixSelect.Trigger
          className={`rounded-full bg-transparent border border-transparent cursor-pointer flex items-center gap-0 flex-1 min-w-0 ${triggerBase}`}
        >
          <div className="flex-1 text-left truncate overflow-hidden min-w-0 pr-1">
            <RadixSelect.Value />
          </div>
          <RadixSelect.Icon className="flex-shrink-0">
            <ChevronDown className="w-3 h-3" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            side="top"
            sideOffset={6}
            position="popper"
            className={`${contentClasses} rounded-md overflow-hidden ${compact ? "min-w-[160px]" : "min-w-[180px]"} z-[100]`}
          >
            <RadixSelect.Viewport className="p-1">
              {availableModels.map((model) => (
                <RadixSelect.Item
                  key={model.id}
                  value={model.id}
                  className={`px-3 py-1.5 rounded-md cursor-pointer flex items-center justify-between ${itemClasses} text-[12px]`}
                >
                  <RadixSelect.ItemText className="whitespace-normal leading-tight break-words flex-1 pr-2">
                    {model.name}
                  </RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="w-4 h-4" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}

