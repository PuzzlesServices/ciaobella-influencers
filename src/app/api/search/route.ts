import { NextRequest, NextResponse } from 'next/server';
import { scrapeHashtags, scrapeProfiles } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { SearchRequest, ScoredInfluencer } from '@/server/types';

// Allow up to 20 minutes — Apify scraper can take 15+ min on rate-limited runs
export const maxDuration = 300;

// ── Preset campaign filters (Monisha Melwani) ───────────────────────────────
const PRESET = {
  postsLimit:      50,
  genderAllowed:   ['female', 'unknown'] as string[],
  ageAllowed:      ['25-34', '35-44', '45-60', 'unknown'] as string[],
  targetCity:      'miami',
};

function passesPresetFilter(s: ScoredInfluencer): boolean {
  // Gender: reject only if explicitly male
  if (s.gender && !PRESET.genderAllowed.includes(s.gender)) return false;

  // Age: reject only if clearly outside 25-60
  if (s.estimatedAge && !PRESET.ageAllowed.includes(s.estimatedAge)) return false;

  // City: reject only if Gemini identified a specific non-Miami city
  const city = (s.inferredCity ?? '').toLowerCase().trim();
  if (city && city !== 'unknown' && !city.includes(PRESET.targetCity)) return false;

  // Likely a non-personal account: gender+age both unknown AND score is low
  if (s.gender === 'unknown' && s.estimatedAge === 'unknown' && s.score < 40) return false;

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { hashtags: rawHashtags }: SearchRequest = await req.json();

    if (!rawHashtags || (Array.isArray(rawHashtags) && rawHashtags.length === 0)) {
      return NextResponse.json({ error: 'hashtags is required' }, { status: 400 });
    }

    const hashtagList = Array.isArray(rawHashtags) ? rawHashtags : [rawHashtags];
    const limitPerHashtag = Math.ceil(PRESET.postsLimit / hashtagList.length);

    // ── PASO 2: Apify Hashtag Scraper ──────────────────────────────────────
    console.log(`\n[search] ── PASO 2: Hashtag scraper (${PRESET.postsLimit} posts, ${limitPerHashtag}/hashtag)`);
    const posts = await scrapeHashtags(hashtagList, limitPerHashtag);

    // ── PASO 3: Pre-filtro local ───────────────────────────────────────────
    console.log(`[search] ── PASO 3: Pre-filtro`);
    const candidateUsernames = preFilter(posts);
    console.log(`[search] Pre-filtro: ${posts.length} posts → ${candidateUsernames.length} candidatos`);

    if (candidateUsernames.length === 0) {
      return NextResponse.json({
        influencers: [],
        stats: { hashtagPostsFound: posts.length, afterPreFilter: 0, afterProfileFilter: 0, afterPresetFilter: 0, final: 0 },
      });
    }

    // ── PASO 4: Apify Profile Scraper ──────────────────────────────────────
    console.log(`[search] ── PASO 4: Profile scraper (${candidateUsernames.length} perfiles)`);
    const profiles = await scrapeProfiles(candidateUsernames);

    // ── PASO 5a: Filtro post-perfil (followers 30K-100K) ───────────────────
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
          afterPresetFilter: 0,
          final: 0,
        },
      });
    }

    // ── PASO 5b: Gemini scoring + clasificación (gender / age / city) ──────
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
      console.log(
        `[search] Scored @${profile.username} → ${result.score} (${result.label}) | gender:${result.gender} age:${result.estimatedAge} city:${result.inferredCity}`
      );

      // ── Cache to Supabase ─────────────────────────────────────────────────
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

    // ── PASO 6: Preset filter (female · 25-60 · Miami) ────────────────────
    const allScored      = [...scored].sort((a, b) => b.score - a.score);
    const presetFiltered = scored.filter(passesPresetFilter);
    console.log(
      `[search] Preset filter: ${scored.length} → ${presetFiltered.length} perfiles (female · 25-60 · Miami)`
    );

    // ── PASO 7: Sort by score ──────────────────────────────────────────────
    const sorted = presetFiltered.sort((a, b) => b.score - a.score);
    console.log(`[search] ✓ Done — ${sorted.length} influencers ranked`);

    return NextResponse.json({
      influencers: sorted,
      allScored,
      stats: {
        hashtagPostsFound:  posts.length,
        afterPreFilter:     candidateUsernames.length,
        afterProfileFilter: filteredProfiles.length,
        afterPresetFilter:  presetFiltered.length,
        final:              sorted.length,
      },
    });
  } catch (err) {
    console.error('[search] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
