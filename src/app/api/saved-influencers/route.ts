import { NextResponse } from 'next/server';
import { getTopSavedInfluencers } from '@/server/db/influencers';

export async function GET() {
  try {
    const influencers = await getTopSavedInfluencers();
    return NextResponse.json({ influencers });
  } catch (err) {
    console.error('[saved-influencers] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
