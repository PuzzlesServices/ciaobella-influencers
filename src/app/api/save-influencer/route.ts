import { NextRequest, NextResponse } from 'next/server';
import { saveInfluencerToCampaign } from '@/server/db/influencers';

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const influencer = await saveInfluencerToCampaign(username);
    return NextResponse.json({ influencer });
  } catch (err) {
    console.error('[save-influencer] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
