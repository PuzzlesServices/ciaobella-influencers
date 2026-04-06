'use client';

import { AlertTriangle, Lightbulb, Plus } from "lucide-react";
import type { HashtagAnalysisResult } from "@/hooks/useHashtagAnalysis";

interface Props {
  result: HashtagAnalysisResult;
  onAddSuggestion: (tag: string) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-800 border-green-200"
      : score >= 40
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-red-100 text-red-800 border-red-200";

  const label =
    score >= 70 ? "High efficiency" : score >= 40 ? "Medium efficiency" : "Low efficiency";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${color}`}>
      <span className="text-base font-bold">{score}</span>
      <span className="font-medium opacity-80">/ 100 — {label}</span>
    </span>
  );
}

export default function HashtagAnalysisPanel({ result, onAddSuggestion }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium text-foreground">Hashtag Strategy Analysis</p>
        <ScoreBadge score={result.efficiency_score} />
      </div>

      {/* Analysis text */}
      <p className="text-sm text-muted-foreground leading-relaxed">{result.analysis}</p>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            Warnings
          </p>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            Optimized suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {result.suggestions.map((tag) => (
              <button
                key={tag}
                onClick={() => onAddSuggestion(tag)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-sm text-primary font-medium hover:bg-primary/10 transition-colors"
              >
                <Plus className="w-3 h-3" />
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
