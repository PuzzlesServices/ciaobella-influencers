import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { type InstagramProfile } from '@/server/types';
import { type DiscoverCard, type DiscoverStage, type DiscoverStats, type ScoreData } from './useDiscovery';

export function useStreamingCards(endpoint: string, storageKey: string) {
  const [stage, setStage]       = useState<DiscoverStage>('idle');
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [scores, setScores]     = useState<Record<string, ScoreData>>({});
  const [stats, setStats]       = useState<DiscoverStats | null>(null);
  const [error, setError]       = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      const { profiles: p, scores: sc, stats: st } = JSON.parse(saved);
      if (p?.length) {
        setProfiles(p);
        setScores(sc ?? {});
        setStats(st ?? null);
        setStage('done');
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  const cards: DiscoverCard[] = useMemo(() =>
    profiles.map((p) => {
      const s = scores[p.username];
      return {
        username:       p.username,
        fullName:       p.fullName,
        followersCount: p.followersCount,
        postsCount:     p.postsCount,
        biography:      p.biography,
        profilePicUrl:  p.profilePicUrl,
        city:           p.city,
        countryCode:    p.countryCode,
        isScoring:      !s,
        score:          s?.score,
        label:          s?.label,
        niche:          s?.niche,
        gender:         s?.gender,
        estimatedAge:   s?.estimatedAge,
        inferredCity:   s?.inferredCity,
        engagementRate: s?.engagementRate,
      };
    }),
  [profiles, scores]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setProfiles([]);
    setScores({});
    setStats(null);
    setError(null);
  }, []);

  const run = useCallback(async (payload: object) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStage('scanning');
    setProfiles([]);
    setScores({});
    setStats(null);
    setError(null);

    let lastProfiles: InstagramProfile[] = [];

    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';

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
              lastProfiles = event.profiles as InstagramProfile[];
              setProfiles(lastProfiles);
              setStats(event.stats as DiscoverStats);
              setStage('scoring');

            } else if (event.type === 'scored') {
              const { username, ...scoreData } = event as { username: string } & ScoreData;
              setScores((prev) => ({ ...prev, [username]: scoreData }));

            } else if (event.type === 'complete') {
              setStats(event.stats as DiscoverStats);
              setStage('done');
              setScores((prev) => {
                try {
                  localStorage.setItem(storageKey, JSON.stringify({
                    profiles: lastProfiles,
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
            console.error(`[useStreamingCards:${endpoint}] Parse error:`, parseErr);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setStage('error');
      setError(err as Error);
    }
  }, [endpoint, storageKey]);

  return {
    run,
    reset,
    stage,
    cards,
    stats,
    error,
    scoredCount:   Object.keys(scores).length,
    totalProfiles: profiles.length,
    isScanning:    stage === 'scanning',
    isScoring:     stage === 'scoring',
    isDone:        stage === 'done',
    isError:       stage === 'error',
  };
}
