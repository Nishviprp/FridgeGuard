-- ─────────────────────────────────────────────────────────────────
-- FridgeGuard — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────

-- ── items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Other',
  quantity      TEXT,
  purchase_date DATE,
  expiry_date   DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'fresh'
                  CHECK (status IN ('fresh','soon','today','expired','used')),
  avg_cost      NUMERIC(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items: own rows only" ON items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_items_user_expiry ON items(user_id, expiry_date);
CREATE INDEX idx_items_user_status ON items(user_id, status);

-- ── reminders ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  remind_days_before  INTEGER NOT NULL DEFAULT 2,
  notified            BOOLEAN NOT NULL DEFAULT FALSE,
  remind_at           DATE,
  UNIQUE(item_id)
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders: own rows only" ON reminders
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── settings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  value     TEXT,
  UNIQUE (user_id, key)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: own rows only" ON settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── notification_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id   UUID REFERENCES items(id) ON DELETE SET NULL,
  message   TEXT NOT NULL,
  sent_at   TIMESTAMPTZ DEFAULT NOW(),
  read      BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: own rows only" ON notification_log
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notif_user_read ON notification_log(user_id, read);

-- ── push_subscriptions ───────────────────────────────────────────
-- Stores Web Push subscriptions for background notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions: own rows only" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Helper: auto-update item statuses ────────────────────────────
-- Run this function on a schedule or call it from the edge function
CREATE OR REPLACE FUNCTION refresh_item_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  UPDATE items SET status = CASE
    WHEN expiry_date < today                        THEN 'expired'
    WHEN expiry_date = today                        THEN 'today'
    WHEN expiry_date <= today + INTERVAL '5 days'  THEN 'soon'
    ELSE 'fresh'
  END
  WHERE status NOT IN ('used');
END;
$$;
