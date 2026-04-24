import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { type InstagramProfile } from '@/server/types';

const STORAGE_KEY = 'crown_last_discovery_search';

export type DiscoverStage = 'idle' | 'scanning' | 'scoring' | 'done' | 'error';

export interface DiscoverStats {
  hashtagPostsFound:   number;
  afterPreFilter:      number;
  afterQualityFilter:  number;
  seedPostsAnalyzed?:  number;
  relatedHashtags?:    string[];
}

export interface ScoreData {
  score:         number;
  label:         string;
  niche:         string;
  gender?:       string;
  estimatedAge?: string;
  inferredCity?: string;
  engagementRate: number;
}

// Card type exposed to the UI — profile + optional score
export interface DiscoverCard {
  username:      string;
  fullName:      string;
  followersCount: number;
  postsCount:    number;
  biography:     string;
  profilePicUrl?: string;
  city?:         string;
  countryCode?:  string;
  isScoring:     boolean;   // true = Gemini hasn't scored this card yet
  // score fields (undefined while isScoring)
  score?:        number;
  label?:        string;
  niche?:        string;
  gender?:       string;
  estimatedAge?: string;
  inferredCity?: string;
  engagementRate?: number;
}

export function useDiscovery() {
  const [stage, setStage]       = useState<DiscoverStage>('idle');
  const [profiles, setProfiles] = useState<InstagramProfile[]>([]);
  const [scores, setScores]     = useState<Record<string, ScoreData>>({});
  const [stats, setStats]       = useState<DiscoverStats | null>(null);
  const [error, setError]       = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Restore last session from cache
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.profiles?.length) {
        setProfiles(parsed.profiles);
        setScores(parsed.scores ?? {});
        setStats(parsed.stats ?? null);
        setStage('done');
      }
    } catch { /* ignore */ }
  }, []);

  // Merged cards: profile data + score data (if available)
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

  const [activeMode, setActiveMode] = useState<'hashtag' | 'username'>('hashtag');

  const runDiscover = useCallback(async ({
    seeds = [],
    resultsType = 'posts',
    mode = 'hashtag',
    customHashtags = [],
    usernames = [],
    seedUsername = '',
  }: {
    seeds?: string[];
    resultsType?: 'posts' | 'reels';
    mode?: 'hashtag' | 'username';
    customHashtags?: string[];
    usernames?: string[];
    seedUsername?: string;
  }) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setActiveMode(mode);
    setStage('scanning');
    setProfiles([]);
    setScores({});
    setStats(null);
    setError(null);

    try {
      const res = await fetch('/api/discover', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ seeds, resultsType, mode, customHashtags, usernames, seedUsername }),
        signal:  abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = '';
      let lastProfiles: InstagramProfile[] = [];

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

            if (event.type === 'hashtags_resolved') {
              setStats((prev) => ({
                hashtagPostsFound:  prev?.hashtagPostsFound ?? 0,
                afterPreFilter:     prev?.afterPreFilter ?? 0,
                afterQualityFilter: prev?.afterQualityFilter ?? 0,
                seedPostsAnalyzed:  event.seedPostsAnalyzed as number,
                relatedHashtags:    event.relatedHashtags as string[],
              }));

            } else if (event.type === 'profiled') {
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
              // Save to cache after scoring completes
              setScores((prev) => {
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
            console.error('[useDiscovery] Parse error:', parseErr);
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
  const totalProfiles = profiles.length;

  return {
    runDiscover,
    reset,
    stage,
    activeMode,
    cards,
    stats,
    error,
    scoredCount,
    totalProfiles,
    isScanning: stage === 'scanning',
    isScoring:  stage === 'scoring',
    isDone:     stage === 'done',
    isError:    stage === 'error',
  };
}
