import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

/**
 * Chat message format used by the Simple Chat service.
 */
export interface SimpleChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * A lightweight wrapper around the Gemini API for basic chat functionality.
 */
class SimpleChatService {
  private provider: ReturnType<typeof createGoogleGenerativeAI> | null = null;

  constructor() {
    const apiKey = (import.meta.env as { VITE_GOOGLE_AI_API_KEY?: string }).VITE_GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.provider = createGoogleGenerativeAI({ apiKey });
      console.log("SimpleChatService initialized with Gemini");
    } else {
      console.warn("Gemini API key missing. Simple chat disabled.");
    }
  }

  /**
   * Send a chat request to Gemini using the provided message history.
   * @param messages Ordered array of chat messages forming the conversation.
   * @returns The assistant's reply text.
   */
  async sendMessage(messages: SimpleChatMessage[]): Promise<string> {
    if (!this.provider) {
      throw new Error("Gemini provider not initialized");
    }

    try {
      const result = await generateText({
        model: this.provider("gemini-pro"),
        messages,
        maxTokens: 1024,
        temperature: 0.7,
      });
      return result.text.trim();
    } catch (error) {
      console.error("SimpleChatService error:", error);
      throw error;
    }
  }
}

export const simpleChatService = new SimpleChatService();
