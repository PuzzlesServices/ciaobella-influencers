import { NextRequest, NextResponse } from 'next/server';
import { getTopSavedInfluencers, unsaveInfluencer } from '@/server/db/influencers';

export async function GET() {
  try {
    const influencers = await getTopSavedInfluencers();
    return NextResponse.json({ influencers });
  } catch (err) {
    console.error('[saved-influencers] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { username } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    await unsaveInfluencer(username);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[saved-influencers] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
