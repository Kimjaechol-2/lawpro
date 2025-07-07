import mammoth from 'mammoth';
import { generateSourceSummary, type SourceSummary } from './gemini-ai';

export interface ProcessedFile {
  name: string;
  type: string;
  size: number;
  content: string;
  lastModified: number;
  id: string;
  summary?: SourceSummary;
  isProcessing?: boolean;
}

export interface FileProcessingResult {
  success: boolean;
  file?: ProcessedFile;
  error?: string;
}

// Generate unique ID for files
function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Extract text from PDF files (client-side)
async function extractPdfText(file: File): Promise<string> {
  try {
    // For client-side PDF processing, we'll use a simplified approach
    // Note: pdf-parse works in Node.js environment, so we'll implement a fallback
    const arrayBuffer = await file.arrayBuffer();

    // For now, return a placeholder. In a real implementation, you'd use a client-side PDF library
    // like pdf.js or send to server for processing
    return `PDF 파일이 업로드되었습니다: ${file.name}\n\n[PDF 텍스트 추출 기능은 서버 사이드에서 구현됩니다. 현재는 데모 모드입니다.]`;
  } catch (error) {
    throw new Error(`PDF 처리 중 오류 발생: ${error}`);
  }
}

// Extract text from DOCX files
async function extractDocxText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new Error(`DOCX 처리 중 오류 발생: ${error}`);
  }
}

// Extract text from plain text files
async function extractTextFileContent(file: File): Promise<string> {
  try {
    return await file.text();
  } catch (error) {
    throw new Error(`텍스트 파일 처리 중 오류 발생: ${error}`);
  }
}

// Extract text from HWPX files (placeholder)
async function extractHwpxText(file: File): Promise<string> {
  try {
    // HWPX는 복잡한 형식이므로 전용 라이브러리가 필요합니다
    // 현재는 플레이스홀더를 반환합니다
    return `HWPX 파일이 업로드되었습니다: ${file.name}\n\n[HWPX 텍스트 추출 기능은 추후 구현 예정입니다.]`;
  } catch (error) {
    throw new Error(`HWPX 처리 중 오류 발생: ${error}`);
  }
}

// Main file processing function
export async function processFile(file: File): Promise<FileProcessingResult> {
  try {
    let content: string;
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    // Determine file type and extract text accordingly
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      content = await extractPdfText(file);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      content = await extractDocxText(file);
    } else if (fileName.endsWith('.hwpx')) {
      content = await extractHwpxText(file);
    } else if (
      fileType.startsWith('text/') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.markdown')
    ) {
      content = await extractTextFileContent(file);
    } else {
      throw new Error(`지원되지 않는 파일 형식입니다: ${file.name}`);
    }

    const processedFile: ProcessedFile = {
      id: generateFileId(),
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      content,
      lastModified: file.lastModified,
      isProcessing: true, // AI 요약 생성 중
    };

    return {
      success: true,
      file: processedFile,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
    };
  }
}

// AI 요약 생성 함수 (별도 호출)
export async function generateFileSummary(processedFile: ProcessedFile): Promise<ProcessedFile> {
  try {
    // 텍스트가 너무 짧으면 요약하지 않음
    if (processedFile.content.length < 100) {
      return {
        ...processedFile,
        isProcessing: false,
        summary: {
          sourceId: processedFile.id,
          fileName: processedFile.name,
          summary: '문서가 너무 짧아서 요약할 내용이 부족합니다.',
          keyPoints: ['짧은 문서'],
          wordCount: processedFile.content.length / 5,
          language: /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(processedFile.content) ? '한국어' : '영어'
        }
      };
    }

    // Gemini AI로 요약 생성
    const summary = await generateSourceSummary(processedFile.name, processedFile.content);

    return {
      ...processedFile,
      summary,
      isProcessing: false,
    };
  } catch (error) {
    console.error('AI 요약 생성 오류:', error);
    return {
      ...processedFile,
      isProcessing: false,
      summary: {
        sourceId: processedFile.id,
        fileName: processedFile.name,
        summary: 'AI 요약 생성 중 오류가 발생했습니다.',
        keyPoints: ['요약 생성 실패'],
        wordCount: processedFile.content.length / 5,
        language: '알 수 없음'
      }
    };
  }
}

// Get file type display name
export function getFileTypeDisplayName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'PDF 문서';
    case 'docx':
      return 'Word 문서';
    case 'hwpx':
      return '한글 문서';
    case 'txt':
      return '텍스트 파일';
    case 'md':
    case 'markdown':
      return 'Markdown 문서';
    default:
      return '문서';
  }
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
