import axios from 'axios';
import { HashtagPost, InstagramProfile, UserPost } from '../types';

const BASE = 'https://api.apify.com/v2';

function token() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error('APIFY_TOKEN is not set');
  return t;
}

async function pollUntilDone(runId: string, timeoutMs = 1_080_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await axios.get(`${BASE}/actor-runs/${runId}?token=${token()}`);
    const run = data.data;

    if (run.status === 'SUCCEEDED') return run.defaultDatasetId as string;
    if (run.status === 'FAILED' || run.status === 'ABORTED') {
      throw new Error(`Apify run ${runId} ended with status: ${run.status}`);
    }

    await new Promise((r) => setTimeout(r, 4_000));
  }

  throw new Error(`Apify run ${runId} did not complete within ${timeoutMs / 1000}s`);
}

async function startAndWait(actorId: string, input: Record<string, unknown>): Promise<string> {
  const { data } = await axios.post(
    `${BASE}/acts/${actorId}/runs?token=${token()}&waitForFinish=120`,
    input
  ).catch((err: unknown) => {
    if (axios.isAxiosError(err)) {
      console.error(`[apify] 400 body for ${actorId}:`, JSON.stringify(err.response?.data));
    }
    throw err;
  });

  const run = data.data;
  if (run.status === 'SUCCEEDED') return run.defaultDatasetId as string;

  console.log(`[apify] Run ${run.id} still running after 120s — polling...`);
  return pollUntilDone(run.id as string);
}

async function fetchDataset<T>(datasetId: string): Promise<T[]> {
  const { data } = await axios.get(
    `${BASE}/datasets/${datasetId}/items?token=${token()}&limit=200`
  );
  return (Array.isArray(data) ? data : data.items ?? []) as T[];
}

export async function scrapeHashtags(hashtags: string[], limitPerHashtag: number): Promise<HashtagPost[]> {
  console.log(`[apify] Hashtag scraper — hashtags: [${hashtags.join(', ')}], limit: ${limitPerHashtag} each`);

  const datasetId = await startAndWait('apify~instagram-hashtag-scraper', {
    hashtags,
    resultsLimit: limitPerHashtag,
  });

  const posts = await fetchDataset<HashtagPost>(datasetId);
  console.log(`[apify] Hashtag scraper returned ${posts.length} posts`);
  return posts;
}

export async function scrapeProfiles(usernames: string[]): Promise<InstagramProfile[]> {
  console.log(`[apify] Profile scraper — ${usernames.length} usernames`);

  const datasetId = await startAndWait('apify~instagram-profile-scraper', { usernames });

  const profiles = await fetchDataset<InstagramProfile>(datasetId);
  console.log(`[apify] Profile scraper returned ${profiles.length} profiles`);
  return profiles;
}

// ── Miami Discovery hashtags ────────────────────────────────────────────────
// Location-specific hashtags still active on Instagram — more reliable than
// scraping location pages (which Instagram has restricted heavily).
const MIAMI_DISCOVERY_HASHTAGS = [
  'miamigirl',
  'miamilifestyle',
  'miamiblogger',
  'wynwoodmiami',
  'brickellmiami',
  'southbeachmiami',
  'miamilife',
  'miamibeach',
];

export async function scrapeByMiamiLocations(limit: number): Promise<HashtagPost[]> {
  const perHashtag = Math.ceil(limit / MIAMI_DISCOVERY_HASHTAGS.length);

  console.log(
    `[apify] Miami Discovery — ${MIAMI_DISCOVERY_HASHTAGS.length} location hashtags, ~${perHashtag} posts each`
  );

  const datasetId = await startAndWait('apify~instagram-hashtag-scraper', {
    hashtags:     MIAMI_DISCOVERY_HASHTAGS,
    resultsLimit: perHashtag,
  });

  const posts = await fetchDataset<HashtagPost>(datasetId);
  console.log(`[apify] Miami Discovery returned ${posts.length} posts`);
  return posts;
}

// ── TikTok scraper ──────────────────────────────────────────────────────────
// Returns unique author usernames from TikTok posts matching the given hashtags.
// These usernames are then cross-referenced against Instagram profiles.

interface TikTokRawPost {
  authorMeta?: { name?: string; nickName?: string };
  author?:     string | { uniqueId?: string };
  text?:       string;
  desc?:       string;
}

export async function scrapeByTikTok(hashtags: string[], limit: number): Promise<string[]> {
  const perHashtag = Math.ceil(limit / hashtags.length);
  console.log(`[apify] TikTok scraper — hashtags: [${hashtags.join(', ')}], ~${perHashtag} per tag`);

  const datasetId = await startAndWait('clockworks~tiktok-scraper', {
    hashtags,
    resultsPerPage:             perHashtag,
    shouldDownloadVideos:       false,
    shouldDownloadCovers:       false,
    shouldDownloadSubtitles:    false,
    shouldDownloadSlideshowImages: false,
  });

  const posts = await fetchDataset<TikTokRawPost>(datasetId);
  console.log(`[apify] TikTok scraper returned ${posts.length} posts`);

  // Extract unique usernames — handle both scraper output shapes
  const seen = new Set<string>();
  for (const post of posts) {
    let username: string | undefined;

    if (post.authorMeta?.name) {
      username = post.authorMeta.name;
    } else if (typeof post.author === 'string') {
      username = post.author;
    } else if (typeof post.author === 'object' && post.author?.uniqueId) {
      username = post.author.uniqueId;
    }

    if (username) seen.add(username.replace(/^@/, '').toLowerCase());
  }

  const usernames = Array.from(seen);
  console.log(`[apify] TikTok scraper → ${usernames.length} unique authors`);
  return usernames;
}

export async function scrapeUserPosts(username: string, limit = 5): Promise<UserPost[]> {
  console.log(`[apify] Post scraper — @${username}, limit: ${limit}`);

  const datasetId = await startAndWait('apify~instagram-post-scraper', {
    username: [username],
    resultsLimit: limit,
  });

  const posts = await fetchDataset<UserPost>(datasetId);
  console.log(`[apify] Post scraper returned ${posts.length} posts for @${username}`);
  return posts;
}
