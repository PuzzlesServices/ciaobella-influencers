import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { type Influencer } from '@/components/InfluencerCard';

const STORAGE_KEY = 'crown_last_discovery_search';

interface SearchStats {
  hashtagPostsFound: number;
  afterPreFilter: number;
  afterProfileFilter: number;
  afterPresetFilter: number;
  final: number;
}

interface ScoredInfluencer {
  username: string;
  fullName: string;
  followersCount: number;
  postsCount: number;
  isVerified: boolean;
  externalUrl: string | null;
  score: number;
  label: string;
  reason: string;
  niche: string;
  engagementRate: number;
  profilePicUrl?: string;
  city?: string;
  countryCode?: string;
}

interface DiscoverResponse {
  influencers: ScoredInfluencer[];
  allScored:   ScoredInfluencer[];
  stats: SearchStats;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function toInfluencer(p: ScoredInfluencer): Influencer {
  const locationParts = [p.city, p.countryCode].filter(Boolean);
  return {
    name:          p.fullName || p.username,
    username:      `@${p.username}`,
    followers:     formatFollowers(p.followersCount),
    followersRaw:  p.followersCount,
    engagement:    `${(p.engagementRate ?? 0).toFixed(1)}%`,
    engagementRaw: p.engagementRate ?? null,
    matchScore:    p.score,
    niche:         p.niche,
    avatar:        getInitials(p.fullName || p.username),
    profileUrl:    `https://www.instagram.com/${p.username}/`,
    profilePicUrl: p.profilePicUrl,
    location:      locationParts.length > 0 ? locationParts.join(', ') : undefined,
  };
}

export interface DiscoverResult {
  influencers: Influencer[];
  allProfiled: Influencer[];
  stats: SearchStats;
}

export interface DiscoverFilters {
  gender?: 'female' | 'male' | 'any';
  ageMin?: number;
  ageMax?: number;
  followersMin?: number;
  followersMax?: number;
  city?: string;
}

async function runDiscover({ seeds, filters }: { seeds: string[]; filters?: DiscoverFilters }): Promise<DiscoverResult> {
  const res = await fetch('/api/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seeds, filters }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const data: DiscoverResponse = await res.json();

  return {
    influencers: data.influencers.map(toInfluencer),
    allProfiled: (data.allScored ?? data.influencers).map(toInfluencer),
    stats: data.stats,
  };
}

export function useDiscovery() {
  const [cached, setCached] = useState<DiscoverResult | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCached(JSON.parse(saved));
    } catch {}
  }, []);

  const mutation = useMutation({
    mutationFn: runDiscover,
    onSuccess: (data) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
    },
  });

  return { ...mutation, data: mutation.data ?? cached };
}
