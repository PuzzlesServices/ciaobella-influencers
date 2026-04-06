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
