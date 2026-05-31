-- ═══════════════════════════════════════════════════════════════
-- 러브몬 배포용 RLS (닉+PIN 헤더 검증)
-- 1) supabase_schema.sql 실행 후 2) 이 파일 실행
-- 관리자 PIN: lm_app_config.admin_pin (기본 0515 → 반드시 변경)
-- 클라이언트: x-lm-nick, x-lm-pin 헤더 (supabase-firestore-shim.js)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lm_app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO public.lm_app_config (key, value)
VALUES ('admin_pin', '0515')
ON CONFLICT (key) DO NOTHING;

-- ── 헬퍼 (request.headers) ──

CREATE OR REPLACE FUNCTION public.lm_headers_json()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.lm_req_nick()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(trim(both FROM lm_headers_json()->>'x-lm-nick'), '');
$$;

CREATE OR REPLACE FUNCTION public.lm_req_pin()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(trim(both FROM lm_headers_json()->>'x-lm-pin'), '');
$$;

CREATE OR REPLACE FUNCTION public.lm_pin_ok(p_nick text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_nick IS NOT NULL
     AND lm_req_pin() IS NOT NULL
     AND length(lm_req_pin()) >= 4
     AND EXISTS (
       SELECT 1 FROM public.mbti_entries m
       WHERE m.nick = p_nick AND m.pin = lm_req_pin()
     );
$$;

CREATE OR REPLACE FUNCTION public.lm_verified()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lm_req_nick() IS NOT NULL AND lm_pin_ok(lm_req_nick());
$$;

CREATE OR REPLACE FUNCTION public.lm_verified_nick(p_nick text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_nick IS NOT NULL
     AND p_nick = lm_req_nick()
     AND lm_pin_ok(p_nick);
$$;

CREATE OR REPLACE FUNCTION public.lm_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lm_req_pin() IS NOT NULL
     AND lm_req_pin() = (SELECT value FROM public.lm_app_config WHERE key = 'admin_pin' LIMIT 1);
$$;

GRANT EXECUTE ON FUNCTION public.lm_headers_json() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lm_req_nick() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lm_req_pin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lm_pin_ok(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lm_verified() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lm_verified_nick(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lm_is_admin() TO anon, authenticated;

GRANT SELECT ON public.lm_app_config TO anon, authenticated;

-- ── 기존 정책 제거 ──

DO $$
DECLARE
  t TEXT;
  pol TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'mbti_entries','balance_entries','dating_entries','roses','mutual_roses',
    'lm_pets','lm_game','lm_chat','lm_breed_requests','lm_family','lm_feed_logs',
    'lm_baby_pets','lm_houses','lm_gifts','lm_cm_strokes','lm_cm_guesses',
    'lm_mafia_rooms','lm_auctions',
    'lm_openworld_players','lm_openworld_trades','lm_openworld_cars','lm_openworld_events',
    'lm_ow_world_events','lm_ow_economy','lm_ow_territories','lm_ow_world_boss','lm_ow_house_trade',
    'lm_app_config'
  ]
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS dev_all_%s ON public.%I', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- lm_app_config: 관리자만 읽기/수정
CREATE POLICY lm_cfg_sel ON public.lm_app_config FOR SELECT TO anon, authenticated
  USING (lm_is_admin());
CREATE POLICY lm_cfg_all ON public.lm_app_config FOR ALL TO anon, authenticated
  USING (lm_is_admin()) WITH CHECK (lm_is_admin());

-- mbti_entries
CREATE POLICY lm_sel_mbti_entries ON public.mbti_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_mbti_entries ON public.mbti_entries FOR INSERT TO anon, authenticated
  WITH CHECK (
    lm_req_nick() IS NOT NULL
    AND NEW.nick = lm_req_nick()
    AND NEW.pin = lm_req_pin()
    AND length(NEW.pin) >= 4
    AND (
      NOT EXISTS (SELECT 1 FROM public.mbti_entries e WHERE e.nick = NEW.nick)
      OR lm_pin_ok(NEW.nick)
    )
  );
CREATE POLICY lm_upd_mbti_entries ON public.mbti_entries FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin())
  WITH CHECK (lm_verified_nick(nick) OR lm_is_admin());
CREATE POLICY lm_del_mbti_entries ON public.mbti_entries FOR DELETE TO anon, authenticated
  USING (lm_is_admin() OR lm_verified_nick(nick));

-- balance / dating
CREATE POLICY lm_sel_balance_entries ON public.balance_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_balance_entries ON public.balance_entries FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(nick));
CREATE POLICY lm_upd_balance_entries ON public.balance_entries FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin()) WITH CHECK (lm_verified_nick(nick) OR lm_is_admin());
CREATE POLICY lm_del_balance_entries ON public.balance_entries FOR DELETE TO anon, authenticated
  USING (lm_is_admin());

CREATE POLICY lm_sel_dating_entries ON public.dating_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_dating_entries ON public.dating_entries FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(nick));
CREATE POLICY lm_upd_dating_entries ON public.dating_entries FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin()) WITH CHECK (lm_verified_nick(nick) OR lm_is_admin());
CREATE POLICY lm_del_dating_entries ON public.dating_entries FOR DELETE TO anon, authenticated
  USING (lm_is_admin());

-- roses
CREATE POLICY lm_sel_roses ON public.roses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_roses ON public.roses FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(sender));
CREATE POLICY lm_del_roses ON public.roses FOR DELETE TO anon, authenticated USING (lm_is_admin());

-- mutual_roses
CREATE POLICY lm_sel_mutual_roses ON public.mutual_roses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_mutual_roses ON public.mutual_roses FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(user1));
CREATE POLICY lm_del_mutual_roses ON public.mutual_roses FOR DELETE TO anon, authenticated USING (lm_is_admin());

-- lm_pets
CREATE POLICY lm_sel_lm_pets ON public.lm_pets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_pets ON public.lm_pets FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(nick));
CREATE POLICY lm_upd_lm_pets ON public.lm_pets FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin()) WITH CHECK (lm_verified_nick(nick) OR lm_is_admin());
CREATE POLICY lm_del_lm_pets ON public.lm_pets FOR DELETE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin());

-- lm_houses
CREATE POLICY lm_sel_lm_houses ON public.lm_houses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_houses ON public.lm_houses FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(nick));
CREATE POLICY lm_upd_lm_houses ON public.lm_houses FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin()) WITH CHECK (lm_verified_nick(nick) OR lm_is_admin());
CREATE POLICY lm_del_lm_houses ON public.lm_houses FOR DELETE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin());

-- lm_baby_pets
CREATE POLICY lm_sel_lm_baby_pets ON public.lm_baby_pets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_baby_pets ON public.lm_baby_pets FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified() AND (lm_verified_nick(parent1_nick) OR lm_verified_nick(parent2_nick)));
CREATE POLICY lm_upd_lm_baby_pets ON public.lm_baby_pets FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(parent1_nick) OR lm_verified_nick(parent2_nick) OR lm_is_admin())
  WITH CHECK (lm_verified_nick(parent1_nick) OR lm_verified_nick(parent2_nick) OR lm_is_admin());
CREATE POLICY lm_del_lm_baby_pets ON public.lm_baby_pets FOR DELETE TO anon, authenticated
  USING (lm_is_admin() OR lm_verified_nick(parent1_nick) OR lm_verified_nick(parent2_nick));

-- 공개 로그/채팅 (읽기 전체, 쓰기 인증)
CREATE POLICY lm_sel_lm_chat ON public.lm_chat FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_chat ON public.lm_chat FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(nick));

CREATE POLICY lm_sel_lm_feed_logs ON public.lm_feed_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_feed_logs ON public.lm_feed_logs FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(from_nick));

CREATE POLICY lm_sel_lm_family ON public.lm_family FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_family ON public.lm_family FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());

CREATE POLICY lm_sel_lm_gifts ON public.lm_gifts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_gifts ON public.lm_gifts FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(from_nick));
CREATE POLICY lm_upd_lm_gifts ON public.lm_gifts FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(to_nick) OR lm_is_admin())
  WITH CHECK (lm_verified_nick(to_nick) OR lm_is_admin());

-- 교배 요청
CREATE POLICY lm_sel_lm_breed_requests ON public.lm_breed_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_breed_requests ON public.lm_breed_requests FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(from_nick));
CREATE POLICY lm_upd_lm_breed_requests ON public.lm_breed_requests FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(from_nick) OR lm_verified_nick(to_nick) OR lm_is_admin())
  WITH CHECK (lm_verified_nick(from_nick) OR lm_verified_nick(to_nick) OR lm_is_admin());
CREATE POLICY lm_del_lm_breed_requests ON public.lm_breed_requests FOR DELETE TO anon, authenticated
  USING (lm_verified_nick(from_nick) OR lm_verified_nick(to_nick) OR lm_is_admin());

-- 글로벌 게임 상태 (광장/캐치마인드)
CREATE POLICY lm_sel_lm_game ON public.lm_game FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_game ON public.lm_game FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_game ON public.lm_game FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());
CREATE POLICY lm_del_lm_game ON public.lm_game FOR DELETE TO anon, authenticated USING (lm_is_admin());

-- 캐치마인드
CREATE POLICY lm_sel_lm_cm_strokes ON public.lm_cm_strokes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_cm_strokes ON public.lm_cm_strokes FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());

CREATE POLICY lm_sel_lm_cm_guesses ON public.lm_cm_guesses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_cm_guesses ON public.lm_cm_guesses FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(nick));

-- 마피아 / 경매
CREATE POLICY lm_sel_lm_mafia_rooms ON public.lm_mafia_rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_mafia_rooms ON public.lm_mafia_rooms FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(host));
CREATE POLICY lm_upd_lm_mafia_rooms ON public.lm_mafia_rooms FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());
CREATE POLICY lm_del_lm_mafia_rooms ON public.lm_mafia_rooms FOR DELETE TO anon, authenticated
  USING (lm_verified_nick(host) OR lm_is_admin());

CREATE POLICY lm_sel_lm_auctions ON public.lm_auctions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_auctions ON public.lm_auctions FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(seller_nick));
CREATE POLICY lm_upd_lm_auctions ON public.lm_auctions FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());
CREATE POLICY lm_del_lm_auctions ON public.lm_auctions FOR DELETE TO anon, authenticated
  USING (lm_verified_nick(seller_nick) OR lm_is_admin());

-- 오픈월드
CREATE POLICY lm_sel_lm_openworld_players ON public.lm_openworld_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_openworld_players ON public.lm_openworld_players FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(nick));
CREATE POLICY lm_upd_lm_openworld_players ON public.lm_openworld_players FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin()) WITH CHECK (lm_verified_nick(nick) OR lm_is_admin());
CREATE POLICY lm_del_lm_openworld_players ON public.lm_openworld_players FOR DELETE TO anon, authenticated
  USING (lm_verified_nick(nick) OR lm_is_admin());

CREATE POLICY lm_sel_lm_openworld_trades ON public.lm_openworld_trades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_openworld_trades ON public.lm_openworld_trades FOR INSERT TO anon, authenticated
  WITH CHECK (lm_verified_nick(from_nick));
CREATE POLICY lm_upd_lm_openworld_trades ON public.lm_openworld_trades FOR UPDATE TO anon, authenticated
  USING (lm_verified_nick(from_nick) OR lm_verified_nick(to_nick) OR lm_is_admin())
  WITH CHECK (lm_verified_nick(from_nick) OR lm_verified_nick(to_nick) OR lm_is_admin());
CREATE POLICY lm_del_lm_openworld_trades ON public.lm_openworld_trades FOR DELETE TO anon, authenticated
  USING (lm_verified_nick(from_nick) OR lm_verified_nick(to_nick) OR lm_is_admin());

CREATE POLICY lm_sel_lm_openworld_cars ON public.lm_openworld_cars FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_openworld_cars ON public.lm_openworld_cars FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_openworld_cars ON public.lm_openworld_cars FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());

CREATE POLICY lm_sel_lm_openworld_events ON public.lm_openworld_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_openworld_events ON public.lm_openworld_events FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_openworld_events ON public.lm_openworld_events FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());

-- OW blob 테이블
CREATE POLICY lm_sel_lm_ow_world_events ON public.lm_ow_world_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_ow_world_events ON public.lm_ow_world_events FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_ow_world_events ON public.lm_ow_world_events FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());

CREATE POLICY lm_sel_lm_ow_economy ON public.lm_ow_economy FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_ow_economy ON public.lm_ow_economy FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_ow_economy ON public.lm_ow_economy FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());

CREATE POLICY lm_sel_lm_ow_territories ON public.lm_ow_territories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_ow_territories ON public.lm_ow_territories FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_ow_territories ON public.lm_ow_territories FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());

CREATE POLICY lm_sel_lm_ow_world_boss ON public.lm_ow_world_boss FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_ow_world_boss ON public.lm_ow_world_boss FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_ow_world_boss ON public.lm_ow_world_boss FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());

CREATE POLICY lm_sel_lm_ow_house_trade ON public.lm_ow_house_trade FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lm_ins_lm_ow_house_trade ON public.lm_ow_house_trade FOR INSERT TO anon, authenticated WITH CHECK (lm_verified());
CREATE POLICY lm_upd_lm_ow_house_trade ON public.lm_ow_house_trade FOR UPDATE TO anon, authenticated
  USING (lm_verified() OR lm_is_admin()) WITH CHECK (lm_verified() OR lm_is_admin());
