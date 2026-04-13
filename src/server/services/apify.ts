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

// ── Miami location IDs (Instagram / Facebook Places) ───────────────────────
// To find a location ID: search on Instagram, open the location page and
// grab the numeric ID from the URL:
// instagram.com/explore/locations/{ID}/
const MIAMI_LOCATION_IDS = [
  '213385402',      // Miami, Florida (city)
  '282397981',      // Miami Beach, Florida
  '1087110449285',  // Wynwood Arts District
  '362310950',      // Brickell, Miami
  '270623693',      // Coral Gables, Florida
  '109457785753',   // Design District, Miami
];

// Normalize posts from apify~instagram-scraper to match HashtagPost shape
function normalizePost(raw: Record<string, unknown>): HashtagPost {
  return {
    ownerUsername:  (raw.ownerUsername  ?? raw.owner_username  ?? '') as string,
    ownerFullName:  (raw.ownerFullName  ?? raw.owner_full_name ?? '') as string,
    caption:        (raw.caption        ?? raw.text            ?? '') as string,
    likesCount:     (raw.likesCount     ?? raw.likes_count     ?? 0)  as number,
    commentsCount:  (raw.commentsCount  ?? raw.comments_count  ?? 0)  as number,
    hashtags:       (Array.isArray(raw.hashtags) ? raw.hashtags : []) as string[],
    timestamp:      (raw.timestamp      ?? raw.created_at      ?? '') as string,
    url:            (raw.url            ?? raw.shortCode
                      ? `https://www.instagram.com/p/${raw.shortCode}/`
                      : undefined) as string | undefined,
  };
}

export async function scrapeByMiamiLocations(limit: number): Promise<HashtagPost[]> {
  const perLocation = Math.ceil(limit / MIAMI_LOCATION_IDS.length);
  const directUrls  = MIAMI_LOCATION_IDS.map(
    (id) => `https://www.instagram.com/explore/locations/${id}/`
  );

  console.log(
    `[apify] Location scraper — ${MIAMI_LOCATION_IDS.length} Miami locations, ~${perLocation} posts each`
  );

  const datasetId = await startAndWait('apify~instagram-scraper', {
    directUrls,
    resultsType:    'posts',
    resultsLimit:   perLocation,
    addParentData:  false,
  });

  const raw = await fetchDataset<Record<string, unknown>>(datasetId);
  const posts = raw.map(normalizePost).filter((p) => p.ownerUsername);
  console.log(`[apify] Location scraper returned ${posts.length} posts`);
  return posts;
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
