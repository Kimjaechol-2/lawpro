"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Monitor, Smartphone, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      isElectron: boolean;
      onMenuNewNotebook: (callback: () => void) => void;
      onMenuOpenFiles: (callback: (event: any, filePaths: string[]) => void) => void;
      onMenuExport: (callback: () => void) => void;
      onFileDropped: (callback: (event: any, filePaths: string[]) => void) => void;
      showSaveDialog: (options: any) => Promise<any>;
      showOpenDialog: (options: any) => Promise<any>;
      removeAllListeners: (channel: string) => void;
    };
  }
}

interface ElectronFeaturesProps {
  onNewNotebook?: () => void;
  onOpenFiles?: (filePaths: string[]) => void;
  onExport?: () => void;
}

export function ElectronFeatures({ onNewNotebook, onOpenFiles, onExport }: ElectronFeaturesProps) {
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectron(true);
      setPlatform(window.electronAPI.platform);

      // Set up menu event listeners
      if (onNewNotebook) {
        window.electronAPI.onMenuNewNotebook(onNewNotebook);
      }

      if (onOpenFiles) {
        window.electronAPI.onMenuOpenFiles((event, filePaths) => {
          onOpenFiles(filePaths);
        });
      }

      if (onExport) {
        window.electronAPI.onMenuExport(onExport);
      }

      // Set up file drop listener
      if (onOpenFiles) {
        window.electronAPI.onFileDropped((event, filePaths) => {
          onOpenFiles(filePaths);
        });
      }

      // Cleanup on unmount
      return () => {
        window.electronAPI?.removeAllListeners('menu-new-notebook');
        window.electronAPI?.removeAllListeners('menu-open-files');
        window.electronAPI?.removeAllListeners('menu-export');
        window.electronAPI?.removeAllListeners('file-dropped');
      };
    }
  }, [onNewNotebook, onOpenFiles, onExport]);

  // Don't render anything if not in Electron
  if (!isElectron) {
    return null;
  }

  const getPlatformName = () => {
    switch (platform) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      default: return platform;
    }
  };

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center">
          <Monitor className="h-4 w-4 mr-2 text-blue-600" />
          데스크톱 앱 모드
          <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
            {getPlatformName()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-sm text-blue-700">
            NotebookLM 데스크톱 앱에서 실행 중입니다. 파일을 드래그 앤 드롭하거나 메뉴를 사용하여 더 빠르게 작업하세요.
          </p>

          <div className="flex space-x-2">
            <Button size="sm" variant="outline" className="flex-1 text-blue-700 border-blue-300">
              <Download className="h-3 w-3 mr-1" />
              네이티브 저장
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-blue-700 border-blue-300">
              <Smartphone className="h-3 w-3 mr-1" />
              PWA 버전 보기
            </Button>
          </div>

          <div className="text-xs text-blue-600">
            <strong>키보드 단축키:</strong>
            <br />• Ctrl/Cmd + N: 새 노트북
            <br />• Ctrl/Cmd + O: 파일 열기
            <br />• Ctrl/Cmd + E: 내보내기
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for Electron features
export function useElectron() {
  const [isElectron, setIsElectron] = useState(false);
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      setIsElectron(true);
      setPlatform(window.electronAPI.platform);
    }
  }, []);

  const saveFile = async (defaultPath?: string, filters?: any[]) => {
    if (!window.electronAPI) return null;

    const result = await window.electronAPI.showSaveDialog({
      defaultPath,
      filters: filters || [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    return result;
  };

  const openFile = async (filters?: any[]) => {
    if (!window.electronAPI) return null;

    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [
        { name: 'Documents', extensions: ['pdf', 'docx', 'hwpx', 'txt', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    return result;
  };

  return {
    isElectron,
    platform,
    saveFile,
    openFile,
  };
}
