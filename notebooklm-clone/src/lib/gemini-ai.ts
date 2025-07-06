import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API 클라이언트 초기화
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
console.log('Gemini API 키 상태:', apiKey ? `설정됨 (${apiKey.substring(0, 10)}...)` : '설정되지 않음');

if (!apiKey) {
  console.error('NEXT_PUBLIC_GEMINI_API_KEY가 설정되지 않았습니다!');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

// Gemini 모델 설정
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash-exp", // 최신 Gemini 2.0 모델 사용
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192,
  },
});

export interface SourceSummary {
  sourceId: string;
  fileName: string;
  summary: string;
  keyPoints: string[];
  wordCount: number;
  language: string;
}

export interface ChatResponse {
  content: string;
  sources: string[];
  confidence: number;
}

// 텍스트 요약 생성
export async function generateSourceSummary(
  fileName: string,
  content: string
): Promise<SourceSummary> {
  const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // 내용이 너무 짧은 경우 처리
    if (!content || content.trim().length < 50) {
      return {
        sourceId,
        fileName,
        summary: '문서 내용이 너무 짧아서 요약할 수 없습니다.',
        keyPoints: ['문서 내용 부족'],
        wordCount: content.length,
        language: /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(content) ? '한국어' : '영어'
      };
    }

    // 내용이 너무 긴 경우 자르기 (API 제한 고려)
    const maxContentLength = 10000; // 약 10,000자로 제한
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '...(내용 일부 생략)'
      : content;

    console.log(`AI 요약 생성 시작: ${fileName} (${truncatedContent.length}자)`);

    const prompt = `다음 문서를 분석하고 요약해주세요:

문서명: ${fileName}
내용: ${truncatedContent}

다음 형식으로 정확히 응답해주세요:
{
  "summary": "문서의 핵심 내용을 2-3 문장으로 요약",
  "keyPoints": ["주요 포인트 1", "주요 포인트 2", "주요 포인트 3"],
  "language": "한국어",
  "estimatedWords": ${Math.floor(content.length / 5)}
}

중요: 반드시 유효한 JSON 형식으로만 응답해주세요.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // 응답 상태 확인
    if (!response) {
      throw new Error('AI 응답을 받을 수 없습니다.');
    }

    const text = response.text();
    console.log(`AI 응답 받음: ${text.substring(0, 100)}...`);

    if (!text || text.trim().length === 0) {
      throw new Error('AI 응답이 비어있습니다.');
    }

    // JSON 파싱 시도
    try {
      // JSON 추출을 위한 정규식 (백틱이나 다른 문자 제거)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;

      const parsed = JSON.parse(jsonText);

      const summary = {
        sourceId,
        fileName,
        summary: parsed.summary || '요약을 생성했지만 내용을 파싱할 수 없습니다.',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : ['주요 포인트를 추출할 수 없습니다'],
        wordCount: typeof parsed.estimatedWords === 'number' ? parsed.estimatedWords : Math.floor(content.length / 5),
        language: parsed.language || (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(content) ? '한국어' : '영어')
      };

      console.log(`AI 요약 완성: ${fileName}`);
      return summary;

    } catch (parseError) {
      console.log('JSON 파싱 실패, 텍스트에서 정보 추출 시도');

      // JSON 파싱 실패 시 텍스트에서 정보 추출
      const lines = text.split('\n').filter(line => line.trim());
      const summary = lines.find(line => line.includes('요약') || line.includes('summary'))?.replace(/[^\w\s가-힣.,!?]/g, '').trim() ||
                    text.substring(0, 200).replace(/[^\w\s가-힣.,!?]/g, '').trim();

      const keyPoints = lines
        .filter(line => line.includes('-') || line.includes('•') || line.includes('포인트'))
        .map(line => line.replace(/[^\w\s가-힣.,!?-]/g, '').trim())
        .slice(0, 3);

      return {
        sourceId,
        fileName,
        summary: summary || 'AI가 요약을 생성했지만 형식을 파싱할 수 없습니다.',
        keyPoints: keyPoints.length > 0 ? keyPoints : ['키포인트를 추출할 수 없습니다'],
        wordCount: Math.floor(content.length / 5),
        language: /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(content) ? '한국어' : '영어'
      };
    }
  } catch (error) {
    console.error('Gemini API 요약 생성 오류:', error);

    // 구체적인 오류 메시지 생성
    let errorMessage = 'AI 요약 생성 중 오류가 발생했습니다.';
    if (error instanceof Error) {
      if (error.message.includes('API_KEY')) {
        errorMessage = 'AI API 키 설정을 확인해주세요.';
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        errorMessage = 'AI API 사용량 한도를 초과했습니다.';
      } else if (error.message.includes('safety')) {
        errorMessage = 'AI 안전성 필터에 의해 요약이 차단되었습니다.';
      }
    }

    return {
      sourceId,
      fileName,
      summary: errorMessage,
      keyPoints: ['오류로 인해 요약을 생성할 수 없습니다'],
      wordCount: Math.floor(content.length / 5),
      language: /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(content) ? '한국어' : '영어'
    };
  }
}

// 채팅 응답 생성
export async function generateChatResponse(
  userQuery: string,
  sources: Array<{ name: string; content: string; summary?: string }>,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ChatResponse> {
  try {
    const sourceContext = sources.map((source, index) =>
      `[소스 ${index + 1}: ${source.name}]\n${source.content}\n\n`
    ).join('');

    const chatHistoryText = chatHistory.slice(-6).map(msg =>
      `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`
    ).join('\n');

    const prompt = `
당신은 업로드된 문서들을 기반으로 정확하고 유용한 답변을 제공하는 AI 어시스턴트입니다.

업로드된 소스 문서들:
${sourceContext}

이전 대화 내역:
${chatHistoryText}

사용자 질문: ${userQuery}

다음 지침을 따라 답변해주세요:
1. 반드시 제공된 소스 문서의 내용만을 기반으로 답변하세요
2. 소스에 없는 정보는 추측하지 마세요
3. 어떤 소스에서 정보를 가져왔는지 명시하세요
4. 답변은 구조적이고 이해하기 쉽게 작성하세요
5. 불확실한 부분이 있다면 명시하세요

응답 형식:
## 답변

[여기에 상세한 답변을 작성하세요]

## 참조 소스
- [소스명]: [해당 정보]

## 신뢰도
[높음/보통/낮음] - [이유]
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    // 참조된 소스 추출
    const referencedSources = sources
      .filter(source => content.includes(source.name))
      .map(source => source.name);

    // 신뢰도 추출 (간단한 휴리스틱)
    let confidence = 0.8; // 기본값
    if (content.includes('불확실') || content.includes('추측')) {
      confidence = 0.5;
    } else if (referencedSources.length > 1) {
      confidence = 0.9;
    }

    return {
      content,
      sources: referencedSources,
      confidence
    };

  } catch (error) {
    console.error('Gemini API 채팅 응답 생성 오류:', error);
    return {
      content: '죄송합니다. AI 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      sources: [],
      confidence: 0
    };
  }
}

// 여러 소스 종합 분석
export async function generateComprehensiveAnalysis(
  sources: Array<{ name: string; content: string; summary: string }>,
  analysisType: 'overview' | 'comparison' | 'synthesis' = 'overview'
): Promise<string> {
  try {
    let prompt = '';

    switch (analysisType) {
      case 'overview':
        prompt = `
다음 문서들의 전체적인 개요를 작성해주세요:

${sources.map((source, index) =>
  `[문서 ${index + 1}: ${source.name}]\n요약: ${source.summary}\n\n`
).join('')}

전체 문서들의:
1. 공통 주제와 핵심 내용
2. 각 문서의 고유한 기여점
3. 전체적인 결론과 시사점

구조적이고 포괄적인 분석을 제공해주세요.
`;
        break;

      case 'comparison':
        prompt = `
다음 문서들을 비교 분석해주세요:

${sources.map((source, index) =>
  `[문서 ${index + 1}: ${source.name}]\n내용: ${source.content}\n\n`
).join('')}

비교 분석 요소:
1. 공통점과 차이점
2. 각 문서의 관점과 접근법
3. 상충하는 내용이나 보완적인 내용
4. 종합적인 견해

표 형식이나 구조화된 형태로 제시해주세요.
`;
        break;

      case 'synthesis':
        prompt = `
다음 문서들을 종합하여 새로운 통찰을 제공해주세요:

${sources.map((source, index) =>
  `[문서 ${index + 1}: ${source.name}]\n내용: ${source.content}\n\n`
).join('')}

종합 분석:
1. 문서들 간의 연관성과 패턴
2. 새로운 통찰과 발견
3. 실용적인 응용 방안
4. 추가 연구나 조사가 필요한 영역

창의적이고 심층적인 분석을 제공해주세요.
`;
        break;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Gemini API 종합 분석 생성 오류:', error);
    return '종합 분석 생성 중 오류가 발생했습니다.';
  }
}

// API 키 확인
export function isGeminiConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;
}

// 오디오 개요 생성 (텍스트 기반)
export async function generateAudioOverview(
  sources: Array<{ name: string; content: string; summary: string }>
): Promise<string> {
  try {
    const prompt = `
다음 문서들을 기반으로 오디오 팟캐스트 스크립트를 작성해주세요:

${sources.map((source, index) =>
  `[문서 ${index + 1}: ${source.name}]\n요약: ${source.summary}\n\n`
).join('')}

오디오 개요 요구사항:
1. 5-10분 분량의 팟캐스트 스크립트
2. 자연스러운 대화체
3. 핵심 내용을 흥미롭게 전달
4. 청취자가 이해하기 쉬운 구조
5. 시작, 본론, 마무리로 구성

스크립트 형식으로 작성해주세요.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error('Gemini API 오디오 개요 생성 오류:', error);
    return '오디오 개요 생성 중 오류가 발생했습니다.';
  }
}
