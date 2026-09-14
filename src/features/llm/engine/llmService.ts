// src/features/llm/engine/llmService.ts
import { useAppStore } from '../../../store/appStore';
import type { LLMCompletionOptions } from '../types/llm';
import { 
  SESSION_IDENTITY_SYSTEM_PROMPT, 
  COMMIT_SYNTHESIS_SYSTEM_PROMPT,
  type SessionIdentityOutput,
  type CommitSynthesisOutput
} from '../schemas/sessionCopilotSchemas';

export class LLMService {
  private static stripMarkdownFences(raw: string): string {
    let clean = raw.trim();
    if (clean.startsWith('```')) {
      const firstNewline = clean.indexOf('\n');
      if (firstNewline !== -1) {
        clean = clean.slice(firstNewline + 1);
      }
      if (clean.endsWith('```')) {
        clean = clean.slice(0, clean.lastIndexOf('```')).trim();
      }
    }
    return clean;
  }

  public static async executeStructuredOutput<T>(
    systemPrompt: string,
    userPrompt: string,
    schemaDescription: string
  ): Promise<T> {
    const config = useAppStore.getState().config.llm;
    const activeProviderId = config?.activeProvider || 'openrouter';
    const provider = config?.providers[activeProviderId];

    if (!provider || !provider.apiKey || !provider.apiKey.trim()) {
      throw new Error(`No API key configured for ${provider?.name || activeProviderId}. Please open Global Preferences to configure your credentials.`);
    }

    const options: LLMCompletionOptions = {
      providerId: activeProviderId,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.defaultModel,
      temperature: 0.2,
      maxTokens: 1000,
      responseFormat: {
        type: 'json_object'
      },
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\nSchema Requirement:\n${schemaDescription}`
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    };

    const result = await window.api.llmComplete(options);
    const cleanedJson = this.stripMarkdownFences(result.content);

    try {
      const parsed = JSON.parse(cleanedJson) as T;
      return parsed;
    } catch {
      // Fallback: regex search for JSON object inside prose
      const match = cleanedJson.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]) as T;
      }
      throw new Error(`Failed to parse structured JSON from LLM: ${result.content}`);
    }
  }

  public static async generateSessionIdentity(payload: {
    intent: string;
    actions: Array<{ type: string; path: string }>;
  }): Promise<SessionIdentityOutput> {
    const userPrompt = JSON.stringify(payload, null, 2);
    return this.executeStructuredOutput<SessionIdentityOutput>(
      SESSION_IDENTITY_SYSTEM_PROMPT,
      userPrompt,
      '{ "title": string, "description": string }'
    );
  }

  public static async synthesizeCommitMessage(payload: {
    architecturalIntent: string;
    actions: Array<{ actionType: string; targetRelativePath: string }>;
    gitDiff?: string;
    gitLog?: string;
    userGuidance?: string;
  }): Promise<CommitSynthesisOutput> {
    const userPrompt = JSON.stringify(payload, null, 2);
    return this.executeStructuredOutput<CommitSynthesisOutput>(
      COMMIT_SYNTHESIS_SYSTEM_PROMPT,
      userPrompt,
      '{ "subject": string, "body": string }'
    );
  }
}