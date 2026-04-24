import { NextRequest } from 'next/server';
import { scrapeByMiamiLocations, scrapeHashtags, scrapeProfiles } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { DiscoverRequest, HashtagPost } from '@/server/types';

export const maxDuration = 300;

const LOCATION_POSTS_LIMIT = 50;

export async function POST(req: NextRequest) {
  const {
    seeds = [],
    resultsType = 'posts',
    mode = 'hashtag',
    customHashtags = [],
    usernames: requestUsernames = [],
  }: DiscoverRequest = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        let candidateUsernames: string[] = [];
        let postsForEngagement: HashtagPost[] = [];
        const stats = { hashtagPostsFound: 0, afterPreFilter: 0, afterQualityFilter: 0 };

        if (mode === 'username') {
          // ── Modo username: lookup directo, sin hashtag scraping ────────────
          const cleaned = requestUsernames.map((u) => u.replace(/^@/, '').trim()).filter(Boolean);
          if (cleaned.length === 0) {
            send({ type: 'error', message: 'No usernames provided' });
            controller.close();
            return;
          }
          console.log(`\n[discover] ── Modo @username: ${cleaned.length} usernames`);
          candidateUsernames  = cleaned;
          stats.afterPreFilter = cleaned.length;

        } else {
          // ── Modo hashtag: scrape → preFilter → combinar seeds ──────────────
          const cleanedSeeds = seeds.map((s) => s.replace(/^@/, '').trim()).filter(Boolean);

          let posts: HashtagPost[];
          if (customHashtags.length > 0) {
            const perTag = Math.ceil(LOCATION_POSTS_LIMIT / customHashtags.length);
            console.log(`\n[discover] ── Modo #hashtag custom (${customHashtags.join(', ')}), ${perTag} ${resultsType} c/u`);
            posts = await scrapeHashtags(customHashtags, perTag, resultsType);
          } else {
            console.log(`\n[discover] ── Modo #hashtag Miami defaults (${LOCATION_POSTS_LIMIT} ${resultsType})`);
            posts = await scrapeByMiamiLocations(LOCATION_POSTS_LIMIT, resultsType);
          }

          postsForEngagement  = posts;
          stats.hashtagPostsFound = posts.length;

          const fromLocations = preFilter(posts);
          console.log(`[discover] Pre-filtro: ${posts.length} posts → ${fromLocations.length} candidatos`);

          candidateUsernames  = Array.from(new Set([...fromLocations, ...cleanedSeeds]));
          stats.afterPreFilter = candidateUsernames.length;
        }

        if (candidateUsernames.length === 0) {
          send({ type: 'complete', stats });
          controller.close();
          return;
        }

        // ── Profile scraper (común a ambos modos) ─────────────────────────
        console.log(`[discover] ── Profile scraper (${candidateUsernames.length} candidatos)`);
        const profiles = await scrapeProfiles(candidateUsernames);

        // ── Quality filter ─────────────────────────────────────────────────
        const qualityFiltered = postProfileFilter(profiles);
        console.log(`[discover] Quality filter: ${profiles.length} → ${qualityFiltered.length} perfiles`);
        stats.afterQualityFilter = qualityFiltered.length;

        send({ type: 'profiled', profiles: qualityFiltered, stats });

        if (qualityFiltered.length === 0) {
          send({ type: 'complete', stats });
          controller.close();
          return;
        }

        // ── Gemini scoring — un evento por perfil ─────────────────────────
        console.log(`[discover] ── Scoring ${qualityFiltered.length} perfiles con Gemini`);

        for (const profile of qualityFiltered) {
          const postData = postsForEngagement.find(
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

        send({ type: 'complete', stats });
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
