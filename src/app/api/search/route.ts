import { NextRequest, NextResponse } from 'next/server';
import { scrapeHashtags, scrapeProfiles } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { SearchRequest, ScoredInfluencer } from '@/server/types';

// Allow up to 20 minutes — Apify scraper can take 15+ min on rate-limited runs
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { hashtags: rawHashtags, maxResults = 10 }: SearchRequest = await req.json();

    if (!rawHashtags || (Array.isArray(rawHashtags) && rawHashtags.length === 0)) {
      return NextResponse.json({ error: 'hashtags is required' }, { status: 400 });
    }

    const hashtagList = Array.isArray(rawHashtags) ? rawHashtags : [rawHashtags];
    const limitPerHashtag = Math.ceil(maxResults / hashtagList.length);

    // ── PASO 2: Apify Hashtag Scraper ──────────────────────────────────────
    console.log(`\n[search] ── PASO 2: Hashtag scraper`);
    const posts = await scrapeHashtags(hashtagList, limitPerHashtag);

    // ── PASO 3: Pre-filtro local ───────────────────────────────────────────
    console.log(`[search] ── PASO 3: Pre-filtro`);
    const candidateUsernames = preFilter(posts);
    console.log(`[search] Pre-filtro: ${posts.length} posts → ${candidateUsernames.length} candidatos`);

    if (candidateUsernames.length === 0) {
      return NextResponse.json({
        influencers: [],
        stats: { hashtagPostsFound: posts.length, afterPreFilter: 0, afterProfileFilter: 0, final: 0 },
      });
    }

    // ── PASO 4: Apify Profile Scraper ──────────────────────────────────────
    console.log(`[search] ── PASO 4: Profile scraper (${candidateUsernames.length} perfiles)`);
    const profiles = await scrapeProfiles(candidateUsernames);

    // ── PASO 5a: Filtro post-perfil ────────────────────────────────────────
    console.log(`[search] ── PASO 5a: Post-profile filter`);
    const filteredProfiles = postProfileFilter(profiles);
    console.log(`[search] Post-filtro: ${profiles.length} → ${filteredProfiles.length} perfiles`);

    if (filteredProfiles.length === 0) {
      return NextResponse.json({
        influencers: [],
        stats: {
          hashtagPostsFound: posts.length,
          afterPreFilter: candidateUsernames.length,
          afterProfileFilter: 0,
          final: 0,
        },
      });
    }

    // ── PASO 5b: Gemini match score (secuencial, respeta rate limit) ───────
    console.log(`[search] ── PASO 5b: Scoring ${filteredProfiles.length} perfiles con Gemini`);

    const scored: ScoredInfluencer[] = [];
    for (const profile of filteredProfiles) {
      const postData = posts.find(
        (p) => p.ownerUsername.toLowerCase() === profile.username.toLowerCase()
      );
      const engagementRate =
        profile.followersCount > 0 && postData
          ? ((postData.likesCount + postData.commentsCount) / profile.followersCount) * 100
          : 0;

      const result = await scoreInfluencer(profile, engagementRate);
      scored.push({ ...profile, ...result, engagementRate });
      console.log(`[search] Scored @${profile.username} → ${result.score} (${result.label})`);

      // ── Cache to Supabase (preserves CRM fields if already saved) ─────────
      cacheInfluencer({
        username:        profile.username,
        full_name:       profile.fullName,
        profile_pic:     profile.profilePicUrl,
        bio:             profile.biography,
        followers_count: profile.followersCount,
        engagement_rate: engagementRate,
        match_score:     result.score,
        ai_category:     result.niche,
        ai_reason:       result.reason,
      }).catch((err) => console.error(`[search] cacheInfluencer failed for @${profile.username}:`, err));

      // Respect Gemini free tier rate limit (15 RPM)
      await new Promise((r) => setTimeout(r, 4_000));
    }

    // ── PASO 6: Sort by score ──────────────────────────────────────────────
    const sorted = scored.sort((a, b) => b.score - a.score);
    console.log(`[search] ✓ Done — ${sorted.length} influencers ranked`);

    return NextResponse.json({
      influencers: sorted,
      stats: {
        hashtagPostsFound: posts.length,
        afterPreFilter: candidateUsernames.length,
        afterProfileFilter: filteredProfiles.length,
        final: sorted.length,
      },
    });
  } catch (err) {
    console.error('[search] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
