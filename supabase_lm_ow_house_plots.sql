-- 오픈월드 분양 집 소유권 (plot_rose / plot_sky / plot_mint)
-- Supabase Dashboard → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.lm_ow_house_plots (
  plot_id text PRIMARY KEY,
  owner text NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  cost integer NOT NULL DEFAULT 100000,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lm_ow_house_plots_owner_idx ON public.lm_ow_house_plots (owner);

ALTER TABLE public.lm_ow_house_plots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_ow_house_plots_select ON public.lm_ow_house_plots;
DROP POLICY IF EXISTS lm_ow_house_plots_insert ON public.lm_ow_house_plots;
DROP POLICY IF EXISTS lm_ow_house_plots_update ON public.lm_ow_house_plots;

CREATE POLICY lm_ow_house_plots_select ON public.lm_ow_house_plots
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY lm_ow_house_plots_insert ON public.lm_ow_house_plots
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY lm_ow_house_plots_update ON public.lm_ow_house_plots
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Realtime (선택 — 오픈월드 집 표시 실시간 동기화)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lm_ow_house_plots;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
