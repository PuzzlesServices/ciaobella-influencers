import { useQuery } from '@tanstack/react-query';
import type { Influencer } from '@/components/InfluencerCard';
import type { InfluencerRow } from '@/server/db/influencers';

function formatFollowers(n: number | null): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function rowToInfluencer(row: InfluencerRow): Influencer {
  const displayName = row.full_name || row.username;
  return {
    name:        displayName,
    username:    `@${row.username}`,
    followers:   formatFollowers(row.followers_count),
    followersRaw: row.followers_count ?? 0,
    engagement:  row.engagement_rate != null ? `${Number(row.engagement_rate).toFixed(1)}%` : '—',
    matchScore:  row.match_score ?? 0,
    niche:       row.ai_category ?? '—',
    avatar:      getInitials(displayName),
    profileUrl:  `https://www.instagram.com/${row.username}/`,
    profilePicUrl: row.profile_pic ?? undefined,
  };
}

async function fetchSavedInfluencers(): Promise<Influencer[]> {
  const res = await fetch('/api/saved-influencers');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const data: { influencers: InfluencerRow[] } = await res.json();
  return data.influencers.map(rowToInfluencer);
}

export function useSavedInfluencers(enabled: boolean) {
  return useQuery({
    queryKey: ['saved-influencers'],
    queryFn: fetchSavedInfluencers,
    enabled,
    staleTime: 30_000,
  });
}
