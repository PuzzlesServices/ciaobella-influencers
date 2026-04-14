import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { type Influencer } from '@/components/InfluencerCard';

const STORAGE_KEY = 'crown_last_tiktok_native_search';

interface SearchStats {
  hashtagPostsFound: number;
  afterPreFilter: number;
  afterProfileFilter: number;
  afterPresetFilter: number;
  final: number;
}

interface ScoredCreator {
  username: string;
  nickname: string;
  followersCount: number;
  videosCount: number;
  profilePicUrl?: string;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  score: number;
  label: string;
  reason: string;
  niche: string;
  inferredCity?: string;
}

interface TikTokNativeResponse {
  influencers: ScoredCreator[];
  allScored:   ScoredCreator[];
  stats: SearchStats;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function toInfluencer(c: ScoredCreator): Influencer {
  return {
    name:          c.nickname || c.username,
    username:      `@${c.username}`,
    followers:     formatNumber(c.followersCount),
    followersRaw:  c.followersCount,
    engagement:    `${(c.engagementRate ?? 0).toFixed(1)}%`,
    engagementRaw: c.engagementRate ?? null,
    matchScore:    c.score,
    niche:         c.niche,
    avatar:        getInitials(c.nickname || c.username),
    profileUrl:    `https://www.tiktok.com/@${c.username}`,
    profilePicUrl: c.profilePicUrl,
    location:      c.inferredCity && c.inferredCity !== 'unknown' ? c.inferredCity : undefined,
    platform:      'tiktok',
  };
}

export interface TikTokNativeResult {
  influencers: Influencer[];
  allProfiled: Influencer[];
  stats: SearchStats;
}

async function runTikTokNative({ hashtags }: { hashtags: string[] }): Promise<TikTokNativeResult> {
  const res = await fetch('/api/tiktok-native', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashtags }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const data: TikTokNativeResponse = await res.json();

  return {
    influencers: data.influencers.map(toInfluencer),
    allProfiled: (data.allScored ?? data.influencers).map(toInfluencer),
    stats: data.stats,
  };
}

export function useTikTokNative() {
  const [cached, setCached] = useState<TikTokNativeResult | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCached(JSON.parse(saved));
    } catch {}
  }, []);

  const mutation = useMutation({
    mutationFn: runTikTokNative,
    onSuccess: (data) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
    },
  });

  return { ...mutation, data: mutation.data ?? cached };
}
