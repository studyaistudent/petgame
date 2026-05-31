-- ═══════════════════════════════════════════════════════════════
-- 러브몬 index.html → Supabase (PostgreSQL) 스키마
-- Firestore 컬렉션명과 동일한 테이블명 사용 (마이그레이션·코드 대응 용이)
-- Supabase Dashboard → SQL Editor 에서 전체 실행
-- ═══════════════════════════════════════════════════════════════

-- 확장 (UUID)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 공통: updated_at 자동 갱신 ──
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════
-- MBTI / 밸런스 / 소개팅
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mbti_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nick          TEXT NOT NULL,
  pin           TEXT,
  gender        TEXT,
  mbti          TEXT,
  time          TEXT,
  is_admin_checked BOOLEAN DEFAULT FALSE,
  extra         JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mbti_entries_nick ON public.mbti_entries (nick);
CREATE INDEX IF NOT EXISTS idx_mbti_entries_ts ON public.mbti_entries (created_at DESC);

CREATE TABLE IF NOT EXISTS public.balance_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nick          TEXT NOT NULL,
  gender        TEXT,
  answers       JSONB DEFAULT '{}'::jsonb,
  time          TEXT,
  extra         JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_balance_entries_nick ON public.balance_entries (nick);
CREATE INDEX IF NOT EXISTS idx_balance_entries_ts ON public.balance_entries (created_at DESC);

CREATE TABLE IF NOT EXISTS public.dating_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nick          TEXT NOT NULL,
  gender        TEXT,
  answers       JSONB DEFAULT '{}'::jsonb,
  time          TEXT,
  extra         JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dating_entries_nick ON public.dating_entries (nick);
CREATE INDEX IF NOT EXISTS idx_dating_entries_ts ON public.dating_entries (created_at DESC);

CREATE TABLE IF NOT EXISTS public.roses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender          TEXT NOT NULL,
  sender_gender   TEXT,
  receiver        TEXT NOT NULL,
  receiver_gender TEXT,
  date            TEXT NOT NULL,
  extra           JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_roses_date ON public.roses (date);
CREATE INDEX IF NOT EXISTS idx_roses_sender ON public.roses (sender, date);

CREATE TABLE IF NOT EXISTS public.mutual_roses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1         TEXT NOT NULL,
  user1_gender  TEXT,
  user2         TEXT NOT NULL,
  user2_gender  TEXT,
  date          TEXT NOT NULL,
  extra         JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mutual_roses_ts ON public.mutual_roses (created_at DESC);

-- ═══════════════════════════════════════
-- 러브몬 펫 (doc id = nick)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_pets (
  nick              TEXT PRIMARY KEY,
  gender            TEXT,
  mbti              TEXT,
  pet_emoji         TEXT,
  pet_name          TEXT,
  pet_desc          TEXT,
  level             INT DEFAULT 1,
  xp                INT DEFAULT 0,
  points            BIGINT DEFAULT 0,
  is_bred           BOOLEAN DEFAULT FALSE,
  last_login        TEXT,
  login_streak      INT DEFAULT 0,
  name_change_count INT DEFAULT 0,
  affection_map     JSONB DEFAULT '{}'::jsonb,
  iq                INT DEFAULT 100,
  dice_stats        JSONB,
  current_hp        INT,
  current_mp        INT,
  current_sp        INT,
  inventory         JSONB DEFAULT '{}'::jsonb,
  pet_inventory     JSONB DEFAULT '[]'::jsonb,
  equipment         JSONB DEFAULT '{}'::jsonb,
  pending_furniture JSONB DEFAULT '[]'::jsonb,
  daily_quests      JSONB,
  dungeon_kills           JSONB DEFAULT '{}'::jsonb,
  dungeon_battle_count    INT DEFAULT 0,
  dungeon_cooldown_start  BIGINT DEFAULT 0,
  rebirth_count     INT DEFAULT 0,
  active_card_skin  TEXT,
  active_title      TEXT,
  mafia_record      JSONB,
  oncard_record     JSONB,
  ow_data           JSONB,
  data              JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_pets_ts ON public.lm_pets (updated_at DESC);

-- ═══════════════════════════════════════
-- 글로벌 게임 상태 (doc id = doc_key)
-- color_chart | chosung_current | catchmind
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_game (
  doc_key     TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- 채팅 / 교배 / 가족 / 밥주기 로그
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_chat (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nick        TEXT NOT NULL,
  message     TEXT,
  is_correct  BOOLEAN,
  type        TEXT,
  extra       JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_chat_ts ON public.lm_chat (created_at DESC);

CREATE TABLE IF NOT EXISTS public.lm_breed_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_nick     TEXT NOT NULL,
  from_emoji    TEXT,
  from_pet_name TEXT,
  to_nick       TEXT NOT NULL,
  to_emoji      TEXT,
  to_pet_name   TEXT,
  status        TEXT DEFAULT 'pending',
  extra         JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_breed_status ON public.lm_breed_requests (status);

CREATE TABLE IF NOT EXISTS public.lm_family (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent1_nick    TEXT,
  parent1_emoji   TEXT,
  parent1_pet     TEXT,
  parent2_nick    TEXT,
  parent2_emoji   TEXT,
  parent2_pet     TEXT,
  child_emoji     TEXT,
  child_name      TEXT,
  child_desc      TEXT,
  extra           JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_family_ts ON public.lm_family (created_at DESC);

CREATE TABLE IF NOT EXISTS public.lm_feed_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_nick   TEXT NOT NULL,
  to_nick     TEXT NOT NULL,
  item        TEXT,
  emoji       TEXT,
  xp          INT DEFAULT 0,
  extra       JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_feed_logs_ts ON public.lm_feed_logs (created_at DESC);

-- ═══════════════════════════════════════
-- 2세 / 하우스 / 선물
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_baby_pets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent1_nick      TEXT,
  parent2_nick      TEXT,
  parent1_emoji     TEXT,
  parent2_emoji     TEXT,
  baby_emoji        TEXT,
  baby_name         TEXT,
  baby_desc         TEXT,
  hatch_time        BIGINT,
  hatch_reduction   INT DEFAULT 0,
  hatched           BOOLEAN DEFAULT FALSE,
  baby_level        INT DEFAULT 0,
  baby_xp           INT DEFAULT 0,
  baby_points       INT DEFAULT 0,
  baby_stats        JSONB,
  rarity            TEXT,
  feed_log          JSONB DEFAULT '[]'::jsonb,
  extra             JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_baby_pets_ts ON public.lm_baby_pets (created_at DESC);

CREATE TABLE IF NOT EXISTS public.lm_houses (
  nick              TEXT PRIMARY KEY,
  tier              TEXT DEFAULT 'basic',
  wallpaper         TEXT,
  floor             TEXT,
  furniture         JSONB DEFAULT '[]'::jsonb,
  inventory         JSONB DEFAULT '[]'::jsonb,
  visitors          INT DEFAULT 0,
  guestbook         JSONB DEFAULT '[]'::jsonb,
  is_open           BOOLEAN DEFAULT TRUE,
  pet_position      JSONB DEFAULT '{"x":0,"z":1,"rotY":0}'::jsonb,
  active_visitors   JSONB DEFAULT '{}'::jsonb,
  visitor_history   JSONB DEFAULT '[]'::jsonb,
  extra             JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_houses_ts ON public.lm_houses (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.lm_gifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_nick   TEXT NOT NULL,
  from_emoji  TEXT,
  to_nick     TEXT NOT NULL,
  type        TEXT,
  item_name   TEXT,
  item_emoji  TEXT,
  read        BOOLEAN DEFAULT FALSE,
  extra       JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_gifts_to ON public.lm_gifts (to_nick, read);

-- ═══════════════════════════════════════
-- 캐치마인드
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_cm_strokes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stroke_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_cm_strokes_ts ON public.lm_cm_strokes (created_at ASC);

CREATE TABLE IF NOT EXISTS public.lm_cm_guesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nick        TEXT NOT NULL,
  message     TEXT,
  is_correct  BOOLEAN DEFAULT FALSE,
  extra       JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_cm_guesses_ts ON public.lm_cm_guesses (created_at DESC);

-- ═══════════════════════════════════════
-- 마피아 / 경매
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_mafia_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name     TEXT,
  host          TEXT,
  status        TEXT DEFAULT 'waiting',
  players       JSONB DEFAULT '[]'::jsonb,
  chat_log      JSONB DEFAULT '[]'::jsonb,
  night_actions JSONB,
  day_votes     JSONB,
  extra         JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_mafia_updated ON public.lm_mafia_rooms (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.lm_auctions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_nick     TEXT NOT NULL,
  seller_emoji    TEXT,
  item_kind       TEXT,
  item            JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_price     BIGINT DEFAULT 0,
  bid_increment   BIGINT DEFAULT 0,
  current_bid     BIGINT DEFAULT 0,
  top_bidder      TEXT,
  top_bidder_emoji TEXT,
  bid_count       INT DEFAULT 0,
  ends_at         BIGINT NOT NULL,
  status          TEXT DEFAULT 'active',
  winner_nick     TEXT,
  settled_at      TIMESTAMPTZ,
  extra           JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_auctions_status ON public.lm_auctions (status, ends_at);

-- ═══════════════════════════════════════
-- 오픈월드 (위치 동기화 — 쓰기 많음)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_openworld_players (
  nick        TEXT PRIMARY KEY,
  emoji       TEXT,
  gender      TEXT,
  avatar      JSONB,
  height_cm   NUMERIC,
  x           NUMERIC,
  z           NUMERIC,
  rot_y       NUMERIC,
  state       TEXT,
  in_car      BOOLEAN DEFAULT FALSE,
  is_driver   BOOLEAN DEFAULT FALSE,
  chat_msg    TEXT,
  chat_expire BIGINT DEFAULT 0,
  ts          BIGINT,
  extra       JSONB DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_ow_players_ts ON public.lm_openworld_players (ts);

CREATE TABLE IF NOT EXISTS public.lm_openworld_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_nick       TEXT NOT NULL,
  from_emoji      TEXT,
  to_nick         TEXT NOT NULL,
  status          TEXT DEFAULT 'pending',
  participants    JSONB DEFAULT '[]'::jsonb,
  seller_offer    JSONB DEFAULT '[]'::jsonb,
  buyer_offer     JSONB DEFAULT '[]'::jsonb,
  seller_locked   BOOLEAN DEFAULT FALSE,
  buyer_locked    BOOLEAN DEFAULT FALSE,
  extra           JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_ow_trades_to ON public.lm_openworld_trades (to_nick, status);

CREATE TABLE IF NOT EXISTS public.lm_openworld_cars (
  doc_key     TEXT PRIMARY KEY DEFAULT 'shared',
  x           NUMERIC,
  z           NUMERIC,
  rot_y       NUMERIC,
  driver      TEXT,
  updated_at_ms BIGINT,
  data        JSONB DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lm_openworld_events (
  doc_key     TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- doc_key 예: ghost_raid | world_broadcast | undead_raid

-- ═══════════════════════════════════════
-- MMO 오픈월드 글로벌
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_ow_world_events (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at  BIGINT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lm_ow_world_events_started ON public.lm_ow_world_events (started_at DESC NULLS LAST);
-- id 예: global_active | firework_broadcast | (자동생성 UUID 문자열)

CREATE TABLE IF NOT EXISTS public.lm_ow_economy (
  doc_key     TEXT PRIMARY KEY DEFAULT 'global',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lm_ow_territories (
  id          TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lm_ow_world_boss (
  doc_key     TEXT PRIMARY KEY DEFAULT 'active',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lm_ow_house_trade (
  doc_key     TEXT PRIMARY KEY DEFAULT 'board',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════
-- updated_at 트리거
-- ═══════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mbti_entries','balance_entries','dating_entries',
    'lm_pets','lm_breed_requests','lm_baby_pets','lm_houses',
    'lm_mafia_rooms','lm_auctions','lm_openworld_players',
    'lm_openworld_trades','lm_openworld_cars','lm_openworld_events',
    'lm_ow_world_events','lm_ow_economy','lm_ow_territories',
    'lm_ow_world_boss','lm_ow_house_trade','lm_game'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ═══════════════════════════════════════
-- Realtime (Supabase 실시간 구독용)
-- Dashboard에서도 켤 수 있음
-- ═══════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mbti_entries','balance_entries','dating_entries','roses','mutual_roses',
    'lm_pets','lm_game','lm_chat','lm_breed_requests','lm_family','lm_feed_logs',
    'lm_baby_pets','lm_houses','lm_gifts','lm_cm_strokes','lm_cm_guesses',
    'lm_mafia_rooms','lm_auctions',
    'lm_openworld_players','lm_openworld_trades','lm_openworld_cars','lm_openworld_events',
    'lm_ow_world_events','lm_ow_economy','lm_ow_territories','lm_ow_world_boss','lm_ow_house_trade'
  ]
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        t
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ═══════════════════════════════════════
-- RLS 활성화 (정책은 별도 SQL)
-- 배포: supabase_rls_secure.sql 실행
-- 로컬/백업(전체 허용): backup/supabase_rls_dev_open.sql
-- ═══════════════════════════════════════

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mbti_entries','balance_entries','dating_entries','roses','mutual_roses',
    'lm_pets','lm_game','lm_chat','lm_breed_requests','lm_family','lm_feed_logs',
    'lm_baby_pets','lm_houses','lm_gifts','lm_cm_strokes','lm_cm_guesses',
    'lm_mafia_rooms','lm_auctions',
    'lm_openworld_players','lm_openworld_trades','lm_openworld_cars','lm_openworld_events',
    'lm_ow_world_events','lm_ow_economy','lm_ow_territories','lm_ow_world_boss','lm_ow_house_trade'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS dev_all_%s ON public.%I', t, t);
  END LOOP;
END $$;
