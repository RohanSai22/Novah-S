import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Upload, ArrowRight, Sparkles, Menu } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SuggestionCards from "@/components/home/SuggestionCards";
import FileUploadArea from "@/components/home/FileUploadArea";
import { ChatSidebar } from "@/components/ui/ChatSidebar";
import { fileProcessingService } from "@/services/fileProcessingService";
import { chatSessionStorage } from "@/services/chatSessionStorage";

interface UploadedFile {
  id: string;
  name: string;
  content: string;
  type: string;
  file: File;
  processed?: boolean;
  wordCount?: number;
  error?: string;
}

const HomePage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"normal" | "deep" | "simple">("normal");
  const [autonomousMode] = useState(true); // Always use autonomous mode
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Session Management Functions
  const handleSessionSelect = (sessionId: string) => {
    try {
      const session = chatSessionStorage.loadSession(sessionId);
      if (session) {
        navigate("/chat", {
          state: {
            sessionId,
            loadExisting: true,
          },
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

  const handleNewChat = () => {
    const newSessionId = chatSessionStorage.createNewSession();
    navigate("/chat");
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    console.log("File input changed, processing files..."); // Added console log
    const files = event.target.files;
    if (!files) return;

    if (uploadedFiles.length + files.length > 2) {
      toast({
        title: "File Limit Exceeded",
        description: "You can only upload up to 2 files.",
        variant: "destructive",
      });
      return;
    }

    try {
      const fileArray = Array.from(files);

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

      // Process files using the real file processing service
      const processedFiles = await fileProcessingService.processFiles(
        fileArray
      );

      // Convert to UploadedFile format for UI
      const newUploadedFiles: UploadedFile[] = processedFiles.map((pFile) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: pFile.metadata.fileName,
        content: pFile.content,
        type: pFile.metadata.fileType,
        file: fileArray.find((f) => f.name === pFile.metadata.fileName)!,
        processed: pFile.success,
        wordCount: pFile.metadata.wordCount,
        error: pFile.error,
      }));

      setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);

      // Show success/error notifications
      const successfulFiles = processedFiles.filter((f) => f.success);
      const failedFiles = processedFiles.filter((f) => !f.success);

      if (successfulFiles.length > 0) {
        toast({
          title: "Files Processed",
          description: `Successfully processed ${
            successfulFiles.length
          } file(s). Total words: ${successfulFiles.reduce(
            (sum, f) => sum + f.metadata.wordCount,
            0
          )}`,
        });
      }

      if (failedFiles.length > 0) {
        toast({
          title: "Processing Errors",
          description: `Failed to process ${failedFiles.length} file(s). Check file formats.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload Error",
        description: "Failed to process uploaded files. Please try again.",
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const handleSubmit = async () => {
    if (!query.trim()) {
      toast({
        title: "Query Required",
        description: "Please enter a research query.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const processedFilesForChat = uploadedFiles
      .filter(
        (uf) =>
          uf.processed &&
          uf.content &&
          uf.content.trim().length > 0 &&
          !uf.error
      )
      .map((uf) => ({
        name: uf.name,
        content: uf.content,
        type: uf.type,
      }));

    navigate("/chat", {
      state: {
        query,
        files: processedFilesForChat, // Pass the new array
        mode,
        autonomousMode,
      },
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        currentSessionId={undefined}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />

      {/* Animated background particles */}
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${4 + Math.random() * 6}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header with sidebar toggle */}
        <div className="flex items-center justify-between p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSidebar}
            className="text-slate-300 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div></div> {/* Spacer for centered content */}
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-6xl space-y-16">
            {/* Hero Section */}
            <div className="text-center space-y-8">
              <div className="relative">
                <h1 className="text-7xl md:text-8xl font-extralight bg-gradient-to-r from-red-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent animate-glow mb-6">
                  Novah
                </h1>
                <p className="text-xl md:text-2xl text-slate-300 mb-8 font-light">
                  Advanced AI Research Assistant
                </p>
              </div>
            </div>

            {/* Main Input Card */}
            <Card className="bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm p-8 shadow-2xl max-w-4xl mx-auto">
              <div className="space-y-6">
                <div className="relative">
                  <Textarea
                    placeholder="Enter your research query..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-h-32 bg-slate-700/30 border-2 border-slate-600/50 text-white placeholder-slate-400 text-lg resize-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 rounded-xl backdrop-blur-sm"
                    maxLength={1000}
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-slate-500">
                    {query.length}/1000
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-6">
                  <div className="flex items-center space-x-8">
                    <div className="flex items-center space-x-3">
                      <Select
                        value={mode}
                        onValueChange={(val) => setMode(val as "normal" | "deep" | "simple")}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal Research</SelectItem>
                          <SelectItem value="deep">Deep Research</SelectItem>
                          <SelectItem value="simple">Simple Chat</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex flex-col">
                        <span className="text-white font-medium">
                          {mode === "deep"
                            ? "Deep Research"
                            : mode === "normal"
                            ? "Normal Research"
                            : "Simple Chat"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {mode === "deep"
                            ? "800 words, 120-140+ sources"
                            : mode === "normal"
                            ? "400 words, 20-30 sources"
                            : "Chat with Gemini"}
                        </span>
                      </div>
                    </div>
                    {/* Removed wrapping label, Button now handles click */}
                    <input
                      type="file"
                      id="fileUploadInput" // id can be kept or removed, ref is primary
                      ref={fileInputRef} // Assigned ref
                      multiple
                      accept=".txt,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log(
                          "HomePage: Upload Files button clicked, attempting to trigger file input."
                        );
                        fileInputRef.current?.click();
                      }} // Added console.log
                      className="bg-slate-700/30 border-2 border-slate-600/50 text-white hover:bg-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 group-hover:scale-105"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </Button>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-cyan-500/25 transform hover:scale-105 transition-all duration-300"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Processing...
                      </div>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Start Research
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Uploaded Files */}
            <FileUploadArea
              uploadedFiles={uploadedFiles}
              onFilesChange={setUploadedFiles}
            />

            {/* Suggestion Cards */}
            <SuggestionCards onQuerySelect={setQuery} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
