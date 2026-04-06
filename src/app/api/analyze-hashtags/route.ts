import { NextRequest, NextResponse } from 'next/server';
import { analyzeHashtags } from '@/server/services/hashtagAnalyzer';

export async function POST(req: NextRequest) {
  try {
    const { hashtags } = await req.json();

    if (!Array.isArray(hashtags) || hashtags.length === 0) {
      return NextResponse.json({ error: 'hashtags is required' }, { status: 400 });
    }

    const result = await analyzeHashtags(hashtags);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[analyze-hashtags] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
