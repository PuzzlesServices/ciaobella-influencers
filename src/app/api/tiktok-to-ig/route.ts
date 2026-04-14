import { NextRequest, NextResponse } from 'next/server';
import { scrapeByTikTok, scrapeProfiles } from '@/server/services/apify';
import { filterUsernames } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { TikTokRequest, ScoredInfluencer } from '@/server/types';

export const maxDuration = 300;

// ── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_HASHTAGS = [
  'miami', 'miamilifestyle', 'miamifashion', 'miamimom', 'wynwood',
];

const TIKTOK_POSTS_LIMIT = 50; // more posts → more unique authors to cross-ref

// ── Preset campaign filters (Monisha Melwani) ───────────────────────────────
const PRESET = {
  genderAllowed: ['female', 'unknown'] as string[],
  ageAllowed:    ['25-34', '35-44', '45-60', 'unknown'] as string[],
  targetCity:    'miami',
};

function passesPresetFilter(s: ScoredInfluencer): boolean {
  if (s.gender && !PRESET.genderAllowed.includes(s.gender)) return false;
  if (s.estimatedAge && !PRESET.ageAllowed.includes(s.estimatedAge)) return false;
  const city = (s.inferredCity ?? '').toLowerCase().trim();
  if (city && city !== 'unknown' && !city.includes(PRESET.targetCity)) return false;
  if (s.gender === 'unknown' && s.estimatedAge === 'unknown' && s.score < 40) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { hashtags: rawHashtags }: TikTokRequest = await req.json();
    const hashtags = (rawHashtags && rawHashtags.length > 0) ? rawHashtags : DEFAULT_HASHTAGS;

    // ── PASO 2: TikTok scraper → unique author usernames ───────────────────
    console.log(`\n[tiktok-to-ig] ── PASO 2: TikTok scraper — [${hashtags.join(', ')}]`);
    const tiktokUsernames = await scrapeByTikTok(hashtags, TIKTOK_POSTS_LIMIT);

    // ── PASO 3: Username-level blocklist filter ────────────────────────────
    console.log(`[tiktok-to-ig] ── PASO 3: Username filter`);
    const candidates = filterUsernames(tiktokUsernames);
    console.log(`[tiktok-to-ig] Username filter: ${tiktokUsernames.length} → ${candidates.length} candidatos`);

    if (candidates.length === 0) {
      return NextResponse.json({
        influencers: [],
        stats: { hashtagPostsFound: tiktokUsernames.length, afterPreFilter: 0, afterProfileFilter: 0, afterPresetFilter: 0, final: 0 },
      });
    }

    // ── PASO 4: Instagram profile scraper ─────────────────────────────────
    console.log(`[tiktok-to-ig] ── PASO 4: Instagram profile scraper (${candidates.length} usernames)`);
    const profiles = await scrapeProfiles(candidates);
    console.log(`[tiktok-to-ig] Instagram found ${profiles.length}/${candidates.length} matching profiles`);

    // ── PASO 5a: Follower filter (30K-100K) ───────────────────────────────
    console.log(`[tiktok-to-ig] ── PASO 5a: Follower filter`);
    const filteredProfiles = postProfileFilter(profiles);
    console.log(`[tiktok-to-ig] Follower filter: ${profiles.length} → ${filteredProfiles.length}`);

    if (filteredProfiles.length === 0) {
      return NextResponse.json({
        influencers: [],
        stats: {
          hashtagPostsFound:  tiktokUsernames.length,
          afterPreFilter:     candidates.length,
          afterProfileFilter: 0,
          afterPresetFilter:  0,
          final:              0,
        },
      });
    }

    // ── PASO 5b: Gemini scoring + clasificación ────────────────────────────
    console.log(`[tiktok-to-ig] ── PASO 5b: Gemini scoring (${filteredProfiles.length} perfiles)`);

    const scored: ScoredInfluencer[] = [];
    for (const profile of filteredProfiles) {
      const result = await scoreInfluencer(profile, 0); // engagement calculated later
      scored.push({ ...profile, ...result, engagementRate: 0 });
      console.log(
        `[tiktok-to-ig] Scored @${profile.username} → ${result.score} | gender:${result.gender} age:${result.estimatedAge} city:${result.inferredCity}`
      );

      cacheInfluencer({
        username:        profile.username,
        full_name:       profile.fullName,
        profile_pic:     profile.profilePicUrl,
        bio:             profile.biography,
        followers_count: profile.followersCount,
        match_score:     result.score,
        ai_category:     result.niche,
        ai_reason:       result.reason,
      }).catch((err) => console.error(`[tiktok-to-ig] cacheInfluencer failed for @${profile.username}:`, err));

      await new Promise((r) => setTimeout(r, 4_000));
    }

    // ── PASO 6: Preset filter ──────────────────────────────────────────────
    const allScored      = [...scored].sort((a, b) => b.score - a.score);
    const presetFiltered = scored.filter(passesPresetFilter);
    console.log(`[tiktok-to-ig] Preset filter: ${scored.length} → ${presetFiltered.length}`);

    // ── PASO 7: Sort by score ──────────────────────────────────────────────
    const sorted = presetFiltered.sort((a, b) => b.score - a.score);
    console.log(`[tiktok-to-ig] ✓ Done — ${sorted.length} influencers ranked`);

    return NextResponse.json({
      influencers: sorted,
      allScored,
      stats: {
        hashtagPostsFound:  tiktokUsernames.length,
        afterPreFilter:     candidates.length,
        afterProfileFilter: filteredProfiles.length,
        afterPresetFilter:  presetFiltered.length,
        final:              sorted.length,
      },
    });
  } catch (err) {
    console.error('[tiktok-to-ig] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
