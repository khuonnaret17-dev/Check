
export interface SpellCorrection {
  originalText: string;
  suggestedText: string;
  reason: string;
  type: 'spelling' | 'grammar' | 'style';
}

export interface AnalysisResult {
  corrections: SpellCorrection[];
  summary: string;
  isCorrect: boolean;
  improvedText: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  text: string;
  result: AnalysisResult;
}
