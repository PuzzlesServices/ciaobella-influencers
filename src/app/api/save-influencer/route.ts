import { NextRequest, NextResponse } from 'next/server';
import { cacheInfluencer, saveInfluencerToCampaign } from '@/server/db/influencers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, name, profilePicUrl, followersRaw, engagementRaw, matchScore, niche } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // Ensure the row exists before marking it saved (needed for TikTok profiles
    // that were never inserted via the scraper's cacheInfluencer path)
    await cacheInfluencer({
      username,
      full_name:       name            ?? undefined,
      profile_pic:     profilePicUrl   ?? undefined,
      followers_count: followersRaw    ?? undefined,
      engagement_rate: engagementRaw   ?? undefined,
      match_score:     matchScore      ?? undefined,
      ai_category:     niche           ?? undefined,
    });

    const influencer = await saveInfluencerToCampaign(username);
    return NextResponse.json({ influencer });
  } catch (err) {
    console.error('[save-influencer] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
