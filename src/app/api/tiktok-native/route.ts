import { NextRequest } from 'next/server';
import { scrapeByTikTokNative } from '@/server/services/apify';
import type { TikTokRawPostFull } from '@/server/services/apify';
import { filterUsernames } from '@/server/filters/preFilter';
import { scoreTikTokCreator } from '@/server/services/gemini';
import type { TikTokNativeRequest, TikTokCreator } from '@/server/types';

export const maxDuration = 300;

const DEFAULT_HASHTAGS = [
  'miami', 'miamilifestyle', 'miamifashion', 'miamimom', 'wynwood',
];

const POSTS_LIMIT     = 50;
const GEMINI_DELAY_MS = 2_000;

const MIN_FOLLOWERS  = 10_000;
const MIN_AVG_VIEWS  = 1_000;

function extractUsername(post: TikTokRawPostFull): string | undefined {
  if (post.authorMeta?.name) return post.authorMeta.name;
  if (typeof post.author === 'string') return post.author;
  if (typeof post.author === 'object' && post.author?.uniqueId) return post.author.uniqueId;
  return undefined;
}

function aggregateCreators(posts: TikTokRawPostFull[]): TikTokCreator[] {
  type CreatorAccum = {
    username: string;
    nickname: string;
    bio: string;
    followersCount: number;
    videosCount: number;
    profilePicUrl?: string;
    videos: { views: number; likes: number; comments: number; caption: string }[];
  };

  const map = new Map<string, CreatorAccum>();

  for (const post of posts) {
    const rawUsername = extractUsername(post);
    if (!rawUsername) continue;

    const username = rawUsername.replace(/^@/, '').toLowerCase();
    const existing = map.get(username);

    const videoEntry = {
      views:    post.playCount    ?? 0,
      likes:    post.diggCount    ?? 0,
      comments: post.commentCount ?? 0,
      caption:  post.text || post.desc || '',
    };

    if (!existing) {
      map.set(username, {
        username,
        nickname:       post.authorMeta?.nickName || rawUsername,
        bio:            post.authorMeta?.signature || '',
        followersCount: post.authorMeta?.fans    ?? 0,
        videosCount:    post.authorMeta?.video    ?? 0,
        profilePicUrl:  post.authorMeta?.avatar,
        videos:         [videoEntry],
      });
    } else {
      existing.videos.push(videoEntry);
      if (!existing.followersCount && post.authorMeta?.fans)      existing.followersCount = post.authorMeta.fans;
      if (!existing.nickname       && post.authorMeta?.nickName)  existing.nickname       = post.authorMeta.nickName;
      if (!existing.bio            && post.authorMeta?.signature) existing.bio            = post.authorMeta.signature;
      if (!existing.profilePicUrl  && post.authorMeta?.avatar)    existing.profilePicUrl  = post.authorMeta.avatar;
    }
  }

  const creators: TikTokCreator[] = [];
  for (const [, data] of map) {
    const { videos, ...rest } = data;
    const avgViews    = videos.reduce((s, v) => s + v.views,    0) / videos.length;
    const avgLikes    = videos.reduce((s, v) => s + v.likes,    0) / videos.length;
    const avgComments = videos.reduce((s, v) => s + v.comments, 0) / videos.length;
    const engagementRate =
      rest.followersCount > 0
        ? ((avgLikes + avgComments) / rest.followersCount) * 100
        : 0;
    const topCaptions = [...videos]
      .sort((a, b) => b.views - a.views)
      .slice(0, 3)
      .map((v) => v.caption)
      .filter(Boolean);

    creators.push({ ...rest, avgViews, avgLikes, avgComments, engagementRate, topCaptions });
  }

  return creators;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        const { hashtags: rawHashtags }: TikTokNativeRequest = await req.json();
        const hashtags = rawHashtags && rawHashtags.length > 0 ? rawHashtags : DEFAULT_HASHTAGS;

        // ── STEP 1: Scrape TikTok posts ────────────────────────────────────────
        console.log(`\n[tiktok-native] ── STEP 1: TikTok scraper — [${hashtags.join(', ')}]`);
        const posts = await scrapeByTikTokNative(hashtags, POSTS_LIMIT);
        console.log(`[tiktok-native] Raw posts: ${posts.length}`);

        // ── STEP 2: Aggregate posts by creator ────────────────────────────────
        console.log('[tiktok-native] ── STEP 2: Aggregating by creator');
        const allCreators = aggregateCreators(posts);
        console.log(`[tiktok-native] Unique creators: ${allCreators.length}`);

        // ── STEP 3: Pre-filter ────────────────────────────────────────────────
        console.log('[tiktok-native] ── STEP 3: Filtering creators');
        const usernames    = allCreators.map((c) => c.username);
        const allowedNames = new Set(filterUsernames(usernames));
        const filtered     = allCreators.filter(
          (c) =>
            allowedNames.has(c.username) &&
            c.followersCount >= MIN_FOLLOWERS &&
            c.avgViews >= MIN_AVG_VIEWS,
        );
        console.log(`[tiktok-native] After filter: ${allCreators.length} → ${filtered.length}`);

        const stats = {
          hashtagPostsFound:  posts.length,
          afterPreFilter:     allCreators.length,
          afterProfileFilter: filtered.length,
        };

        if (filtered.length === 0) {
          send({ type: 'complete', stats: { ...stats, afterPresetFilter: 0, final: 0 } });
          controller.close();
          return;
        }

        // ── STEP 4: Send all profiled creators immediately ────────────────────
        send({ type: 'profiled', creators: filtered, stats });

        // ── STEP 5: Gemini scoring — one event per creator ────────────────────
        console.log(`[tiktok-native] ── STEP 4: Gemini scoring (${filtered.length} creators)`);
        for (const creator of filtered) {
          try {
            const result = await scoreTikTokCreator(creator);
            console.log(
              `[tiktok-native] Scored @${creator.username} → ${result.score} | gender:${result.gender} age:${result.estimatedAge} city:${result.inferredCity}`,
            );
            send({
              type:         'scored',
              username:     creator.username,
              score:        result.score,
              label:        result.label,
              niche:        result.niche,
              gender:       result.gender,
              estimatedAge: result.estimatedAge,
              inferredCity: result.inferredCity,
            });
          } catch (err) {
            console.warn(`[tiktok-native] Gemini failed for @${creator.username}:`, (err as Error).message);
          }
          await new Promise((r) => setTimeout(r, GEMINI_DELAY_MS));
        }

        send({ type: 'complete', stats });
        console.log(`[tiktok-native] ✓ Done`);
        controller.close();

      } catch (err) {
        console.error('[tiktok-native] Error:', err);
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
