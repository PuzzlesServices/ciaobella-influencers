import { useState, useCallback, useRef, useEffect } from 'react';
import { type Influencer } from '@/components/InfluencerCard';
import { type InstagramProfile } from '@/server/types';

const STORAGE_KEY = 'crown_last_discovery_search';

export interface DiscoverFilters {
  gender?: 'female' | 'male' | 'any';
  ageMin?: number;
  ageMax?: number;
  followersMin?: number;
  followersMax?: number;
  city?: string;
  resultsType?: 'posts' | 'reels';
}

export type DiscoverStage = 'idle' | 'scanning' | 'scoring' | 'done' | 'error';

export interface DiscoverStats {
  hashtagPostsFound: number;
  afterPreFilter: number;
  afterProfileFilter: number;
  afterPresetFilter?: number;
  final?: number;
}

interface ScoredRaw extends InstagramProfile {
  score: number;
  label: string;
  reason: string;
  niche: string;
  engagementRate: number;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function baseFields(p: InstagramProfile): Omit<Influencer, 'matchScore' | 'niche' | 'engagement' | 'engagementRaw'> {
  const locationParts = [p.city, p.countryCode].filter(Boolean);
  return {
    name:          p.fullName || p.username,
    username:      `@${p.username}`,
    followers:     formatFollowers(p.followersCount),
    followersRaw:  p.followersCount,
    avatar:        getInitials(p.fullName || p.username),
    profileUrl:    `https://www.instagram.com/${p.username}/`,
    profilePicUrl: p.profilePicUrl,
    location:      locationParts.length > 0 ? locationParts.join(', ') : undefined,
  };
}

function profileToInfluencer(p: InstagramProfile): Influencer {
  return {
    ...baseFields(p),
    matchScore:    -1,   // pending — MatchRing shows '—'
    niche:         '—',
    engagement:    '—',
    engagementRaw: null,
  };
}

function scoredToInfluencer(p: ScoredRaw): Influencer {
  return {
    ...baseFields(p),
    matchScore:    p.score,
    niche:         p.niche,
    engagement:    `${(p.engagementRate ?? 0).toFixed(1)}%`,
    engagementRaw: p.engagementRate ?? null,
  };
}

export function useDiscovery() {
  const [stage, setStage]           = useState<DiscoverStage>('idle');
  const [profiled, setProfiled]     = useState<Influencer[]>([]);
  const [aiVerified, setAiVerified] = useState<Influencer[]>([]);
  const [allScored, setAllScored]   = useState<Influencer[]>([]);
  const [stats, setStats]           = useState<DiscoverStats | null>(null);
  const [error, setError]           = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Restore last complete result from cache
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const { profiled: p, aiVerified: av, allScored: as, stats: s } = JSON.parse(saved);
      if (av?.length) {
        if (p)  setProfiled(p);
        if (av) setAiVerified(av);
        if (as) setAllScored(as);
        if (s)  setStats(s);
        setStage('done');
      }
    } catch { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStage('idle');
    setProfiled([]);
    setAiVerified([]);
    setAllScored([]);
    setStats(null);
    setError(null);
  }, []);

  const runDiscover = useCallback(async ({
    seeds,
    filters,
  }: {
    seeds: string[];
    filters?: DiscoverFilters;
  }) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStage('scanning');
    setProfiled([]);
    setAiVerified([]);
    setAllScored([]);
    setStats(null);
    setError(null);

    try {
      const res = await fetch('/api/discover', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ seeds, filters }),
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
              const cards = (event.profiles as InstagramProfile[]).map(profileToInfluencer);
              setProfiled(cards);
              setStats(event.stats as DiscoverStats);
              setStage('scoring');

            } else if (event.type === 'complete') {
              const av  = (event.influencers   as ScoredRaw[]).map(scoredToInfluencer);
              const as2 = (event.allScored ?? event.influencers as ScoredRaw[]).map(scoredToInfluencer);
              setAiVerified(av);
              setAllScored(as2);
              setStats(event.stats as DiscoverStats);
              setStage('done');
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                  profiled:   as2,
                  aiVerified: av,
                  allScored:  as2,
                  stats:      event.stats,
                }));
              } catch { /* ignore */ }

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

  return {
    runDiscover,
    reset,
    stage,
    profiled,
    aiVerified,
    allScored,
    stats,
    error,
    isScanning:  stage === 'scanning',
    isScoring:   stage === 'scoring',
    isDone:      stage === 'done',
    isError:     stage === 'error',
  };
}
