import { NextRequest } from 'next/server';
import { scrapeByMiamiLocations, scrapeHashtags, scrapeProfiles, scrapeUserPosts } from '@/server/services/apify';
import { preFilter } from '@/server/filters/preFilter';
import { postProfileFilter } from '@/server/filters/postFilter';
import { scoreInfluencer } from '@/server/services/gemini';
import { cacheInfluencer } from '@/server/db/influencers';
import { DiscoverRequest, HashtagPost, UserPost } from '@/server/types';

export const maxDuration = 300;

const LOCATION_POSTS_LIMIT = 50;

export async function POST(req: NextRequest) {
  const {
    seeds = [],
    resultsType = 'posts',
    mode = 'hashtag',
    customHashtags = [],
    usernames: requestUsernames = [],
    seedUsername: requestSeedUsername = '',
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
        const stats: {
          hashtagPostsFound: number;
          afterPreFilter: number;
          afterQualityFilter: number;
          seedPostsAnalyzed?: number;
          relatedHashtags?: string[];
        } = { hashtagPostsFound: 0, afterPreFilter: 0, afterQualityFilter: 0 };

        // Límites para controlar el uso de Apify en modo similar
        const SIMILAR_SEED_POSTS    = 6;   // posts a scrapear del seed
        const SIMILAR_TOP_HASHTAGS  = 4;   // hashtags más usados del seed
        const SIMILAR_POSTS_PER_TAG = 10;  // posts por hashtag (~40 total)
        const SIMILAR_MAX_PROFILES  = 20;  // candidatos máximos a perfilar

        if (mode === 'username') {
          // ── Modo similar: analiza el seed → descubre cuentas similares ─────
          const seedUser = requestSeedUsername.replace(/^@/, '').trim()
            || requestUsernames[0]?.replace(/^@/, '').trim()
            || '';

          if (!seedUser) {
            send({ type: 'error', message: 'No seed username provided' });
            controller.close();
            return;
          }

          console.log(`\n[discover] ── Modo @similar: seed=${seedUser}`);

          // Paso 1: últimos posts del seed para extraer hashtags
          const seedPosts: UserPost[] = await scrapeUserPosts(seedUser, SIMILAR_SEED_POSTS);

          if (seedPosts.length === 0) {
            send({ type: 'error', message: `No se encontraron posts para @${seedUser}` });
            controller.close();
            return;
          }

          // Paso 2: frecuencia de hashtags (array del scraper + regex fallback en caption)
          const hashtagFreq: Record<string, number> = {};
          for (const post of seedPosts) {
            const tags: string[] =
              (post.hashtags && post.hashtags.length > 0)
                ? post.hashtags
                : ((post.caption ?? '').match(/#([\w]+)/g) ?? []).map((t) => t.slice(1));

            for (const raw of tags) {
              const t = raw.toLowerCase().replace(/^#/, '').trim();
              if (t) hashtagFreq[t] = (hashtagFreq[t] ?? 0) + 1;
            }
          }

          // Paso 3: top hashtags por frecuencia
          const relatedHashtags = Object.entries(hashtagFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, SIMILAR_TOP_HASHTAGS)
            .map(([tag]) => tag);

          console.log(`[discover] @${seedUser} — ${seedPosts.length} posts analizados, hashtags: [${relatedHashtags.join(', ')}]`);

          if (relatedHashtags.length === 0) {
            send({ type: 'error', message: `@${seedUser} no usa hashtags en sus posts recientes` });
            controller.close();
            return;
          }

          // Notificar al cliente los hashtags encontrados (antes del scraping pesado)
          stats.seedPostsAnalyzed = seedPosts.length;
          stats.relatedHashtags   = relatedHashtags;
          send({ type: 'hashtags_resolved', seedPostsAnalyzed: seedPosts.length, relatedHashtags });

          // Paso 4: scraping de hashtags relacionados (10 posts c/u, ~40 total)
          const posts = await scrapeHashtags(relatedHashtags, SIMILAR_POSTS_PER_TAG, 'posts');
          postsForEngagement      = posts;
          stats.hashtagPostsFound = posts.length;

          // Paso 5: preFilter + excluir el seed + cap de perfiles
          const fromHashtags = preFilter(posts)
            .filter((u) => u.toLowerCase() !== seedUser.toLowerCase());

          console.log(`[discover] Similar pre-filtro: ${posts.length} posts → ${fromHashtags.length} candidatos (excl. seed)`);

          candidateUsernames   = fromHashtags.slice(0, SIMILAR_MAX_PROFILES);
          stats.afterPreFilter = candidateUsernames.length;

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
