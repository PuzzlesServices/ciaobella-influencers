import { NextRequest } from 'next/server';
import { scrapeByTikTok, scrapeProfiles } from '@/server/services/apify';
import { filterUsernames } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { TikTokRequest } from '@/server/types';

export const maxDuration = 300;

const DEFAULT_HASHTAGS = [
  'miami', 'miamilifestyle', 'miamifashion', 'miamimom', 'wynwood',
];

const TIKTOK_POSTS_LIMIT = 50;

export async function POST(req: NextRequest) {
  const { hashtags: rawHashtags }: TikTokRequest = await req.json();
  const hashtags = (rawHashtags && rawHashtags.length > 0) ? rawHashtags : DEFAULT_HASHTAGS;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }
        catch { /* client disconnected */ }
      };

      try {
        // PASO 1: TikTok scraper → unique author usernames
        console.log(`\n[tiktok-to-ig] ── PASO 1: TikTok scraper — [${hashtags.join(', ')}]`);
        const tiktokUsernames = await scrapeByTikTok(hashtags, TIKTOK_POSTS_LIMIT);

        // PASO 2: Username-level blocklist filter
        console.log(`[tiktok-to-ig] ── PASO 2: Username filter`);
        const candidates = filterUsernames(tiktokUsernames);
        console.log(`[tiktok-to-ig] Username filter: ${tiktokUsernames.length} → ${candidates.length} candidatos`);

        if (candidates.length === 0) {
          send({ type: 'complete', stats: { hashtagPostsFound: tiktokUsernames.length, afterPreFilter: 0, afterQualityFilter: 0 } });
          controller.close();
          return;
        }

        // PASO 3: Instagram profile scraper
        console.log(`[tiktok-to-ig] ── PASO 3: Instagram profile scraper (${candidates.length} usernames)`);
        const profiles = await scrapeProfiles(candidates);
        console.log(`[tiktok-to-ig] Instagram found ${profiles.length}/${candidates.length} matching profiles`);

        // PASO 4: Quality filter
        const quality = postProfileFilter(profiles);
        console.log(`[tiktok-to-ig] Quality filter: ${profiles.length} → ${quality.length}`);

        send({
          type: 'profiled',
          profiles: quality,
          stats: { hashtagPostsFound: tiktokUsernames.length, afterPreFilter: candidates.length, afterQualityFilter: quality.length },
        });

        if (quality.length === 0) {
          send({ type: 'complete', stats: { hashtagPostsFound: tiktokUsernames.length, afterPreFilter: candidates.length, afterQualityFilter: 0 } });
          controller.close();
          return;
        }

        // PASO 5: Gemini scoring — one event per profile
        console.log(`[tiktok-to-ig] ── PASO 5: Scoring ${quality.length} perfiles`);

        for (const profile of quality) {
          const result = await scoreInfluencer(profile, 0);
          console.log(`[tiktok-to-ig] Scored @${profile.username} → ${result.score} (${result.label})`);

          send({
            type:          'scored',
            username:      profile.username,
            score:         result.score,
            label:         result.label,
            niche:         result.niche,
            gender:        result.gender,
            estimatedAge:  result.estimatedAge,
            inferredCity:  result.inferredCity,
            engagementRate: 0,
          });

          cacheInfluencer({
            username:        profile.username,
            full_name:       profile.fullName,
            profile_pic:     profile.profilePicUrl,
            bio:             profile.biography,
            followers_count: profile.followersCount,
            engagement_rate: 0,
            match_score:     result.score,
            ai_category:     result.niche,
            ai_reason:       result.reason,
          }).catch((err) => console.error(`[tiktok-to-ig] cacheInfluencer failed:`, err));

          await new Promise((r) => setTimeout(r, 4_000));
        }

        send({ type: 'complete', stats: { hashtagPostsFound: tiktokUsernames.length, afterPreFilter: candidates.length, afterQualityFilter: quality.length } });
        console.log(`[tiktok-to-ig] ✓ Done`);
        controller.close();

      } catch (err) {
        console.error('[tiktok-to-ig] Error:', err);
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
