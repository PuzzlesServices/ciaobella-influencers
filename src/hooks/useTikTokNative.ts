import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'crown_last_tiktok_native_search';

export type TikTokNativeStage = 'idle' | 'scanning' | 'scoring' | 'done' | 'error';

export interface TikTokNativeStats {
  hashtagPostsFound:  number;
  afterPreFilter:     number;
  afterProfileFilter: number;
}

interface TikTokCreatorRaw {
  username:       string;
  nickname:       string;
  bio:            string;
  followersCount: number;
  videosCount:    number;
  profilePicUrl?: string;
  avgViews:       number;
  avgLikes:       number;
  avgComments:    number;
  engagementRate: number;
  topCaptions:    string[];
}

interface TikTokScoreData {
  score:         number;
  label:         string;
  niche:         string;
  gender?:       string;
  estimatedAge?: string;
  inferredCity?: string;
}

export interface TikTokCard extends TikTokCreatorRaw {
  isScoring:     boolean;
  score?:        number;
  label?:        string;
  niche?:        string;
  gender?:       string;
  estimatedAge?: string;
  inferredCity?: string;
}

export function useTikTokNative() {
  const [stage,    setStage]    = useState<TikTokNativeStage>('idle');
  const [creators, setCreators] = useState<TikTokCreatorRaw[]>([]);
  const [scores,   setScores]   = useState<Record<string, TikTokScoreData>>({});
  const [stats,    setStats]    = useState<TikTokNativeStats | null>(null);
  const [error,    setError]    = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Restore last session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.creators?.length) {
        setCreators(parsed.creators);
        setScores(parsed.scores ?? {});
        setStats(parsed.stats ?? null);
        setStage('done');
      }
    } catch { /* ignore */ }
  }, []);

  // Merged cards: creator data + score (if available)
  const cards: TikTokCard[] = useMemo(() =>
    creators.map((c) => {
      const s = scores[c.username];
      return {
        ...c,
        isScoring:    !s,
        score:        s?.score,
        label:        s?.label,
        niche:        s?.niche,
        gender:       s?.gender,
        estimatedAge: s?.estimatedAge,
        inferredCity: s?.inferredCity,
      };
    }),
  [creators, scores]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setCreators([]);
    setScores({});
    setStats(null);
    setError(null);
  }, []);

  const mutate = useCallback(async ({ hashtags }: { hashtags: string[] }) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStage('scanning');
    setCreators([]);
    setScores({});
    setStats(null);
    setError(null);

    try {
      const res = await fetch('/api/tiktok-native', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ hashtags }),
        signal:  abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      let lastCreators: TikTokCreatorRaw[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'profiled') {
              lastCreators = event.creators as TikTokCreatorRaw[];
              setCreators(lastCreators);
              setStats(event.stats as TikTokNativeStats);
              setStage('scoring');

            } else if (event.type === 'scored') {
              const { username, ...scoreData } = event as { username: string } & TikTokScoreData;
              setScores((prev) => ({ ...prev, [username]: scoreData }));

            } else if (event.type === 'complete') {
              setStage('done');
              setScores((prev) => {
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    creators: lastCreators,
                    scores:   prev,
                    stats:    event.stats,
                  }));
                } catch { /* ignore */ }
                return prev;
              });

            } else if (event.type === 'error') {
              throw new Error(event.message as string);
            }
          } catch (parseErr) {
            console.error('[useTikTokNative] Parse error:', parseErr);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setStage('error');
      setError(err as Error);
    }
  }, []);

  const scoredCount   = Object.keys(scores).length;
  const totalCreators = creators.length;

  return {
    mutate,
    reset,
    stage,
    cards,
    stats,
    error,
    scoredCount,
    totalCreators,
    isScanning: stage === 'scanning',
    isScoring:  stage === 'scoring',
    isDone:     stage === 'done',
    isError:    stage === 'error',
  };
}
