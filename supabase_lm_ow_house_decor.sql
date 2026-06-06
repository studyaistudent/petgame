-- 오픈월드 분양 집 인테리어 (가구 보유·배치)
-- Supabase Dashboard → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.lm_ow_house_decor (
  owner text PRIMARY KEY,
  plot_id text,
  inventory jsonb NOT NULL DEFAULT '{}'::jsonb,
  placements jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lm_ow_house_decor_plot_idx ON public.lm_ow_house_decor (plot_id);

ALTER TABLE public.lm_ow_house_decor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_ow_house_decor_select ON public.lm_ow_house_decor;
DROP POLICY IF EXISTS lm_ow_house_decor_insert ON public.lm_ow_house_decor;
DROP POLICY IF EXISTS lm_ow_house_decor_update ON public.lm_ow_house_decor;

CREATE POLICY lm_ow_house_decor_select ON public.lm_ow_house_decor
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY lm_ow_house_decor_insert ON public.lm_ow_house_decor
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY lm_ow_house_decor_update ON public.lm_ow_house_decor
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lm_ow_house_decor;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
