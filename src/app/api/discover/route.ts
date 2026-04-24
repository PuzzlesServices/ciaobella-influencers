import { NextRequest } from 'next/server';
import { scrapeByMiamiLocations, scrapeProfiles } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { DiscoverRequest } from '@/server/types';

export const maxDuration = 300;

const LOCATION_POSTS_LIMIT = 50;

export async function POST(req: NextRequest) {
  const { seeds = [], resultsType = 'posts' }: DiscoverRequest = await req.json();

  const cleanedSeeds = seeds.map((s) => s.replace(/^@/, '').trim()).filter(Boolean);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        // ── PASO 1: Scrape location posts ──────────────────────────────────
        console.log(`\n[discover] ── PASO 1: location scraper (${LOCATION_POSTS_LIMIT} ${resultsType})`);
        const posts = await scrapeByMiamiLocations(LOCATION_POSTS_LIMIT, resultsType);

        // ── PASO 2: Pre-filtro ─────────────────────────────────────────────
        const fromLocations = preFilter(posts);
        console.log(`[discover] Pre-filtro: ${posts.length} posts → ${fromLocations.length} candidatos`);

        const allCandidates = Array.from(new Set([...fromLocations, ...cleanedSeeds]));

        if (allCandidates.length === 0) {
          send({ type: 'complete', stats: { hashtagPostsFound: posts.length, afterPreFilter: 0, afterQualityFilter: 0 } });
          controller.close();
          return;
        }

        // ── PASO 3: Profile scraper ────────────────────────────────────────
        console.log(`[discover] ── PASO 3: Profile scraper (${allCandidates.length} candidatos)`);
        const profiles = await scrapeProfiles(allCandidates);

        // ── PASO 4: Quality filter (sin rango de seguidores — es client-side) ──
        const qualityFiltered = postProfileFilter(profiles);
        console.log(`[discover] Quality filter: ${profiles.length} → ${qualityFiltered.length} perfiles`);

        // ── Enviar todos los perfiles al cliente de inmediato ──────────────
        send({
          type: 'profiled',
          profiles: qualityFiltered,
          stats: {
            hashtagPostsFound:  posts.length,
            afterPreFilter:     allCandidates.length,
            afterQualityFilter: qualityFiltered.length,
          },
        });

        if (qualityFiltered.length === 0) {
          send({ type: 'complete', stats: { hashtagPostsFound: posts.length, afterPreFilter: allCandidates.length, afterQualityFilter: 0 } });
          controller.close();
          return;
        }

        // ── PASO 5: Gemini scoring — un evento por perfil ─────────────────
        console.log(`[discover] ── PASO 5: Scoring ${qualityFiltered.length} perfiles con Gemini`);

        for (const profile of qualityFiltered) {
          const postData = posts.find(
            (p) => p.ownerUsername.toLowerCase() === profile.username.toLowerCase()
          );
          const engagementRate =
            profile.followersCount > 0 && postData
              ? ((postData.likesCount + postData.commentsCount) / profile.followersCount) * 100
              : 0;

          const result = await scoreInfluencer(profile, engagementRate);
          console.log(
            `[discover] Scored @${profile.username} → ${result.score} (${result.label}) | gender:${result.gender} age:${result.estimatedAge} city:${result.inferredCity}`
          );

          // Enviar score individual para que el card se actualice en tiempo real
          send({
            type:          'scored',
            username:      profile.username,
            score:         result.score,
            label:         result.label,
            niche:         result.niche,
            gender:        result.gender,
            estimatedAge:  result.estimatedAge,
            inferredCity:  result.inferredCity,
            engagementRate,
          });

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

        send({ type: 'complete', stats: { hashtagPostsFound: posts.length, afterPreFilter: allCandidates.length, afterQualityFilter: qualityFiltered.length } });
        console.log(`[discover] ✓ Done`);

        controller.close();
      } catch (err) {
        console.error('[discover] Error:', err);
        send({ type: 'error', message: (err as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
