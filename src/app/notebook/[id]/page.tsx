"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Share,
  Lock,
  Plus,
  Search,
  FileText,
  Bookmark,
  Send,
  Mic,
  HelpCircle,
  BookOpen,
  FileBarChart,
  ChevronRight,
  Upload,
  Sparkles,
  FileAudio,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { storage, type NotebookData, type ChatMessage } from "@/lib/storage";
import { formatFileSize, getFileTypeDisplayName } from "@/lib/file-processor";
import { generateChatResponse, generateAudioOverview, isGeminiConfigured } from "@/lib/gemini-ai";
import { ThemeToggle } from "@/components/theme-toggle";

export default function NotebookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [notebook, setNotebook] = useState<NotebookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioOverview, setAudioOverview] = useState<string>("");

  useEffect(() => {
    loadNotebook();
    loadChat();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadNotebook = async () => {
    try {
      const notebookData = await storage.getNotebook(id);
      if (notebookData) {
        setNotebook(notebookData);
        // Load files for this notebook
        const files = await storage.getFilesByNotebook(id);
        notebookData.sources = files;
        setSelectedSources(files.map(f => f.id));
      }
    } catch (error) {
      console.error('Error loading notebook:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChat = async () => {
    try {
      const chatMessages = await storage.getChat(id);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!query.trim() || !notebook) return;

    const userMessage = query.trim();
    setQuery("");
    setIsGeneratingResponse(true);

    try {
      // Add user message
      const newUserMessage = await storage.addChatMessage(id, {
        content: userMessage,
        isUser: true,
        sources: selectedSources,
      });

      setMessages(prev => [...prev, newUserMessage]);

      // Generate real AI response
      const selectedSourceFiles = notebook.sources
        .filter(s => selectedSources.includes(s.id))
        .map(s => ({
          name: s.name,
          content: s.content,
          summary: s.summary?.summary
        }));
      const chatHistory = messages.slice(-6).map(msg => ({
        role: msg.isUser ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const aiResponse = await generateChatResponse(userMessage, selectedSourceFiles, chatHistory);
      const newAiMessage = await storage.addChatMessage(id, {
        content: aiResponse.content,
        isUser: false,
        sources: aiResponse.sources,
      });

      setMessages(prev => [...prev, newAiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  const generateMockResponse = (userQuery: string, notebook: NotebookData): string => {
    const sources = notebook.sources.map(s => s.name).join(', ');
    const responses = [
      `${sources} 문서를 기반으로 답변드리겠습니다. "${userQuery}"에 대한 정보를 찾아보니...`,
      `업로드하신 ${notebook.sources.length}개 문서에서 관련 내용을 분석한 결과입니다.`,
      `문서의 내용을 종합해보면, 귀하의 질문과 관련하여 다음과 같은 정보를 찾을 수 있습니다.`,
    ];

    return responses[Math.floor(Math.random() * responses.length)] + "\n\n" +
           "이는 업로드된 문서의 내용을 바탕으로 한 분석 결과입니다. 더 자세한 정보가 필요하시면 구체적인 질문을 해주세요.";
  };

  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGenerateAudioOverview = async () => {
    if (!notebook || isGeneratingAudio) return;

    setIsGeneratingAudio(true);
    try {
      const sourcesWithSummary = notebook.sources
        .filter(s => s.summary)
        .map(s => ({
          name: s.name,
          content: s.content,
          summary: s.summary!.summary
        }));
      if (sourcesWithSummary.length === 0) {
        alert('AI 요약이 있는 소스가 없습니다. 파일을 다시 업로드하여 요약을 생성해주세요.');
        return;
      }

      const overview = await generateAudioOverview(sourcesWithSummary);
      setAudioOverview(overview);
    } catch (error) {
      console.error('오디오 오버뷰 생성 오류:', error);
      alert('오디오 오버뷰 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">노트북을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-900 mb-2">노트북을 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-6">요청하신 노트북이 존재하지 않거나 삭제되었습니다.</p>
          <Link href="/">
            <Button>메인 페이지로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-none px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-sm" />
                </div>
                <span className="text-xl font-medium text-gray-900">NotebookLM</span>
              </Link>
              <span className="text-xl font-medium text-gray-900">{notebook.title}</span>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Button variant="ghost" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                애널리틱스
              </Button>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                New! 공개로로 공유하기
              </Badge>
              <Button variant="ghost" size="sm">
                <Share className="h-4 w-4" />
                공유
              </Button>
              <Button variant="ghost" size="sm">
                <Lock className="h-4 w-4" />
                공유
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
                설정
              </Button>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                PRO
              </Badge>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-green-600 text-white text-sm">J</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Sources */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">출처</h3>
              <Button variant="ghost" size="sm" className="text-blue-600">
                <Plus className="h-4 w-4 mr-1" />
                추가
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="탐색"
                className="pl-10"
              />
            </div>
          </div>

          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={selectedSources.length === notebook.sources.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSources(notebook.sources.map(s => s.id));
                  } else {
                    setSelectedSources([]);
                  }
                }}
              />
              <span>모든 소스 선택</span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {notebook.sources.map((source) => (
                <div key={source.id} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => toggleSourceSelection(source.id)}
                  />
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{source.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(source.size)}
                      {source.summary && (
                        <span className="ml-2 text-blue-600">• AI 요약 완료</span>
                      )}
                    </p>
                    {source.summary && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-1">{source.summary.summary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl">
              <h1 className="text-3xl font-medium text-gray-900 mb-2">
                {notebook.title}
              </h1>
              {notebook.description && (
                <p className="text-gray-600 mb-6">{notebook.description}</p>
              )}
              <p className="text-sm text-gray-500 mb-8">소스 {notebook.sources.length}개</p>

              {/* Chat Messages */}
              <div className="space-y-6 mb-8">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-3xl p-4 rounded-lg ${
                      message.isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200'
                    }`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.sources && message.sources.length > 0 && !message.isUser && (
                        <div className="mt-2 text-xs text-gray-500">
                          참조한 소스: {message.sources.length}개
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isGeneratingResponse && (
                  <div className="flex justify-start">
                    <div className="max-w-3xl p-4 rounded-lg bg-white border border-gray-200">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-gray-600">응답을 생성하고 있습니다...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4 mb-6">
                <Button variant="outline" className="flex items-center space-x-2">
                  <Bookmark className="h-4 w-4" />
                  <span>메모 추가</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={handleGenerateAudioOverview}
                  disabled={isGeneratingAudio || !isGeminiConfigured()}
                >
                  <FileAudio className="h-4 w-4" />
                  <span>AI 오디오 오버뷰</span>
                  {!isGeminiConfigured() && (
                    <span className="text-xs text-gray-500">(API 키 필요)</span>
                  )}
                </Button>
                <Button variant="outline" className="flex items-center space-x-2">
                  <FileBarChart className="h-4 w-4" />
                  <span>마인드맵</span>
                </Button>
              </div>

              {!isGeminiConfigured() && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm text-yellow-800">
                      <strong>AI 기능 사용 안내:</strong> 실제 AI 요약 및 채팅 기능을 사용하려면
                      <code className="mx-1 px-1 bg-yellow-200 rounded">.env</code> 파일에
                      <code className="mx-1 px-1 bg-yellow-200 rounded">NEXT_PUBLIC_GEMINI_API_KEY</code>를 설정해주세요.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="max-w-4xl">
              <div className="relative">
                <Textarea
                  placeholder="입력을 시작하세요..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pr-16 resize-none"
                  rows={3}
                />
                <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                  <span className="text-xs text-gray-400">
                    소스 {selectedSources.length}개
                  </span>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleSendMessage}
                    disabled={!query.trim() || isGeneratingResponse}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                NotebookLM이 무정확한 정보를 표시할 수 있으므로 다시 한번 확인하세요.
              </p>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Studio */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-medium text-gray-900 mb-4">스튜디오</h3>
          </div>

          <div className="flex-1 p-4">
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mic className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-medium">AI 오디오 오버뷰</CardTitle>
                    <p className="text-xs text-gray-500">더 많은 인사이트 AI 오디오 오버뷰를 만드세용자에게 볼어보세</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">심층 분석 대화</div>
                  <p className="text-xs text-gray-600 mb-3">소스 {notebook.sources.length}개</p>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      맞춤설정
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleGenerateAudioOverview}
                      disabled={isGeneratingAudio || !isGeminiConfigured()}
                    >
                      {isGeneratingAudio ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" />생성 중...</>
                      ) : (
                        '생성'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {audioOverview && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <FileAudio className="h-4 w-4 mr-2" />
                    AI 오디오 오버뷰
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="max-h-40 overflow-y-auto">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{audioOverview}</pre>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Download className="h-3 w-3 mr-1" />
                      다운로드
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <Sparkles className="h-3 w-3 mr-1" />
                      재생성
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">노트</h4>

              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  메모 추가
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="flex-1 justify-start">
                    <BookOpen className="h-4 w-4 mr-2" />
                    학습 가이드
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="flex-1 justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    브리핑 문서
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="flex-1 justify-start">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    FAQ
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" className="flex-1 justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    타임라인
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
