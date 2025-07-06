"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { processFile, formatFileSize, getFileTypeDisplayName, generateFileSummary, type ProcessedFile } from "@/lib/file-processor";
import { storage, type NotebookData } from "@/lib/storage";
import { useRouter } from "next/navigation";


interface SourceUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotebookCreated?: (notebook: NotebookData) => void;
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  processedFile?: ProcessedFile;
  error?: string;
  progress: number;
}

export function SourceUploadModal({ open, onOpenChange, onNotebookCreated }: SourceUploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notebookTitle, setNotebookTitle] = useState("");
  const [notebookDescription, setNotebookDescription] = useState("");
  const [step, setStep] = useState<'upload' | 'configure' | 'processing' | 'complete'>('upload');

  const router = useRouter();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  };

  const addFiles = (files: File[]) => {
    const newFileStatuses: FileUploadStatus[] = files.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));

    setUploadedFiles(prev => [...prev, ...newFileStatuses]);

    // Generate default notebook title from first file
    if (!notebookTitle && files.length > 0) {
      const fileName = files[0].name.replace(/\.[^/.]+$/, "");
      setNotebookTitle(fileName);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setStep('processing');

    const results: FileUploadStatus[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const fileStatus = uploadedFiles[i];

      // Update status to processing
      setUploadedFiles(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'processing', progress: 0 } : item
      ));

      try {
        // Simulate progress
        for (let progress = 0; progress <= 100; progress += 20) {
          setUploadedFiles(prev => prev.map((item, idx) =>
            idx === i ? { ...item, progress } : item
          ));
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const result = await processFile(fileStatus.file);

        if (result.success && result.file) {
          // Generate AI summary
          const enhancedFile = await generateFileSummary(result.file);

          results.push({
            ...fileStatus,
            status: 'success',
            processedFile: enhancedFile,
            progress: 100,
          });
        } else {
          results.push({
            ...fileStatus,
            status: 'error',
            error: result.error,
            progress: 100,
          });
        }
      } catch (error) {
        results.push({
          ...fileStatus,
          status: 'error',
          error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
          progress: 100,
        });
      }

      setUploadedFiles(prev => prev.map((item, idx) =>
        idx === i ? results[i] : item
      ));
    }

    setIsProcessing(false);
    setStep('complete');
  };

  const createNotebook = async () => {
    try {
      const successfulFiles = uploadedFiles
        .filter(f => f.status === 'success' && f.processedFile)
        .map(f => f.processedFile!);

      if (successfulFiles.length === 0) {
        alert('성공적으로 처리된 파일이 없습니다.');
        return;
      }

      // Create notebook
      const notebook = await storage.createNotebook(
        notebookTitle || 'Untitled Notebook',
        notebookDescription
      );

      // Save files to the notebook
      for (const file of successfulFiles) {
        await storage.saveFile(file, notebook.id);
      }

      // Update notebook with sources
      notebook.sources = successfulFiles;
      await storage.updateNotebook(notebook);

      // Call callback if provided
      if (onNotebookCreated) {
        onNotebookCreated(notebook);
      }

      // Close modal and navigate to notebook
      onOpenChange(false);
      router.push(`/notebook/${notebook.id}`);

      // Reset state
      setUploadedFiles([]);
      setNotebookTitle("");
      setNotebookDescription("");
      setStep('upload');
    } catch (error) {
      console.error('Error creating notebook:', error);
      alert('노트북 생성 중 오류가 발생했습니다.');
    }
  };

  const getStepContent = () => {
    switch (step) {
      case 'upload':
        return (
          <>
            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">소스 업로드</h3>
              <p className="text-gray-600 mb-4">
                업로드할 파일을 선택하거나 드래그 앤 드롭하세요.
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.hwpx,.txt,.md"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <span>소스 검색</span>
                </Button>
              </label>
              <p className="text-sm text-gray-500 mt-4">
                지원되는 파일 형식: PDF, DOCX, HWPX, TXT, Markdown
              </p>
            </div>

            {/* Uploaded Files */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">업로드된 파일 ({uploadedFiles.length}개)</h4>
                {uploadedFiles.map((fileStatus, index) => (
                  <div key={`${fileStatus.file.name}-${fileStatus.file.size}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex-shrink-0">
                        {fileStatus.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : fileStatus.status === 'error' ? (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        ) : fileStatus.status === 'processing' ? (
                          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                        ) : (
                          <FileText className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {fileStatus.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getFileTypeDisplayName(fileStatus.file.name)} • {formatFileSize(fileStatus.file.size)}
                        </p>
                        {fileStatus.error && (
                          <p className="text-xs text-red-600 mt-1">{fileStatus.error}</p>
                        )}
                        {fileStatus.processedFile?.summary && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                            <p className="font-medium text-blue-900">AI 요약</p>
                            <p className="text-blue-700 mt-1">{fileStatus.processedFile.summary.summary}</p>
                            {fileStatus.processedFile.summary.keyPoints.length > 0 && (
                              <div className="mt-1">
                                <span className="text-blue-600">주요 포인트: </span>
                                <span className="text-blue-700">{fileStatus.processedFile.summary.keyPoints.slice(0, 2).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {fileStatus.status === 'processing' && (
                        <div className="w-20">
                          <Progress value={fileStatus.progress} className="h-1" />
                        </div>
                      )}
                    </div>
                    {fileStatus.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('configure')}
                    disabled={uploadedFiles.length === 0}
                  >
                    계속
                  </Button>
                  <Button
                    onClick={processFiles}
                    disabled={uploadedFiles.length === 0 || isProcessing}
                  >
                    {isProcessing ? '처리 중...' : '파일 처리하기'}
                  </Button>
                </div>
              </div>
            )}
          </>
        );

      case 'configure':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">노트북 설정</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="notebook-title" className="block text-sm font-medium text-gray-700 mb-2">
                    노트북 제목
                  </label>
                  <Input
                    id="notebook-title"
                    value={notebookTitle}
                    onChange={(e) => setNotebookTitle(e.target.value)}
                    placeholder="노트북 제목을 입력하세요"
                  />
                </div>
                <div>
                  <label htmlFor="notebook-description" className="block text-sm font-medium text-gray-700 mb-2">
                    설명 (선택사항)
                  </label>
                  <Textarea
                    id="notebook-description"
                    value={notebookDescription}
                    onChange={(e) => setNotebookDescription(e.target.value)}
                    placeholder="노트북에 대한 간단한 설명을 입력하세요"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setStep('upload')}>
                이전
              </Button>
              <Button onClick={processFiles} disabled={!notebookTitle.trim()}>
                노트북 생성
              </Button>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h3 className="text-lg font-medium">파일을 처리하고 있습니다...</h3>
            <p className="text-gray-600">잠시만 기다려주세요.</p>
          </div>
        );

      case 'complete':
        const successCount = uploadedFiles.filter(f => f.status === 'success').length;
        const errorCount = uploadedFiles.filter(f => f.status === 'error').length;

        return (
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
              <h3 className="text-xl font-medium">파일 처리 완료!</h3>
              <div className="text-gray-600">
                <p>{successCount}개 파일이 성공적으로 처리되었습니다.</p>
                {errorCount > 0 && (
                  <p className="text-red-600">{errorCount}개 파일 처리 중 오류가 발생했습니다.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="final-title" className="block text-sm font-medium text-gray-700 mb-2">
                  노트북 제목
                </label>
                <Input
                  id="final-title"
                  value={notebookTitle}
                  onChange={(e) => setNotebookTitle(e.target.value)}
                  placeholder="노트북 제목을 입력하세요"
                />
              </div>
            </div>

            <div className="flex space-x-3 justify-center">
              <Button variant="outline" onClick={() => setStep('upload')}>
                다시 시작
              </Button>
              <Button onClick={createNotebook} disabled={!notebookTitle.trim() || successCount === 0}>
                노트북 생성 완료
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-black rounded-sm flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm" />
            </div>
            <DialogTitle className="text-xl font-medium">NotebookLM</DialogTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-medium mb-2">소스 추가</h2>
            <p className="text-gray-600 text-sm">
              소스를 추가하면 NotebookLM이 가장 중요한 정보에 따라 응답을 제공합니다.<br />
              (예: 마케팅 계획, 수업 자료, 연구 노트, 회의 스크립트, 판매 문서 등)
            </p>
          </div>

          {getStepContent()}

          {/* Source Limit */}
          {step === 'upload' && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-400 rounded-full" />
                <span className="text-sm text-gray-600">소스 한도</span>
              </div>
              <span className="text-sm text-gray-600">{uploadedFiles.length}/300</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
