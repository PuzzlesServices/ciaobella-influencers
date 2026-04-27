-- ============================================================
-- Ciao Bella — Salon, Day Spa & Wellness Center
-- Influencer Discovery Database
-- ============================================================

-- Campaign status enum
CREATE TYPE campaign_status_enum AS ENUM ('Lead', 'Contacted', 'Gifted', 'Rejected');

-- ============================================================
-- Main table
-- ============================================================
CREATE TABLE IF NOT EXISTS influencers (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identity
  username        text         UNIQUE NOT NULL,
  full_name       text,
  profile_pic     text,
  bio             text,

  -- Metrics (updated on every cache hit)
  followers_count integer,
  engagement_rate numeric(5, 2),

  -- AI fields (updated on every cache hit)
  match_score     integer      CHECK (match_score BETWEEN 0 AND 100),
  ai_category     text,
  ai_reason       text,

  -- CRM fields (NEVER overwritten by the scraper cache)
  campaign_status campaign_status_enum DEFAULT 'Lead' NOT NULL,
  notes           text,
  is_saved        boolean      DEFAULT false NOT NULL,

  -- Timestamps
  created_at      timestamptz  DEFAULT now() NOT NULL,
  last_updated    timestamptz  DEFAULT now() NOT NULL
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_influencers_is_saved    ON influencers (is_saved);
CREATE INDEX IF NOT EXISTS idx_influencers_match_score ON influencers (match_score DESC);

-- ============================================================
-- Trigger: auto-update last_updated on every UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_last_updated
  BEFORE UPDATE ON influencers
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_last_updated();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all rows
CREATE POLICY "authenticated_select"
  ON influencers FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert
CREATE POLICY "authenticated_insert"
  ON influencers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update
CREATE POLICY "authenticated_update"
  ON influencers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role bypasses RLS by default — no extra policy needed.
-- The server-side functions use the service role key.
