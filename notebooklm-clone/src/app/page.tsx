"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings, Grid, List, Plus, MoreHorizontal, FileText, Scale, AlertCircle, Users, Book } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { SourceUploadModal } from "@/components/source-upload-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { ElectronFeatures } from "@/components/electron-features";
import { storage, type NotebookData } from "@/lib/storage";
import { formatFileSize } from "@/lib/file-processor";

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [notebooks, setNotebooks] = useState<NotebookData[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notebooks on component mount
  useEffect(() => {
    loadNotebooks();
  }, []);

  const loadNotebooks = async () => {
    try {
      const allNotebooks = await storage.getAllNotebooks();
      setNotebooks(allNotebooks);
    } catch (error) {
      console.error('Error loading notebooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotebookCreated = (notebook: NotebookData) => {
    setNotebooks(prev => [notebook, ...prev]);
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    if (confirm('이 노트북을 삭제하시겠습니까?')) {
      try {
        await storage.deleteNotebook(notebookId);
        setNotebooks(prev => prev.filter(nb => nb.id !== notebookId));
      } catch (error) {
        console.error('Error deleting notebook:', error);
        alert('노트북 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const getNotebookIcon = (notebook: NotebookData) => {
    // Determine icon based on file types in the notebook
    const hasDocuments = notebook.sources.some(s =>
      s.name.toLowerCase().includes('.pdf') ||
      s.name.toLowerCase().includes('.docx') ||
      s.name.toLowerCase().includes('.hwpx')
    );

    if (hasDocuments) {
      return <FileText className="h-8 w-8 text-orange-600" />;
    }

    return <Book className="h-8 w-8 text-blue-600" />;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return '오늘';
    } else if (diffDays <= 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-sm" />
                </div>
                <h1 className="text-xl font-medium text-gray-900">NotebookLM</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
                설정
              </Button>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                PRO
              </Badge>
              <Button variant="ghost" size="sm">
                <Grid className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-green-600 text-white text-sm">J</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-4xl font-normal text-gray-900 dark:text-gray-100 mb-8 text-center">
            NotebookLM에 오신 것을 환영합니다
          </h2>

          <ElectronFeatures
            onNewNotebook={() => setShowUploadModal(true)}
            onOpenFiles={(filePaths) => {
              console.log('Files dropped:', filePaths);
              // TODO: Handle file drops
              setShowUploadModal(true);
            }}
            onExport={() => {
              console.log('Export requested');
              // TODO: Handle export
            }}
          />

          <div className="flex items-center justify-between mb-6">
            <Button
              className="bg-black hover:bg-gray-800 text-white rounded-full px-6"
              onClick={() => setShowUploadModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              새로 만들기
            </Button>

            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8 p-0"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    최신 활동
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>최신 활동</DropdownMenuItem>
                  <DropdownMenuItem>이름순</DropdownMenuItem>
                  <DropdownMenuItem>생성일순</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Notebooks Grid or Empty State */}
        {notebooks.length === 0 ? (
          <div className="text-center py-12">
            <Book className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">첫 번째 노트북을 만들어보세요</h3>
            <p className="text-gray-600 mb-6">
              문서를 업로드하고 AI와 함께 탐색해보세요.
            </p>
            <Button
              className="bg-black hover:bg-gray-800 text-white"
              onClick={() => setShowUploadModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              새로 만들기
            </Button>
          </div>
        ) : (
          <div className={`${viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}`}>
            {notebooks.map((notebook) => (
              <Link key={notebook.id} href={`/notebook/${notebook.id}`}>
                <Card className="bg-green-100 border-0 hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-white rounded-lg">
                        {getNotebookIcon(notebook)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.preventDefault()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>이름 바꾸기</DropdownMenuItem>
                          <DropdownMenuItem>복사</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteNotebook(notebook.id);
                            }}
                          >
                            삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                      {notebook.title}
                    </h3>

                    <p className="text-sm text-gray-600">
                      {formatDate(notebook.updatedAt)} • 소스 {notebook.sources.length}개
                    </p>

                    {notebook.description && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                        {notebook.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <SourceUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        onNotebookCreated={handleNotebookCreated}
      />
    </div>
  );
}
