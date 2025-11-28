import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';

interface CacheEntry {
  response: string;
  timestamp: number;
  expiresAt: number;
}

class AICache {
  private static readonly CACHE_PREFIX = 'apohub_ai_cache_';
  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  static generateKey(prompt: string, data?: any): string {
    const dataStr = data ? JSON.stringify(data) : '';
    return this.CACHE_PREFIX + btoa(prompt + dataStr).substring(0, 32);
  }

  static get(key: string): string | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const entry: CacheEntry = JSON.parse(item);
      const now = Date.now();

      // Check if cache has expired
      if (now > entry.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }

      return entry.response;
    } catch (error) {
      logger.warn('Error reading from AI cache:', error);
      return null;
    }
  }

  static set(key: string, response: string): void {
    try {
      const entry: CacheEntry = {
        response,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      };

      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      logger.warn('Error writing to AI cache:', error);
    }
  }

  static clear(): void {
    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith(this.CACHE_PREFIX)
      );
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      logger.warn('Error clearing AI cache:', error);
    }
  }

  static cleanup(): void {
    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith(this.CACHE_PREFIX)
      );

      keys.forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const entry: CacheEntry = JSON.parse(item);
            if (Date.now() > entry.expiresAt) {
              localStorage.removeItem(key);
            }
          } catch {
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      logger.warn('Error cleaning up AI cache:', error);
    }
  }
}

export interface AIConfig {
  apiKey: string;
  model?: string;
  enableGoogleSearch?: boolean;
}

export interface AIMessage {
  role: 'user' | 'model';
  parts: Array<{
    text: string;
  }>;
}

export interface AIResponse {
  text: string;
  isComplete: boolean;
}

export class AIService {
  private ai: GoogleGenAI;
  private model: string;
  private enableGoogleSearch: boolean;

  constructor(config: AIConfig) {
    this.ai = new GoogleGenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'gemini-2.5-flash-lite';
    this.enableGoogleSearch = config.enableGoogleSearch || false;
  }

  async generateResponse(
    input: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void,
    useCache: boolean = true
  ): Promise<string> {
    // Generate cache key
    const cacheKey = useCache ? AICache.generateKey(
      systemPrompt ? `${systemPrompt}\n${input}` : input
    ) : null;

    // Check cache first
    if (cacheKey) {
      const cachedResponse = AICache.get(cacheKey);
      if (cachedResponse) {
        if (onChunk) {
          // Simulate streaming for cached response
          setTimeout(() => onChunk(cachedResponse), 10);
        }
        return cachedResponse;
      }
    }

    try {
      const tools = this.enableGoogleSearch ? [
        {
          googleSearch: {}
        },
      ] : [];

      const config = {
        thinkingConfig: {
          thinkingBudget: 0,
        },
        tools,
      };

      const contents: AIMessage[] = [];

      // Add system prompt if provided
      if (systemPrompt) {
        contents.push({
          role: 'user',
          parts: [
            {
              text: `System Instructions: ${systemPrompt}\n\nUser Query: ${input}`,
            },
          ],
        });
      } else {
        contents.push({
          role: 'user',
          parts: [
            {
              text: input,
            },
          ],
        });
      }

      const response = await this.ai.models.generateContentStream({
        model: this.model,
        config,
        contents,
      });

      let fullResponse = '';

      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
          if (onChunk) {
            onChunk(chunk.text);
          }
        }
      }

      // Cache the response
      if (cacheKey) {
        AICache.set(cacheKey, fullResponse);
      }

      return fullResponse;
    } catch (error) {
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  async generateEventSuggestions(userContext: string): Promise<string> {
    const prompt = `Based on the following context about an event management system, suggest improvements or features that could enhance the user experience:

Context: ${userContext}

Please provide specific, actionable suggestions for event management features, user interface improvements, or workflow optimizations.`;

    return this.generateResponse(prompt);
  }

  async analyzeEventData(eventData: string): Promise<string> {
    const prompt = `Analyze the following event data and provide insights:

Data: ${eventData}

Please provide:
1. Key trends and patterns
2. Recommendations for improvement
3. Potential issues to address`;

    return this.generateResponse(prompt);
  }

  async generateContentDescription(content: string, type: 'event' | 'form' | 'certificate'): Promise<string> {
    const prompts = {
      event: `Generate an engaging description for this event: ${content}`,
      form: `Create a user-friendly description for this form: ${content}`,
      certificate: `Write a professional description for this certificate: ${content}`
    };

    return this.generateResponse(prompts[type]);
  }
}

// Default instance with environment variable
let defaultAIService: AIService | null = null;

export const initializeAIService = (): AIService => {
  const apiKey = import.meta.env.VITE_GEMINI_API;

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API key is not configured. Please add it to your environment variables.');
  }

  if (apiKey.length < 20) {
    throw new Error('VITE_GEMINI_API key appears to be invalid (too short).');
  }

  try {
    defaultAIService = new AIService({
      apiKey,
      model: 'gemini-2.5-flash-lite',
      enableGoogleSearch: true
    });
    return defaultAIService;
  } catch (error) {
    throw error;
  }
};

export const getAIService = (): AIService => {
  if (!defaultAIService) {
    return initializeAIService();
  }
  return defaultAIService;
};

// Export the main service functions for easy access
export const aiService = {
  generateResponse: (input: string, systemPrompt?: string, onChunk?: (chunk: string) => void, useCache: boolean = true) =>
    getAIService().generateResponse(input, systemPrompt, onChunk, useCache),

  generateEventSuggestions: (userContext: string) =>
    getAIService().generateEventSuggestions(userContext),

  analyzeEventData: (eventData: string) =>
    getAIService().analyzeEventData(eventData),

  generateContentDescription: (content: string, type: 'event' | 'form' | 'certificate') =>
    getAIService().generateContentDescription(content, type),


};
