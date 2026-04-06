import { NextRequest, NextResponse } from 'next/server';
import { scrapeUserPosts } from '@/server/services/apify';
import { getAdminClient } from '@/lib/supabase';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { username, followersCount: followersFromClient } = await req.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // Use followers from client as primary source (always fresh from Apify scrape)
    // Fall back to Supabase cache if not provided
    let followersCount: number = followersFromClient ?? 0;

    if (!followersCount) {
      const db = getAdminClient();
      const { data: row } = await db
        .from('influencers')
        .select('followers_count')
        .eq('username', username)
        .single();
      followersCount = row?.followers_count ?? 0;
    }

    if (!followersCount) {
      return NextResponse.json({ error: 'Could not determine followers count for this user' }, { status: 400 });
    }

    // Scrape last 5 posts
    const posts = await scrapeUserPosts(username, 5);

    if (posts.length === 0) {
      return NextResponse.json({ error: 'No posts found for this user' }, { status: 404 });
    }

    // Log raw values
    console.log(`[engagement] @${username} — followers: ${followersCount}`);
    posts.forEach((p, i) =>
      console.log(`  post[${i}] likes: ${p.likesCount}, comments: ${p.commentsCount}, rate: ${(((p.likesCount + p.commentsCount) / followersCount) * 100).toFixed(1)}%`)
    );

    // Filter out viral outliers (per-post engagement > 100% = likely viral/unrepresentative)
    const normalPosts = posts.filter(
      (p) => (p.likesCount + p.commentsCount) / followersCount <= 1.0
    );

    // If all posts are outliers (e.g. very new account with small followers), use all posts
    const postsToUse = normalPosts.length > 0 ? normalPosts : posts;

    const totalEngagement = postsToUse.reduce(
      (sum, p) => sum + ((p.likesCount + p.commentsCount) / followersCount) * 100,
      0
    );

    const engagementRate = parseFloat((totalEngagement / postsToUse.length).toFixed(2));

    console.log(`[engagement] @${username} — used ${postsToUse.length}/${posts.length} posts (excluded ${posts.length - postsToUse.length} viral), avg: ${engagementRate}%`);

    // Upsert to Supabase — works whether or not the row already exists
    const db = getAdminClient();
    const { error: upsertError } = await db
      .from('influencers')
      .upsert(
        { username, engagement_rate: engagementRate, followers_count: followersCount },
        { onConflict: 'username', ignoreDuplicates: false }
      );

    if (upsertError) {
      console.error(`[engagement] Supabase upsert failed for @${username}:`, upsertError.message);
    } else {
      console.log(`[engagement] Saved to Supabase — @${username} engagement_rate: ${engagementRate}%`);
    }

    return NextResponse.json({
      engagementRate,
      postsAnalyzed: postsToUse.length,
      viralPostsCount: posts.length - postsToUse.length,
    });
  } catch (err) {
    console.error('[engagement] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
