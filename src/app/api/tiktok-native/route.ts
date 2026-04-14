import { NextRequest, NextResponse } from 'next/server';
import { scrapeByTikTokNative, TikTokRawPostFull } from '@/server/services/apify';
import { filterUsernames } from '@/server/filters/preFilter';
import { scoreTikTokCreator } from '@/server/services/gemini';
import { TikTokNativeRequest, TikTokCreator, ScoredTikTokCreator } from '@/server/types';

export const maxDuration = 300;

const DEFAULT_HASHTAGS = [
  'miami', 'miamilifestyle', 'miamifashion', 'miamimom', 'wynwood',
];

const POSTS_LIMIT = 150;

// Min thresholds to qualify as a creator worth evaluating
const MIN_FOLLOWERS  = 10_000;
const MIN_AVG_VIEWS  = 1_000;

const PRESET = {
  genderAllowed: ['female', 'unknown'] as string[],
  ageAllowed:    ['25-34', '35-44', '45-60', 'unknown'] as string[],
  targetCity:    'miami',
};

function passesPresetFilter(s: ScoredTikTokCreator): boolean {
  if (s.gender && !PRESET.genderAllowed.includes(s.gender)) return false;
  if (s.estimatedAge && !PRESET.ageAllowed.includes(s.estimatedAge)) return false;
  const city = (s.inferredCity ?? '').toLowerCase().trim();
  if (city && city !== 'unknown' && !city.includes(PRESET.targetCity)) return false;
  if (s.gender === 'unknown' && s.estimatedAge === 'unknown' && s.score < 40) return false;
  return true;
}

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
        nickname:      post.authorMeta?.nickName || rawUsername,
        bio:           post.authorMeta?.signature || '',
        followersCount: post.authorMeta?.fans    ?? 0,
        videosCount:   post.authorMeta?.video    ?? 0,
        profilePicUrl: post.authorMeta?.avatar,
        videos:        [videoEntry],
      });
    } else {
      existing.videos.push(videoEntry);
      // Update author fields if we got richer data on a later post
      if (!existing.followersCount && post.authorMeta?.fans)     existing.followersCount = post.authorMeta.fans;
      if (!existing.nickname       && post.authorMeta?.nickName) existing.nickname       = post.authorMeta.nickName;
      if (!existing.bio            && post.authorMeta?.signature) existing.bio           = post.authorMeta.signature;
      if (!existing.profilePicUrl  && post.authorMeta?.avatar)   existing.profilePicUrl  = post.authorMeta.avatar;
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

    // ── STEP 3: Username blocklist + follower/view thresholds ─────────────
    console.log('[tiktok-native] ── STEP 3: Filtering creators');
    const usernames     = allCreators.map((c) => c.username);
    const allowedNames  = new Set(filterUsernames(usernames));
    const filtered      = allCreators.filter(
      (c) =>
        allowedNames.has(c.username) &&
        c.followersCount >= MIN_FOLLOWERS &&
        c.avgViews >= MIN_AVG_VIEWS,
    );
    console.log(`[tiktok-native] After filter: ${allCreators.length} → ${filtered.length}`);

    if (filtered.length === 0) {
      return NextResponse.json({
        influencers: [],
        allScored: [],
        stats: { hashtagPostsFound: posts.length, afterPreFilter: allCreators.length, afterProfileFilter: 0, afterPresetFilter: 0, final: 0 },
      });
    }

    // ── STEP 4: Gemini scoring ─────────────────────────────────────────────
    console.log(`[tiktok-native] ── STEP 4: Gemini scoring (${filtered.length} creators)`);
    const scored: ScoredTikTokCreator[] = [];
    for (const creator of filtered) {
      const result = await scoreTikTokCreator(creator);
      scored.push({ ...creator, ...result });
      console.log(
        `[tiktok-native] Scored @${creator.username} → ${result.score} | gender:${result.gender} age:${result.estimatedAge} city:${result.inferredCity}`,
      );
      await new Promise((r) => setTimeout(r, 4_000));
    }

    // ── STEP 5: Preset filter + sort ──────────────────────────────────────
    const allScored      = [...scored].sort((a, b) => b.score - a.score);
    const presetFiltered = scored.filter(passesPresetFilter);
    const sorted         = presetFiltered.sort((a, b) => b.score - a.score);
    console.log(`[tiktok-native] Preset filter: ${scored.length} → ${presetFiltered.length}`);
    console.log(`[tiktok-native] ✓ Done — ${sorted.length} creators ranked`);

    return NextResponse.json({
      influencers: sorted,
      allScored,
      stats: {
        hashtagPostsFound:  posts.length,
        afterPreFilter:     allCreators.length,
        afterProfileFilter: filtered.length,
        afterPresetFilter:  presetFiltered.length,
        final:              sorted.length,
      },
    });
  } catch (err) {
    console.error('[tiktok-native] Error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
