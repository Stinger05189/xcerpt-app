// src/features/llm/types/llm.ts
export type LLMProviderId = 'openrouter' | 'gemini' | 'openai' | 'anthropic';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMToolDefinition {
  type: 'function';
  function: LLMToolFunction;
}

export interface LLMCompletionOptions {
  providerId?: LLMProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: {
    type: 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface LLMCompletionResult {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
}

export interface LLMProviderConfig {
  id: LLMProviderId;
  name: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  availableModels: string[];
  customModels?: string[];
}

export interface LLMSettingsConfig {
  activeProvider: LLMProviderId;
  providers: Record<LLMProviderId, LLMProviderConfig>;
}