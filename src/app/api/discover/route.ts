import { NextRequest, NextResponse } from 'next/server';
import { scrapeByMiamiLocations, scrapeProfiles } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { DiscoverRequest, DiscoverFilters, ScoredInfluencer } from '@/server/types';

export const maxDuration = 300;

const LOCATION_POSTS_LIMIT = 50;

function resolveGenderAllowed(gender?: DiscoverFilters['gender']): string[] {
  if (!gender || gender === 'any') return ['female', 'male', 'unknown'];
  if (gender === 'male') return ['male', 'unknown'];
  return ['female', 'unknown'];
}

function resolveAgeBuckets(min = 25, max = 60): string[] {
  const buckets: string[] = ['unknown'];
  if (min <= 24) buckets.push('under25');
  if (min <= 34 && max >= 25) buckets.push('25-34');
  if (min <= 44 && max >= 35) buckets.push('35-44');
  if (min <= 60 && max >= 45) buckets.push('45-60');
  if (max > 60) buckets.push('over60');
  return buckets;
}

function buildPassesFilter(genderAllowed: string[], ageAllowed: string[], targetCity: string) {
  return function passesFilter(s: ScoredInfluencer): boolean {
    if (s.gender && !genderAllowed.includes(s.gender)) return false;
    if (s.estimatedAge && !ageAllowed.includes(s.estimatedAge)) return false;
    const city = (s.inferredCity ?? '').toLowerCase().trim();
    if (city && city !== 'unknown' && !city.includes(targetCity)) return false;
    if (s.gender === 'unknown' && s.estimatedAge === 'unknown' && s.score < 40) return false;
    return true;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { seeds = [], filters }: DiscoverRequest = await req.json();

    const followersMin  = filters?.followersMin ?? 30_000;
    const followersMax  = filters?.followersMax ?? 100_000;
    const targetCity    = (filters?.city ?? 'miami').toLowerCase().trim();
    const genderAllowed = resolveGenderAllowed(filters?.gender);
    const ageAllowed    = resolveAgeBuckets(filters?.ageMin, filters?.ageMax);
    const passesFilter  = buildPassesFilter(genderAllowed, ageAllowed, targetCity);

    const cleanedSeeds = seeds
      .map((s) => s.replace(/^@/, '').trim())
      .filter(Boolean);

    // ── PASO 2: Scrape location posts ───────────────────────────────────────
    console.log(`\n[discover] ── PASO 2: location scraper (${LOCATION_POSTS_LIMIT} posts, city: ${targetCity})`);
    const posts = await scrapeByMiamiLocations(LOCATION_POSTS_LIMIT);

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

    // ── PASO 5a: Filtro post-perfil (followers range) ─────────────────────
    console.log(`[discover] ── PASO 5a: Post-profile filter (${followersMin/1000}K–${followersMax/1000}K)`);
    const filteredProfiles = postProfileFilter(profiles, followersMin, followersMax);
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

    // ── PASO 6: Filter ─────────────────────────────────────────────────────
    const allScored      = [...scored].sort((a, b) => b.score - a.score);
    const presetFiltered = scored.filter(passesFilter);
    console.log(
      `[discover] Filter: ${scored.length} → ${presetFiltered.length} (gender:${genderAllowed.join('/')} · age:${ageAllowed.filter(a=>a!=='unknown').join('/')} · ${targetCity})`
    );

    // ── PASO 7: Sort by score ──────────────────────────────────────────────
    const sorted = presetFiltered.sort((a, b) => b.score - a.score);
    console.log(`[discover] ✓ Done — ${sorted.length} influencers ranked`);

    return NextResponse.json({
      influencers: sorted,
      allScored,
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
