import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Map, X, FilePlus, Loader2, Menu, Brain } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import PerfectMindMap from "@/components/PerfectMindMap";
import { toast } from "@/hooks/use-toast";
import ThinkingProcess from "@/components/chat/ThinkingProcess";
import AutonomousThinkingProcess from "@/components/chat/AutonomousThinkingProcess";
import StreamingText from "@/components/chat/StreamingText";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInput from "@/components/chat/ChatInput";
import { ChatSidebar } from "@/components/ui/ChatSidebar";
import {
  aiService,
  type ThinkingStreamData,
  type FinalReport,
  type Source,
  type AIServiceCallbacks,
} from "@/services/aiService";
import {
  autonomousResearchAgent,
  type StreamingCallback,
  type ProcessedFileInput,
} from "@/services/autonomousResearchAgent";
import { fileProcessingService } from "@/services/fileProcessingService";
import {
  perfectMindMapService,
  type PerfectMindMapData,
} from "@/services/perfectMindMapService";
import {
  chatSessionStorage,
  type ChatSession,
  type ChatMessage,
  type UploadedFileMetadata,
} from "@/services/chatSessionStorage";
import { simpleChatService, type SimpleChatMessage } from "@/services/simpleChatService";

interface UploadedFile {
  // For component state, includes File object
  id: string;
  name: string;
  content: string; // Content might be populated after processing for some types
  type: string;
  file: File; // The actual File object
  processed?: boolean;
  wordCount?: number;
  error?: string;
}

interface ThinkingStep {
  id: number;
  type: string;
  title: string;
  content: string;
  status: "processing" | "complete" | "pending";
}

const INITIAL_DISPLAY_LEVEL = 3;

const ChatPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Session Management
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Perfect mind map state
  const [perfectMindMapData, setPerfectMindMapData] =
    useState<PerfectMindMapData | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); // Holds File objects
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<ThinkingStep[]>([]); // For older AI service
  const [currentThinkingStreamData, setCurrentThinkingStreamData] = useState<
    ThinkingStreamData[]
  >([]);
  const [showMindMap, setShowMindMap] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [originalQuery, setOriginalQuery] = useState("");
  const [isAutonomousMode, setIsAutonomousMode] = useState(true);
  // normal | deep | simple chat
  const [mode, setMode] = useState<"normal" | "deep" | "simple">("normal");
  const [viewingThinkingForMessageId, setViewingThinkingForMessageId] =
    useState<string | null>(null);
  const [retrievedThinkingStream, setRetrievedThinkingStream] = useState<
    ThinkingStreamData[] | null
  >(null);

  const saveChatSession = () => {
    if (!currentSessionId || messages.length === 0) return;

    try {
      const now = new Date();

      // Ensure all messages have valid timestamps
      const messagesWithTimestamps = messages.map((msg) => ({
        ...msg,
        timestamp:
          typeof msg.timestamp === "string"
            ? new Date(msg.timestamp)
            : msg.timestamp,
      }));

      const sessionData: ChatSession = {
        id: currentSessionId,
        originalQuery,
        uploadedFileMetadata: uploadedFiles.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.file.size,
          extractedText: f.content || undefined,
          processingTimestamp: now,
        })),
        isAutonomousMode,
        mode,
        messages: messagesWithTimestamps,
        perfectMindMapData,
        createdAt: now, // This should be set only once when creating
        lastUpdated: now,
        mindMapSettings: {
          maxConversations: 30,
          topicThreshold: 0.7,
          layoutAlgorithm: "dagre",
          autoUpdateEnabled: true,
          cacheEnabled: true,
        },
      };

      chatSessionStorage.saveSession(sessionData);
      console.log(
        "ChatPage: Session saved to localStorage with",
        messagesWithTimestamps.length,
        "messages"
      );
    } catch (error) {
      console.error(
        "ChatPage: Error saving chat session to localStorage:",
        error
      );
      toast({
        title: "Session Save Error",
        description: "Could not save your chat session. Storage might be full.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Save session whenever key states change, but not on initial empty/loading states.
    if (messages.length > 0 && !isProcessing && currentSessionId) {
      console.log(
        "ChatPage: Auto-saving session with",
        messages.length,
        "messages"
      );
      saveChatSession();
    }
  }, [
    messages,
    originalQuery,
    uploadedFiles,
    isAutonomousMode,
    perfectMindMapData,
    currentSessionId, // Add this to ensure saving when session changes
  ]);

  useEffect(() => {
    // If we have navigation state from home page, ALWAYS create a new session
    if (location.state) {
      const {
        query,
        files,
        mode: navMode,
        deepResearch,
        autonomousMode: navAutonomousMode,
        sessionId: existingSessionId,
        loadExisting,
      } = location.state as any;

      // If we're explicitly loading an existing session (from sidebar)
      if (loadExisting && existingSessionId) {
        console.log("ChatPage: Loading existing session:", existingSessionId);
        const savedSession = chatSessionStorage.loadSession(existingSessionId);
        if (savedSession) {
          setCurrentSessionId(existingSessionId);
          setOriginalQuery(savedSession.originalQuery || "");
          setIsAutonomousMode(
            savedSession.isAutonomousMode === undefined
              ? true
              : savedSession.isAutonomousMode
          );
          setMode(savedSession.mode || "normal");

          // Sort messages chronologically when loading from localStorage
          const sortedMessages = savedSession.messages.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB; // Chronological order
          });
          setMessages(sortedMessages);

          // Load perfect mind map data if available
          if (savedSession.perfectMindMapData) {
            setPerfectMindMapData(savedSession.perfectMindMapData);
            console.log("ChatPage: Restored perfect mind map data");
          }

          // Set current session ID in localStorage for persistence
          chatSessionStorage.setCurrentSessionId(existingSessionId);

          toast({
            title: "Session Loaded",
            description: "Your chat session has been restored.",
          });
        }
        return;
      }

      // For new queries from home page, always create new session and process query
      console.log(
        "ChatPage: Navigation state present from home page, creating new session."
      );
      const newSessionId = chatSessionStorage.createNewSession();
      setCurrentSessionId(newSessionId);

      setOriginalQuery(query || "");
      setIsAutonomousMode(
        navAutonomousMode === undefined ? true : navAutonomousMode
      );
      setMode(navMode || (deepResearch ? "deep" : "normal"));

      // Files from navigation are now ProcessedFileInput[]
      const initialProcessedFilesFromNav: ProcessedFileInput[] = files || [];

      // Set local UploadedFiles state to empty as these are for in-chat uploads
      setUploadedFiles([]);

      handleInitialQuery(query, initialProcessedFilesFromNav, deepResearch);
    } else {
      // No navigation state - try to load existing session or create new one
      const existingSessionId = chatSessionStorage.getCurrentSessionId();
      if (existingSessionId) {
        const savedSession = chatSessionStorage.loadSession(existingSessionId);
        if (
          savedSession &&
          savedSession.messages &&
          savedSession.messages.length > 0
        ) {
          console.log(
            "ChatPage: Loading existing session from localStorage:",
            savedSession
          );
          setCurrentSessionId(existingSessionId);
          setOriginalQuery(savedSession.originalQuery || "");

          setIsAutonomousMode(
            savedSession.isAutonomousMode === undefined
              ? true
              : savedSession.isAutonomousMode
          );
          // Sort messages chronologically when loading from localStorage
          const sortedMessages = savedSession.messages.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB; // Chronological order
          });
          setMessages(sortedMessages);

          // Load perfect mind map data if available
          if (savedSession.perfectMindMapData) {
            setPerfectMindMapData(savedSession.perfectMindMapData);
            console.log("ChatPage: Restored perfect mind map data");
          }

          toast({
            title: "Session Restored",
            description: "Your previous chat session has been loaded.",
          });
        } else {
          // Create new session if no valid existing session
          const newSessionId = chatSessionStorage.createNewSession();
          setCurrentSessionId(newSessionId);
          setMode("normal");
        }
      } else {
        // Create new session
        const newSessionId = chatSessionStorage.createNewSession();
        setCurrentSessionId(newSessionId);
        setMode("normal");
      }
    }
  }, []); // Empty dependency array for mount only

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleInitialQuery = async (
    query: string,
    currentFiles: ProcessedFileInput[],
    deepResearch: boolean
  ) => {
    // Adapt filesForDisplay: ProcessedFileInput doesn't have f.file.size. Default size to 0 or omit.
    const filesForDisplay = currentFiles.map((f) => ({
      name: f.name,
      type: f.type || "unknown",
      size: 0,
    }));
    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: "user",
      content: query,
      files: filesForDisplay.length > 0 ? filesForDisplay : undefined,
      timestamp: new Date(),
    };

    // APPEND to existing messages instead of overwriting them
    setMessages((prev) => [...prev, userMessage]);

    // Save session to preserve the new message
    setTimeout(() => {
      saveChatSession();
    }, 100);

    if (mode === "simple") {
      await processSimpleChat(query);
    } else {
      await processResearchQuery(query, currentFiles, deepResearch); // Pass ProcessedFileInput[]
    }
  };

  const processResearchQuery = async (
    query: string,
    currentFiles: ProcessedFileInput[],
    deepResearch: boolean
  ) => {
    setIsProcessing(true);
    setStreamingContent("");
    setCurrentThinking([]);
    setCurrentThinkingStreamData([]);

    try {
      // const fileObjects: File[] = currentFiles.map(f => f.file).filter(Boolean); // This line is no longer needed as currentFiles are ProcessedFileInput[]
      const researchMode = deepResearch ? "Deep" : "Normal";

      if (isAutonomousMode) {
        // Use a local variable to store thinking data to avoid race conditions with state
        let accumulatedThinkingData: ThinkingStreamData[] = [];

        // Pass currentFiles (ProcessedFileInput[]) directly to conductResearch
        await autonomousResearchAgent.conductResearch(
          query,
          currentFiles,
          researchMode,
          {
            onThinkingData: (streamData) => {
              // Store in both state for UI and local variable for persistence
              accumulatedThinkingData.push(streamData);
              setCurrentThinkingStreamData((prev) => [...prev, streamData]);
            },
            onFinalAnswer: async (report) => {
              const aiMessageId = uuidv4();

              // Wait a bit to ensure all thinking data has been processed
              await new Promise((resolve) => setTimeout(resolve, 200));

              // Use the accumulated data instead of state to avoid race conditions
              const thinkingForStorage = [...accumulatedThinkingData];

              console.log(
                "ChatPage: Final answer received with thinking data:",
                thinkingForStorage.length,
                "items for message:",
                aiMessageId
              );

              const aiMessage: ChatMessage = {
                id: aiMessageId,
                type: "ai",
                content: report.content,
                thinkingStreamData: thinkingForStorage, // Store the captured stream with message
                sources: report.sources,
                timestamp: new Date(),
                isAutonomous: true,
              };
              setMessages((prev) => [...prev, aiMessage]);

              // Save thinking process immediately and ensure it's attached to message
              if (thinkingForStorage.length > 0) {
                console.log(
                  "ChatPage: Saving thinking process for autonomous message ID:",
                  aiMessageId,
                  "Data points:",
                  thinkingForStorage.length
                );
                chatSessionStorage.saveThinkingProcess(
                  aiMessageId,
                  thinkingForStorage
                );
              } else {
                console.log(
                  "ChatPage: No thinking data to save for message:",
                  aiMessageId
                );
              }

              // Force session save immediately after message creation
              setTimeout(() => {
                saveChatSession();
              }, 100);

              setCurrentThinkingStreamData([]);
              setIsProcessing(false);
              setStreamingContent("");
            },
            onError: (error) => {
              /* ... */ setIsProcessing(false);
            },
          }
        );
      } else {
        // Non-autonomous (AIService)
        // Use a local variable to store thinking data to avoid race conditions with state
        let accumulatedThinkingDataAI: ThinkingStreamData[] = [];

        const aiCallbacks: AIServiceCallbacks = {
          onThinkingUpdate: (data) => {
            // Store in both state for UI and local variable for persistence
            accumulatedThinkingDataAI.push(data);
            setCurrentThinkingStreamData((prev) => [...prev, data]);
          },
          onProgress: (stage, progress) =>
            console.log(`Research progress: ${stage} (${progress}%)`),
          onError: (error) => {
            /* ... */ setIsProcessing(false);
            setStreamingContent("");
          },
          onComplete: (response) => {
            const aiMessageId = uuidv4();
            const thinkingForStorage = [
              ...accumulatedThinkingDataAI,
              ...(response.thinkingProcess || []),
            ]; // Combine if any stream before structured
            const aiMessage: ChatMessage = {
              id: aiMessageId,
              type: "ai",
              content: response.finalReport.content,
              thinkingStreamData: thinkingForStorage,
              sources: response.finalReport.sources,
              timestamp: new Date(),
              isAutonomous: false,
            };
            setMessages((prev) => [...prev, aiMessage]);

            // Save thinking process immediately
            if (thinkingForStorage.length > 0) {
              console.log(
                "ChatPage: Saving thinking process for AIService message ID:",
                aiMessageId,
                "Data points:",
                thinkingForStorage.length
              );
              chatSessionStorage.saveThinkingProcess(
                aiMessageId,
                thinkingForStorage
              );

              // Force save session to ensure persistence
              setTimeout(() => {
                if (currentSessionId) {
                  console.log(
                    "ChatPage: Force saving session after thinking data save"
                  );
                  saveChatSession();
                }
              }, 500);
            }
            setCurrentThinking([]);
            setCurrentThinkingStreamData([]);
            setIsProcessing(false);
            setStreamingContent("");
          },
        };
        // If aiService.processResearch is used with files, it would need refactoring
        // to handle ProcessedFileInput[] or a different way to get File objects if essential.
        // For now, focusing on autonomousResearchAgent path.
        await aiService.processResearch(
          { query, files: [], researchMode },
          aiCallbacks
        ); // Passing empty array for files to aiService for now
      }
    } catch (error: any) {
      /* ... */ setIsProcessing(false);
      setStreamingContent("");
    }
  };

  const processSimpleChat = async (query: string) => {
    setIsProcessing(true);
    try {
      const history: SimpleChatMessage[] = [
        ...messages.map((m) => ({
          role: m.type === "user" ? "user" : "assistant",
          content: m.content,
        })),
        { role: "user", content: query },
      ];
      const reply = await simpleChatService.sendMessage(history);
      const aiMessage: ChatMessage = {
        id: uuidv4(),
        type: "ai",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsProcessing(false);
    } catch (error) {
      console.error("Simple chat error:", error);
      toast({
        title: "Chat Error",
        description: "Failed to get response from Gemini.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && uploadedFiles.length === 0) return;
    const currentQuery = newMessage; // Capture before reset
    const currentFiles = [...uploadedFiles]; // Capture before reset

    const filesForDisplay = currentFiles.map((f) => ({
      name: f.name,
      type: f.type || "unknown",
      size: f.file.size,
    }));
    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: "user",
      content: currentQuery,
      files: filesForDisplay.length > 0 ? filesForDisplay : undefined,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");
    setUploadedFiles([]);
    setIsProcessing(true);
    // For follow-ups, originalQuery might be the very first query of the session or this new one.
    // If chat is continuous, originalQuery should persist from the first message.
    // If each follow-up should be "new" for mind map context, then update it:
    // setOriginalQuery(currentQuery);

    try {
      if (mode === "simple") {
        await processSimpleChat(currentQuery);
        return;
      }
      const lastAiMessage = messages.filter((m) => m.type === "ai").pop();
      if (lastAiMessage && !isAutonomousMode) {
        // Only use AIService follow-up if not in autonomous mode
        const contextReport: FinalReport = {
          content: lastAiMessage.content,
          sources: lastAiMessage.sources || [],
          wordCount: lastAiMessage.content.split(" ").length, // Approximate
        };
        const followUpCallbacks: AIServiceCallbacks = {
          // Use a local variable to store thinking data to avoid race conditions with state
          onThinkingUpdate: (() => {
            let accumulatedThinkingDataFollowUp: ThinkingStreamData[] = [];
            return (data: ThinkingStreamData) => {
              // Store in both state for UI and local variable for persistence
              accumulatedThinkingDataFollowUp.push(data);
              setCurrentThinkingStreamData((prev) => [...prev, data]);

              // Store in closure for later access
              (followUpCallbacks as any)._accumulatedData =
                accumulatedThinkingDataFollowUp;
            };
          })(),
          onProgress: (stage, progress) =>
            console.log(`Follow-up progress: ${stage} (${progress}%)`),
          onError: (error) => {
            /* ... */ setIsProcessing(false);
          },
          onComplete: (response) => {
            const aiMessageId = uuidv4();
            // Get accumulated data from closure
            const accumulatedData =
              (followUpCallbacks as any)._accumulatedData || [];
            const thinkingForStorage = [
              ...accumulatedData,
              ...(response.thinkingProcess || []),
            ];
            const aiMessage: ChatMessage = {
              id: aiMessageId,
              type: "ai",
              content: response.finalReport.content,
              thinkingStreamData: thinkingForStorage,
              sources: response.finalReport.sources,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            // Note: Mind map generation removed - now manual via UI button

            if (thinkingForStorage.length > 0) {
              console.log(
                "ChatPage: Saving thinking process for follow-up message ID:",
                aiMessageId,
                "Data points:",
                thinkingForStorage.length
              );
              chatSessionStorage.saveThinkingProcess(
                aiMessageId,
                thinkingForStorage
              );

              // Force save session to ensure persistence
              setTimeout(() => {
                saveChatSession();
              }, 100);
            }
            setCurrentThinking([]);
            setCurrentThinkingStreamData([]);
            setIsProcessing(false);
          },
        };
        await aiService.processFollowUp(
          currentQuery,
          contextReport,
          followUpCallbacks
        );
      } else {
        // If autonomous or no prior AI message, treat as a new research query
        // Convert current files (UploadedFile[]) to ProcessedFileInput[] for the service
        const processedFilesForResearch: ProcessedFileInput[] =
          currentFiles.map((uf) => ({
            name: uf.name,
            content: uf.content,
            type: uf.type,
          }));

        // Call processResearchQuery directly without adding another user message
        await processResearchQuery(
          currentQuery,
          processedFilesForResearch,
          false
        );
      }
    } catch (error: any) {
      /* ... */ setIsProcessing(false);
    }
  };

  // Session Management Functions
  const handleSessionSelect = (sessionId: string) => {
    try {
      const session = chatSessionStorage.loadSession(sessionId);
      if (session) {
        setCurrentSessionId(sessionId);
        // Sort messages chronologically when loading
        const sortedMessages = session.messages.sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB; // Chronological order
        });
        setMessages(sortedMessages);
        setOriginalQuery(session.originalQuery);
        setIsAutonomousMode(session.isAutonomousMode);
        setMode(session.mode || "normal");
        setPerfectMindMapData(session.perfectMindMapData || null);

        // Reset other states
        setUploadedFiles([]);
        setCurrentThinking([]);
        setCurrentThinkingStreamData([]);
        setStreamingContent("");
        setIsProcessing(false);
        setShowMindMap(false);

        // Set current session ID in localStorage for persistence
        chatSessionStorage.setCurrentSessionId(sessionId);

        toast({
          title: "Session Loaded",
          description: "Your chat session has been restored with all data.",
        });
      }
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Session Load Error",
        description: "Could not load the selected session",
        variant: "destructive",
      });
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleNewChat = () => {
    // Clear current session data
    if (currentSessionId) {
      // The session is already saved, just need to clear local state
      messages.forEach((msg) => {
        if (msg.type === "ai") {
          // Don't remove thinking processes as they're stored with the session
        }
      });
    }

    // Create new session
    const newSessionId = chatSessionStorage.createNewSession();
    setCurrentSessionId(newSessionId);
    setMode("normal");

    // Reset all state
    setMessages([]);
    setOriginalQuery("");
    setUploadedFiles([]);
    setPerfectMindMapData(null);
    setCurrentThinking([]);
    setCurrentThinkingStreamData([]);
    setStreamingContent("");
    setIsProcessing(false);
    setShowMindMap(false);

    toast({
      title: "New Chat Started",
      description: "Previous session saved and new session created.",
    });
  };

  // File upload handler for ChatInput (simplified as it doesn't auto-process here)
  const handleChatFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);

    // Check file limit
    if (uploadedFiles.length + fileArray.length > 2) {
      toast({
        title: "File Limit Exceeded",
        description: "You can only upload up to 2 files in chat.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate file types using the real service
      const unsupportedFiles = fileArray.filter(
        (file) => !fileProcessingService.isFileTypeSupported(file)
      );
      if (unsupportedFiles.length > 0) {
        toast({
          title: "Invalid File Type",
          description: `${unsupportedFiles
            .map((f) => f.name)
            .join(
              ", "
            )} are not supported. Please upload PDF, DOCX, DOC, or TXT files.`,
          variant: "destructive",
        });
        return;
      }

      // Show processing toast
      toast({
        title: "Processing Files",
        description: `Processing ${fileArray.length} file(s)...`,
      });

      // Process files using the fileProcessingService
      const processedFiles = await Promise.all(
        fileArray.map(async (file) => {
          try {
            const result = await fileProcessingService.processFile(file);
            if (!result.success) {
              throw new Error(result.error || "Failed to process file");
            }
            return {
              id: uuidv4(),
              name: file.name,
              content: result.content,
              type: file.type,
              file: file,
              processed: true,
              wordCount: result.metadata.wordCount,
            };
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            toast({
              title: "File Processing Error",
              description: `Failed to process ${file.name}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
              variant: "destructive",
            });
            throw error;
          }
        })
      );

      // Add processed files to state
      setUploadedFiles((prev) => [...prev, ...processedFiles]);

      // Success toast
      toast({
        title: "Files Uploaded Successfully",
        description: `${processedFiles.length} file(s) processed and ready to use.`,
      });

      // Clear the input
      event.target.value = "";
    } catch (error) {
      console.error("File upload error:", error);
      // Error toast is already shown in the processing loop
    }
  };

  const closeThinkingProcessDialog = () => {
    setViewingThinkingForMessageId(null);
    setRetrievedThinkingStream(null);
  };

  const loadThinkingData = (messageId: string): ThinkingStreamData[] | null => {
    return chatSessionStorage.loadThinkingProcess(messageId);
  };

  const hasThinkingData = (messageId: string): boolean => {
    return chatSessionStorage.hasThinkingProcess(messageId);
  };

  const handleViewThinking = (messageId: string) => {
    const thinkingData = chatSessionStorage.loadThinkingProcess(messageId);
    if (thinkingData) {
      setRetrievedThinkingStream(thinkingData);
      setViewingThinkingForMessageId(messageId);
    } else {
      toast({
        title: "No Thinking Data",
        description: "No thinking process found for this message",
        variant: "destructive",
      });
    }
  };

  const generateAndShowMindMap = async () => {
    if (!currentSessionId) return;

    if (perfectMindMapData) {
      setShowMindMap(true);
      return;
    }

    const lastAiMessage = messages.filter((m) => m.type === "ai").pop();
    if (!lastAiMessage) {
      toast({
        title: "No Content Available",
        description: "No AI response available to generate mind map from.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);

      console.log(
        "ChatPage: Generating perfect mind map with dynamic layers..."
      );

      // Use the perfect mind map service (now includes dynamic layers)
      const mindMapData = await perfectMindMapService.generatePerfectMindMap(
        messages,
        currentSessionId,
        uploadedFiles,
        originalQuery || "Research Query"
      );

      if (mindMapData) {
        setPerfectMindMapData(mindMapData);

        // Save to session
        chatSessionStorage.savePerfectMindMapData(
          currentSessionId,
          mindMapData
        );

        setShowMindMap(true);

        toast({
          title: "Perfect Mind Map Generated",
          description: `Mind map created with ${mindMapData.nodes.length} nodes and ${mindMapData.metadata.totalLayers} layers.`,
        });
      } else {
        throw new Error("Failed to generate dynamic mind map");
      }
    } catch (error) {
      console.error("Mind map generation error:", error);
      toast({
        title: "Generation Failed",
        description: "Could not generate mind map. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Perfect Mind Map interaction handlers
  const handlePerfectMindMapNodeClick = (nodeId: string, nodeType: string) => {
    console.log("Perfect mind map node clicked:", nodeId, nodeType);
    // Handle node interactions based on the perfect mind map structure
    // The PerfectMindMap component will handle its own interactions
  };

  const regeneratePerfectMindMap = async () => {
    if (!currentSessionId) return;

    const lastAiMessage = messages.filter((m) => m.type === "ai").pop();
    if (!lastAiMessage) return;

    try {
      setIsProcessing(true);
      setPerfectMindMapData(null);

      console.log(
        "ChatPage: Regenerating perfect mind map with dynamic layers..."
      );

      // Use the perfect mind map service for regeneration
      const mindMapData = await perfectMindMapService.generatePerfectMindMap(
        messages,
        currentSessionId,
        uploadedFiles,
        originalQuery || "Research Query"
      );

      if (mindMapData) {
        setPerfectMindMapData(mindMapData);

        // Save to session
        chatSessionStorage.savePerfectMindMapData(
          currentSessionId,
          mindMapData
        );

        toast({
          title: "Perfect Mind Map Regenerated",
          description: `Mind map recreated with ${mindMapData.nodes.length} nodes and fresh insights.`,
        });
      }
    } catch (error) {
      console.error("Mind map regeneration error:", error);
      toast({
        title: "Regeneration Failed",
        description: "Could not regenerate mind map.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  // Existing functions: handleViewThinking, handleNodeExpand, handleNodeReveal, processResearchQuery, etc.
  // These should largely remain the same, but ensure they use the state variables correctly.

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        currentSessionId={currentSessionId || undefined}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />

      <div className="sticky top-0 z-40 bg-slate-800/40 border-b border-slate-700/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleSidebar}
              className="text-slate-300 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1
              className="text-3xl font-extralight bg-gradient-to-r from-red-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigate("/")}
            >
              Novah
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {messages.some((m) => m.type === "ai") && !showMindMap && (
              <Button
                onClick={generateAndShowMindMap}
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white"
                disabled={isProcessing}
                size="sm"
              >
                <Map className="h-4 w-4 mr-2" />
                {perfectMindMapData ? "View Mind Map" : "Generate Mind Map"}
              </Button>
            )}
            {showMindMap && (
              <Button
                variant="outline"
                onClick={() => setShowMindMap(false)}
                className="bg-slate-700/30 border border-slate-600/50 text-white hover:bg-slate-700/50"
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Hide Map
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Rest of the JSX (Chat container, MindMap container, Dialog) remains similar */}
      <div className="flex h-[calc(100vh-80px)] relative">
        <div
          className={`chat-container ${
            showMindMap ? "w-1/2" : "w-full"
          } flex flex-col`}
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={{
                    ...message,
                    timestamp:
                      typeof message.timestamp === "string"
                        ? new Date(message.timestamp)
                        : message.timestamp,
                  }}
                  onViewThinking={handleViewThinking}
                  hasThinkingData={hasThinkingData}
                  loadThinkingData={loadThinkingData}
                />
              ))}
              {isProcessing &&
                messages.length > 0 &&
                messages[messages.length - 1].type === "user" && (
                  <div className="flex justify-start">
                    <div className="max-w-3xl">
                      {isAutonomousMode ? (
                        <AutonomousThinkingProcess
                          streamData={currentThinkingStreamData}
                          isAutonomous={true}
                          isVisible={true}
                        />
                      ) : (
                        <div className="bg-slate-800/50 text-white border border-slate-700/50 backdrop-blur-sm rounded-lg p-4">
                          <p className="text-slate-300">
                            Processing your request...
                          </p>
                        </div>
                      )}
                      {/* Removed streamingContent display here as it's part of AI message bubble now or handled internally */}
                    </div>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <ChatInput
            message={newMessage}
            onMessageChange={setNewMessage}
          onSendMessage={handleSendMessage}
          onFileUpload={handleChatFileUpload} // Use specific handler for ChatInput uploads
          uploadedFiles={uploadedFiles}
          onRemoveFile={(id) =>
            setUploadedFiles((prev) => prev.filter((f) => f.id !== id))
          }
          isProcessing={isProcessing}
          disableFileUpload={mode === "simple"}
        />
        </div>

        {showMindMap && perfectMindMapData && (
          <div className="mind-map-container w-1/2 border-l border-slate-700/50">
            <div className="h-full flex flex-col bg-slate-800/50">
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="text-white font-medium">Research Mind Map</h3>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={regeneratePerfectMindMap}
                    disabled={isProcessing}
                    className="text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Regenerate"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMindMap(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1">
                <PerfectMindMap
                  messages={messages}
                  uploadedFiles={uploadedFiles}
                  sessionId={currentSessionId || ""}
                  originalQuery={originalQuery}
                  onMindMapGenerated={(data) => setPerfectMindMapData(data)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={viewingThinkingForMessageId !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeThinkingProcessDialog();
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Retrieved AI Thinking Process</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 rounded-md bg-slate-850 custom-scrollbar">
            {retrievedThinkingStream && retrievedThinkingStream.length > 0 ? (
              // Assuming AutonomousThinkingProcess can also display stored ThinkingStreamData[]
              <AutonomousThinkingProcess
                streamData={retrievedThinkingStream}
                isAutonomous={true}
                isVisible={true}
              />
            ) : (
              <p>No thinking process data to display or data is empty.</p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={closeThinkingProcessDialog}
              className="border-slate-600 hover:border-slate-500"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
// Helper function to generate unique IDs, if not already available
const uuidv4 = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default ChatPage;
