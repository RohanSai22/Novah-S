// Chat Session Storage Service with Perfect Mind Map Support
import type {
  ThinkingStreamData as AIServiceThinkingStreamData,
  Source,
} from "@/services/aiService";
import type { PerfectMindMapData } from "@/services/perfectMindMapService";

// =====================================================================================
// ADVANCED MIND MAP DATA STRUCTURES
// =====================================================================================

export interface ConversationNode {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  query: string;
  response: string;
  timestamp: Date;
  relevanceScore: number;
  topicIds: string[];
  summary: string;
  keyInsights: string[];
  position?: { x: number; y: number };
  metadata: {
    wordCount: number;
    hasFiles: boolean;
    hasThinking: boolean;
    isAutonomous: boolean;
    sources: Source[];
  };
}

export interface TopicNode {
  id: string;
  name: string;
  description: string;
  color: string;
  conversationIds: string[];
  centralityScore: number;
  position?: { x: number; y: number };
  metadata: {
    totalConversations: number;
    avgRelevanceScore: number;
    createdAt: Date;
    lastUpdated: Date;
    keywords: string[];
  };
}

export interface CentralNode {
  id: string;
  title: string;
  description: string;
  overallQuery: string;
  position?: { x: number; y: number };
  metadata: {
    totalTopics: number;
    totalConversations: number;
    createdAt: Date;
    lastGenerated: Date;
  };
}

export interface MindMapNodeExtended {
  id: string;
  type: "central" | "topic" | "conversation";
  label: string;
  position: { x: number; y: number };
  data: {
    level: number;
    nodeType: "central" | "topic" | "conversation";
    summary?: string;
    content?: string;
    relevanceScore?: number;
    centralityScore?: number;
    metadata?: any;
    color?: string;
    size?: number;
    interactive?: boolean;
  };
  style?: { [key: string]: string | number };
}

export interface MindMapEdgeExtended {
  id: string;
  source: string;
  target: string;
  type:
    | "central-to-topic"
    | "topic-to-conversation"
    | "conversation-to-conversation";
  label: string;
  animated: boolean;
  data: {
    weight: number;
    relationship: string;
    metadata?: any;
  };
  style?: { [key: string]: string | number };
  labelStyle?: { [key: string]: string | number };
}

export interface AdvancedMindMapData {
  central: CentralNode;
  topics: TopicNode[];
  conversations: ConversationNode[];
  nodes: MindMapNodeExtended[];
  edges: MindMapEdgeExtended[];
  metadata: {
    version: string;
    generatedAt: Date;
    totalNodes: number;
    totalEdges: number;
    maxConversations: number;
    layoutAlgorithm: string;
    performance: {
      generationTime: number;
      layoutTime: number;
      renderTime?: number;
    };
  };
  cache: {
    topicDistribution: { [topicId: string]: number };
    conversationSortOrder: string[];
    layoutPositions: { [nodeId: string]: { x: number; y: number } };
    lastCacheUpdate: Date;
  };
}

// =====================================================================================
// ENHANCED SESSION INTERFACES
// =====================================================================================

export interface ChatSessionSummary {
  id: string;
  title: string;
  originalQuery: string;
  lastUpdated: Date;
  messageCount: number;
  hasFiles: boolean;
  hasMindMap: boolean;
  hasThinking: boolean;
  isAutonomous: boolean;
  /** Mode of the session: Normal, Deep, or Simple chat. */
  mode?: "normal" | "deep" | "simple";
  // Enhanced metadata
  topicCount?: number;
  relevanceScore?: number;
  mindMapVersion?: string;
  lastMindMapUpdate?: Date;
}

export interface UploadedFileMetadata {
  name: string;
  type: string;
  size: number;
  extractedText?: string;
  processingTimestamp?: Date;
}

export interface ThinkingStreamData {
  type: string;
  data: any;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  files?: UploadedFileMetadata[];
  thinking?: any[];
  thinkingStreamData?: AIServiceThinkingStreamData[];
  sources?: Source[];
  timestamp: Date | string;
  isAutonomous?: boolean;
  // Enhanced for mind map integration
  relevanceScore?: number;
  topicIds?: string[];
  summary?: string;
  keyInsights?: string[];
}

export interface ChatSession {
  id: string;
  originalQuery: string;
  uploadedFileMetadata?: UploadedFileMetadata[];
  isAutonomousMode: boolean;
  /** Session interaction mode. */
  mode: "normal" | "deep" | "simple";
  messages: ChatMessage[];
  // Perfect mind map data
  perfectMindMapData?: PerfectMindMapData | null;
  createdAt: Date;
  lastUpdated: Date;
  // Enhanced metadata for mind maps
  mindMapSettings: {
    maxConversations: number;
    topicThreshold: number;
    layoutAlgorithm: "dagre" | "force" | "hierarchical";
    autoUpdateEnabled: boolean;
    cacheEnabled: boolean;
  };
}

const CHAT_SESSIONS_KEY = "chatSessions";
const CURRENT_SESSION_KEY = "currentSessionId";

class ChatSessionStorageService {
  // Generate unique session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique node/topic IDs
  private generateTopicId(): string {
    return `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get all chat sessions
  getAllSessions(): ChatSessionSummary[] {
    try {
      const sessionsData = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (!sessionsData) return [];

      const sessions = JSON.parse(sessionsData) as ChatSessionSummary[];
      return sessions
        .map((session) => ({
          ...session,
          lastUpdated: new Date(session.lastUpdated),
        }))
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    } catch (error) {
      console.error("Error loading chat sessions:", error);
      return [];
    }
  }

  // Save a complete chat session
  saveSession(session: ChatSession): void {
    try {
      // Save the full session data
      localStorage.setItem(
        `chatSession_${session.id}`,
        JSON.stringify(session)
      );

      // Update sessions summary list
      const sessions = this.getAllSessions();
      const existingIndex = sessions.findIndex((s) => s.id === session.id);
      const summary: ChatSessionSummary = {
        id: session.id,
        title:
          session.originalQuery.length > 50
            ? session.originalQuery.substring(0, 50) + "..."
            : session.originalQuery,
        originalQuery: session.originalQuery,
        lastUpdated: new Date(session.lastUpdated),
        messageCount: session.messages.length,
        hasFiles:
          session.uploadedFileMetadata &&
          session.uploadedFileMetadata.length > 0,
        hasMindMap: !!session.perfectMindMapData,
        hasThinking: session.messages.some(
          (msg) => msg.type === "ai" && (msg.thinkingStreamData || msg.thinking)
        ),
        isAutonomous: session.isAutonomousMode, // Enhanced metadata
        mode: session.mode,
        topicCount: session.perfectMindMapData?.nodes?.length || 0,
        relevanceScore: this.calculateSessionRelevanceScore(session),
        mindMapVersion: "2.0",
        lastMindMapUpdate: session.perfectMindMapData?.metadata?.generatedAt
          ? new Date(session.perfectMindMapData.metadata.generatedAt)
          : undefined,
      };

      if (existingIndex >= 0) {
        sessions[existingIndex] = summary;
      } else {
        sessions.unshift(summary);
      }

      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
      localStorage.setItem(CURRENT_SESSION_KEY, session.id);

      console.log("Chat session saved:", session.id);
    } catch (error) {
      console.error("Error saving chat session:", error);
      throw new Error("Failed to save chat session");
    }
  }

  // Load a specific session
  loadSession(sessionId: string): ChatSession | null {
    try {
      const sessionData = localStorage.getItem(`chatSession_${sessionId}`);
      if (!sessionData) return null;

      const session = JSON.parse(sessionData) as ChatSession;

      // Convert string timestamps back to Date objects
      session.createdAt = new Date(session.createdAt);
      session.lastUpdated = new Date(session.lastUpdated);
      session.messages = session.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      return session;
    } catch (error) {
      console.error("Error loading chat session:", error);
      return null;
    }
  }

  // Create a new session
  createNewSession(): string {
    const sessionId = this.generateSessionId();
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
    return sessionId;
  }

  // Get current session ID
  getCurrentSessionId(): string | null {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  }

  // Set current session ID
  setCurrentSessionId(sessionId: string): void {
    try {
      localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
      console.log("Current session ID set:", sessionId);
    } catch (error) {
      console.error("Error setting current session ID:", error);
    }
  }

  // Delete a session and all associated data
  deleteSession(sessionId: string): void {
    try {
      // Remove session data
      localStorage.removeItem(`chatSession_${sessionId}`);

      // Remove thinking processes for this session
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (
          key.startsWith(`thinking_process_${sessionId}_`) ||
          (key.startsWith(`thinking_process_`) && key.includes(sessionId))
        ) {
          localStorage.removeItem(key);
        }
      });

      // Update sessions list
      const sessions = this.getAllSessions();
      const filteredSessions = sessions.filter((s) => s.id !== sessionId);
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(filteredSessions));

      console.log("Session deleted:", sessionId);
    } catch (error) {
      console.error("Error deleting session:", error);
      throw new Error("Failed to delete session");
    }
  }

  // Clear all sessions
  clearAllSessions(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (
          key.startsWith("chatSession_") ||
          key.startsWith("thinking_process_") ||
          key === CHAT_SESSIONS_KEY ||
          key === CURRENT_SESSION_KEY
        ) {
          localStorage.removeItem(key);
        }
      });
      console.log("All sessions cleared");
    } catch (error) {
      console.error("Error clearing all sessions:", error);
      throw new Error("Failed to clear all sessions");
    }
  } // Save thinking process for a specific message
  saveThinkingProcess(
    messageId: string,
    thinkingData: AIServiceThinkingStreamData[]
  ): void {
    try {
      const key = `thinking_process_${messageId}`;
      const dataToSave = {
        messageId,
        timestamp: new Date().toISOString(),
        data: thinkingData,
      };

      localStorage.setItem(key, JSON.stringify(dataToSave));
      console.log(
        "ChatSessionStorage: Thinking process saved for message:",
        messageId,
        "with",
        thinkingData.length,
        "data points"
      );

      // Also store in a master index for better tracking
      const indexKey = "thinking_process_index";
      let index = [];
      try {
        const existingIndex = localStorage.getItem(indexKey);
        if (existingIndex) {
          index = JSON.parse(existingIndex);
        }
      } catch (e) {
        index = [];
      }

      if (!index.includes(messageId)) {
        index.push(messageId);
        localStorage.setItem(indexKey, JSON.stringify(index));
      }
    } catch (error) {
      console.error("Error saving thinking process:", error);
    }
  }
  // Load thinking process for a specific message
  loadThinkingProcess(messageId: string): AIServiceThinkingStreamData[] | null {
    try {
      const key = `thinking_process_${messageId}`;
      const data = localStorage.getItem(key);
      if (!data) {
        console.log(
          "ChatSessionStorage: No thinking data found for message:",
          messageId
        );
        return null;
      }

      const parsedData = JSON.parse(data);

      // Handle both old format (direct array) and new format (object with metadata)
      if (Array.isArray(parsedData)) {
        console.log(
          "ChatSessionStorage: Loaded thinking data (old format) for message:",
          messageId,
          "with",
          parsedData.length,
          "items"
        );
        return parsedData;
      } else if (parsedData.data && Array.isArray(parsedData.data)) {
        console.log(
          "ChatSessionStorage: Loaded thinking data (new format) for message:",
          messageId,
          "with",
          parsedData.data.length,
          "items"
        );
        return parsedData.data;
      }

      console.log(
        "ChatSessionStorage: Invalid thinking data format for message:",
        messageId
      );
      return null;
    } catch (error) {
      console.error("Error loading thinking process:", error);
      return null;
    }
  } // Check if thinking process exists for a message
  hasThinkingProcess(messageId: string): boolean {
    try {
      const key = `thinking_process_${messageId}`;
      const data = localStorage.getItem(key);
      const hasData = data !== null;
      console.log(
        "ChatSessionStorage: Checking thinking data for message:",
        messageId,
        "exists:",
        hasData
      );
      return hasData;
    } catch (error) {
      console.error("Error checking thinking process:", error);
      return false;
    }
  }

  // =====================================================================================
  // ENHANCED METHODS FOR ADVANCED MIND MAP SUPPORT
  // =====================================================================================

  // Calculate session relevance score based on various factors
  private calculateSessionRelevanceScore(session: ChatSession): number {
    let score = 0;

    // Base score from message count (up to 30 points)
    score += Math.min(session.messages.length * 3, 30);

    // Bonus for files (20 points)
    if (
      session.uploadedFileMetadata &&
      session.uploadedFileMetadata.length > 0
    ) {
      score += 20;
    }

    // Bonus for thinking processes (15 points)
    if (
      session.messages.some((msg) => msg.thinkingStreamData || msg.thinking)
    ) {
      score += 15;
    }

    // Bonus for autonomous mode (10 points)
    if (session.isAutonomousMode) {
      score += 10;
    }
    // Bonus for mind map data (15 points)
    if (session.perfectMindMapData) {
      score += 15;
    }

    // Recency bonus (up to 20 points)
    const daysSinceUpdate =
      (Date.now() - new Date(session.lastUpdated).getTime()) /
      (1000 * 60 * 60 * 24);
    score += Math.max(0, 20 - Math.floor(daysSinceUpdate * 2));

    return Math.min(100, score); // Cap at 100
  }
  // Save perfect mind map data for a session
  savePerfectMindMapData(
    sessionId: string,
    mindMapData: PerfectMindMapData
  ): void {
    try {
      const session = this.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.perfectMindMapData = mindMapData;
      session.lastUpdated = new Date();

      this.saveSession(session);
      console.log("Perfect mind map data saved for session:", sessionId);
    } catch (error) {
      console.error("Error saving perfect mind map data:", error);
      throw new Error("Failed to save perfect mind map data");
    }
  }

  // Load perfect mind map data for a session
  loadPerfectMindMapData(sessionId: string): PerfectMindMapData | null {
    try {
      const session = this.loadSession(sessionId);
      return session?.perfectMindMapData || null;
    } catch (error) {
      console.error("Error loading perfect mind map data:", error);
      return null;
    }
  }

  // Create a new session with enhanced settings
  createNewSessionWithSettings(
    mindMapSettings?: Partial<ChatSession["mindMapSettings"]>
  ): string {
    const sessionId = this.generateSessionId();

    const defaultSettings: ChatSession["mindMapSettings"] = {
      maxConversations: 30,
      topicThreshold: 0.7,
      layoutAlgorithm: "dagre",
      autoUpdateEnabled: true,
      cacheEnabled: true,
    };

    // Create a basic session structure to ensure it exists
    const basicSession: ChatSession = {
      id: sessionId,
      originalQuery: "",
      isAutonomousMode: false,
      mode: "normal",
      messages: [],
      createdAt: new Date(),
      lastUpdated: new Date(),
      mindMapSettings: { ...defaultSettings, ...mindMapSettings },
    };

    // Save the basic session
    localStorage.setItem(
      `chatSession_${sessionId}`,
      JSON.stringify(basicSession)
    );
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);

    return sessionId;
  }

  // Update mind map settings for a session
  updateMindMapSettings(
    sessionId: string,
    settings: Partial<ChatSession["mindMapSettings"]>
  ): void {
    try {
      const session = this.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      session.mindMapSettings = { ...session.mindMapSettings, ...settings };
      session.lastUpdated = new Date();

      this.saveSession(session);
      console.log("Mind map settings updated for session:", sessionId);
    } catch (error) {
      console.error("Error updating mind map settings:", error);
      throw new Error("Failed to update mind map settings");
    }
  }

  // Get sessions sorted by relevance score
  getSessionsByRelevance(): ChatSessionSummary[] {
    const sessions = this.getAllSessions();
    return sessions.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
  }

  // Search sessions by content, topics, or metadata
  searchSessions(query: string): ChatSessionSummary[] {
    const sessions = this.getAllSessions();
    const lowerQuery = query.toLowerCase();

    return sessions.filter(
      (session) =>
        session.title.toLowerCase().includes(lowerQuery) ||
        session.originalQuery.toLowerCase().includes(lowerQuery) ||
        (session.topicCount && session.topicCount > 0)
    );
  }

  // Get sessions with mind maps
  getSessionsWithMindMaps(): ChatSessionSummary[] {
    return this.getAllSessions().filter((session) => session.hasMindMap);
  }

  // Clean up old cache data and optimize storage
  cleanupStorage(): void {
    try {
      const keys = Object.keys(localStorage);
      const sessions = this.getAllSessions();
      const validSessionIds = new Set(sessions.map((s) => s.id));

      // Remove orphaned session data
      keys.forEach((key) => {
        if (key.startsWith("chatSession_")) {
          const sessionId = key.replace("chatSession_", "");
          if (!validSessionIds.has(sessionId)) {
            localStorage.removeItem(key);
            console.log("Removed orphaned session data:", sessionId);
          }
        }

        if (key.startsWith("thinking_process_")) {
          const messageId = key.replace("thinking_process_", "");
          // Check if this thinking process belongs to any existing session
          let belongsToSession = false;
          for (const sessionId of validSessionIds) {
            const session = this.loadSession(sessionId);
            if (session?.messages.some((msg) => msg.id === messageId)) {
              belongsToSession = true;
              break;
            }
          }
          if (!belongsToSession) {
            localStorage.removeItem(key);
            console.log("Removed orphaned thinking process:", messageId);
          }
        }
      });

      console.log("Storage cleanup completed");
    } catch (error) {
      console.error("Error during storage cleanup:", error);
    }
  }
}

export const chatSessionStorage = new ChatSessionStorageService();
