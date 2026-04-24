import { NextRequest } from 'next/server';
import { scrapeHashtags, scrapeProfiles } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { SearchRequest } from '@/server/types';

export const maxDuration = 300;

const POSTS_LIMIT_DEFAULT = 100;

export async function POST(req: NextRequest) {
  const { hashtags: rawHashtags, resultsType = 'posts', postsLimit }: SearchRequest = await req.json();

  if (!rawHashtags || (Array.isArray(rawHashtags) && rawHashtags.length === 0)) {
    return new Response(JSON.stringify({ error: 'hashtags is required' }), { status: 400 });
  }

  const hashtagList     = Array.isArray(rawHashtags) ? rawHashtags : [rawHashtags];
  const totalLimit      = postsLimit ?? POSTS_LIMIT_DEFAULT;
  const limitPerHashtag = Math.ceil(totalLimit / hashtagList.length);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }
        catch { /* client disconnected */ }
      };

      try {
        // PASO 1: Hashtag scraper
        console.log(`\n[search] ── PASO 1: Hashtag scraper (${totalLimit} posts, type: ${resultsType})`);
        const posts = await scrapeHashtags(hashtagList, limitPerHashtag, resultsType);

        // PASO 2: Pre-filtro
        const candidates = preFilter(posts);
        console.log(`[search] Pre-filtro: ${posts.length} posts → ${candidates.length} candidatos`);

        if (candidates.length === 0) {
          send({ type: 'complete', stats: { hashtagPostsFound: posts.length, afterPreFilter: 0, afterQualityFilter: 0 } });
          controller.close();
          return;
        }

        // PASO 3: Profile scraper
        console.log(`[search] ── PASO 3: Profile scraper (${candidates.length} perfiles)`);
        const profiles = await scrapeProfiles(candidates);

        // PASO 4: Quality filter (sin rango de seguidores — client-side)
        const quality = postProfileFilter(profiles);
        console.log(`[search] Quality filter: ${profiles.length} → ${quality.length} perfiles`);

        send({
          type: 'profiled',
          profiles: quality,
          stats: { hashtagPostsFound: posts.length, afterPreFilter: candidates.length, afterQualityFilter: quality.length },
        });

        if (quality.length === 0) {
          send({ type: 'complete', stats: { hashtagPostsFound: posts.length, afterPreFilter: candidates.length, afterQualityFilter: 0 } });
          controller.close();
          return;
        }

        // PASO 5: Gemini scoring — evento por perfil
        console.log(`[search] ── PASO 5: Scoring ${quality.length} perfiles`);

        for (const profile of quality) {
          const postData = posts.find(
            (p) => p.ownerUsername.toLowerCase() === profile.username.toLowerCase()
          );
          const engagementRate =
            profile.followersCount > 0 && postData
              ? ((postData.likesCount + postData.commentsCount) / profile.followersCount) * 100
              : 0;

          const result = await scoreInfluencer(profile, engagementRate);
          console.log(`[search] Scored @${profile.username} → ${result.score} (${result.label})`);

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
          }).catch((err) => console.error(`[search] cacheInfluencer failed:`, err));

          await new Promise((r) => setTimeout(r, 4_000));
        }

        send({ type: 'complete', stats: { hashtagPostsFound: posts.length, afterPreFilter: candidates.length, afterQualityFilter: quality.length } });
        console.log(`[search] ✓ Done`);
        controller.close();

      } catch (err) {
        console.error('[search] Error:', err);
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
