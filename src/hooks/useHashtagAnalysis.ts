import { useMutation } from '@tanstack/react-query';

export interface HashtagAnalysisResult {
  analysis: string;
  warnings: string[];
  suggestions: string[];
  efficiency_score: number;
}

async function runAnalysis(hashtags: string[]): Promise<HashtagAnalysisResult> {
  const res = await fetch('/api/analyze-hashtags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashtags }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export function useHashtagAnalysis() {
  return useMutation({ mutationFn: runAnalysis });
}
