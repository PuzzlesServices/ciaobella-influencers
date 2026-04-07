import { getAdminClient } from '@/lib/supabase';

// ============================================================
// Types
// ============================================================

export type CampaignStatus = 'Lead' | 'Contacted' | 'Gifted' | 'Rejected';

export interface InfluencerRow {
  id: string;
  username: string;
  full_name: string | null;
  profile_pic: string | null;
  bio: string | null;
  followers_count: number | null;
  engagement_rate: number | null;
  match_score: number | null;
  ai_category: string | null;
  ai_reason: string | null;
  campaign_status: CampaignStatus;
  notes: string | null;
  is_saved: boolean;
  created_at: string;
  last_updated: string;
}

export interface CacheInfluencerInput {
  username: string;
  full_name?: string;
  profile_pic?: string;
  bio?: string;
  followers_count?: number;
  engagement_rate?: number;
  match_score?: number;
  ai_category?: string;
  ai_reason?: string;
}

// ============================================================
// cacheInfluencer
// Upserts scraper data without overwriting CRM fields
// (is_saved, campaign_status, notes).
// ============================================================

export async function cacheInfluencer(data: CacheInfluencerInput): Promise<InfluencerRow> {
  const db = getAdminClient();

  // 1. Attempt insert
  const { error: insertError } = await db.from('influencers').insert({
    username:        data.username,
    full_name:       data.full_name       ?? null,
    profile_pic:     data.profile_pic     ?? null,
    bio:             data.bio             ?? null,
    followers_count: data.followers_count ?? null,
    engagement_rate: data.engagement_rate ?? null,
    match_score:     data.match_score     ?? null,
    ai_category:     data.ai_category     ?? null,
    ai_reason:       data.ai_reason       ?? null,
    // CRM fields use their column defaults (is_saved=false, campaign_status='Lead')
  });

  // 2. On unique conflict (username already exists), update metrics only
  if (insertError) {
    if (insertError.code !== '23505') {
      // Unexpected error
      throw new Error(`[cacheInfluencer] insert failed: ${insertError.message}`);
    }

    const { data: updated, error: updateError } = await db
      .from('influencers')
      .update({
        full_name:       data.full_name       ?? null,
        profile_pic:     data.profile_pic     ?? null,
        bio:             data.bio             ?? null,
        followers_count: data.followers_count ?? null,
        engagement_rate: data.engagement_rate ?? null,
        match_score:     data.match_score     ?? null,
        ai_category:     data.ai_category     ?? null,
        ai_reason:       data.ai_reason       ?? null,
        // is_saved, campaign_status, notes are intentionally omitted
      })
      .eq('username', data.username)
      .select()
      .single();

    if (updateError) {
      throw new Error(`[cacheInfluencer] update failed: ${updateError.message}`);
    }

    return updated as InfluencerRow;
  }

  // 3. Fetch and return the newly inserted row
  const { data: inserted, error: fetchError } = await db
    .from('influencers')
    .select()
    .eq('username', data.username)
    .single();

  if (fetchError) {
    throw new Error(`[cacheInfluencer] fetch after insert failed: ${fetchError.message}`);
  }

  return inserted as InfluencerRow;
}

// ============================================================
// saveInfluencerToCampaign
// Marks a profile as explicitly saved by the client.
// ============================================================

export async function saveInfluencerToCampaign(username: string): Promise<InfluencerRow> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('influencers')
    .update({ is_saved: true })
    .eq('username', username)
    .select()
    .single();

  if (error) {
    throw new Error(`[saveInfluencerToCampaign] failed for @${username}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`[saveInfluencerToCampaign] @${username} not found in database`);
  }

  return data as InfluencerRow;
}

// ============================================================
// updateEngagementRate
// Called after scraping recent posts — stores the real engagement.
// ============================================================

export async function updateEngagementRate(username: string, engagementRate: number): Promise<void> {
  const db = getAdminClient();

  const { error } = await db
    .from('influencers')
    .update({ engagement_rate: engagementRate })
    .eq('username', username);

  if (error) {
    throw new Error(`[updateEngagementRate] failed for @${username}: ${error.message}`);
  }
}

// ============================================================
// unsaveInfluencer
// Marks a profile as no longer saved by the client.
// ============================================================

export async function unsaveInfluencer(username: string): Promise<void> {
  const db = getAdminClient();

  const { error } = await db
    .from('influencers')
    .update({ is_saved: false })
    .eq('username', username);

  if (error) {
    throw new Error(`[unsaveInfluencer] failed for @${username}: ${error.message}`);
  }
}

// ============================================================
// getTopSavedInfluencers
// Returns client-saved profiles, ranked by match score.
// ============================================================

export async function getTopSavedInfluencers(): Promise<InfluencerRow[]> {
  const db = getAdminClient();

  const { data, error } = await db
    .from('influencers')
    .select()
    .eq('is_saved', true)
    .order('match_score', { ascending: false });

  if (error) {
    throw new Error(`[getTopSavedInfluencers] query failed: ${error.message}`);
  }

  return (data ?? []) as InfluencerRow[];
}
