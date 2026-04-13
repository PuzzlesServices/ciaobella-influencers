import { NextRequest, NextResponse } from 'next/server';
import { scrapeByMiamiLocations, scrapeProfiles } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { DiscoverRequest, ScoredInfluencer } from '@/server/types';

export const maxDuration = 300;

// ── Preset campaign filters (Monisha Melwani) ───────────────────────────────
const PRESET = {
  locationPostsLimit: 50,
  genderAllowed:      ['female', 'unknown'] as string[],
  ageAllowed:         ['25-34', '35-44', '45-60', 'unknown'] as string[],
  targetCity:         'miami',
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
    const { seeds = [] }: DiscoverRequest = await req.json();

    const cleanedSeeds = seeds
      .map((s) => s.replace(/^@/, '').trim())
      .filter(Boolean);

    // ── PASO 2: Scrape Miami location posts ─────────────────────────────────
    console.log(`\n[discover] ── PASO 2: Miami location scraper (${PRESET.locationPostsLimit} posts)`);
    const posts = await scrapeByMiamiLocations(PRESET.locationPostsLimit);

    // ── PASO 3: Pre-filtro → candidateUsernames ────────────────────────────
    console.log(`[discover] ── PASO 3: Pre-filtro`);
    const fromLocations = preFilter(posts);
    console.log(`[discover] Pre-filtro: ${posts.length} posts → ${fromLocations.length} candidatos`);

    // ── Merge seeds (bypass geotag, enter pipeline directly) ────────────────
    const allCandidates = Array.from(new Set([...fromLocations, ...cleanedSeeds]));
    if (cleanedSeeds.length > 0) {
      console.log(`[discover] Seeds añadidos: ${cleanedSeeds.join(', ')} → total candidatos: ${allCandidates.length}`);
    }

    if (allCandidates.length === 0) {
      return NextResponse.json({
        influencers: [],
        stats: { hashtagPostsFound: posts.length, afterPreFilter: 0, afterProfileFilter: 0, afterPresetFilter: 0, final: 0 },
      });
    }

    // ── PASO 4: Apify Profile Scraper ──────────────────────────────────────
    console.log(`[discover] ── PASO 4: Profile scraper (${allCandidates.length} perfiles)`);
    const profiles = await scrapeProfiles(allCandidates);

    // ── PASO 5a: Filtro post-perfil (followers 30K-100K) ───────────────────
    console.log(`[discover] ── PASO 5a: Post-profile filter`);
    const filteredProfiles = postProfileFilter(profiles);
    console.log(`[discover] Post-filtro: ${profiles.length} → ${filteredProfiles.length} perfiles`);

    if (filteredProfiles.length === 0) {
      return NextResponse.json({
        influencers: [],
        stats: {
          hashtagPostsFound:  posts.length,
          afterPreFilter:     allCandidates.length,
          afterProfileFilter: 0,
          afterPresetFilter:  0,
          final:              0,
        },
      });
    }

    // ── PASO 5b: Gemini scoring + clasificación ────────────────────────────
    console.log(`[discover] ── PASO 5b: Scoring ${filteredProfiles.length} perfiles con Gemini`);

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
        `[discover] Scored @${profile.username} → ${result.score} (${result.label}) | gender:${result.gender} age:${result.estimatedAge} city:${result.inferredCity}`
      );

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
      }).catch((err) => console.error(`[discover] cacheInfluencer failed for @${profile.username}:`, err));

      await new Promise((r) => setTimeout(r, 4_000));
    }

    // ── PASO 6: Preset filter ──────────────────────────────────────────────
    const presetFiltered = scored.filter(passesPresetFilter);
    console.log(
      `[discover] Preset filter: ${scored.length} → ${presetFiltered.length} (female · 25-60 · Miami)`
    );

    // ── PASO 7: Sort by score ──────────────────────────────────────────────
    const sorted = presetFiltered.sort((a, b) => b.score - a.score);
    console.log(`[discover] ✓ Done — ${sorted.length} influencers ranked`);

    return NextResponse.json({
      influencers: sorted,
      stats: {
        hashtagPostsFound:  posts.length,
        afterPreFilter:     allCandidates.length,
        afterProfileFilter: filteredProfiles.length,
        afterPresetFilter:  presetFiltered.length,
        final:              sorted.length,
      },
    });
  } catch (err) {
    console.error('[discover] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
