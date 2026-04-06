import { useMutation } from '@tanstack/react-query';

interface EngagementInput {
  username: string;
  followersCount: number;
}

interface EngagementResult {
  engagementRate: number;
  postsAnalyzed: number;
  viralPostsCount: number;
}

async function scrapeEngagement({ username, followersCount }: EngagementInput): Promise<EngagementResult> {
  const res = await fetch('/api/engagement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, followersCount }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export function useEngagementScrape() {
  return useMutation({ mutationFn: scrapeEngagement });
}
