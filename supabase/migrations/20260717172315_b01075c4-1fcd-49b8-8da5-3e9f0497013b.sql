
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS heatmap_data jsonb,
  ADD COLUMN IF NOT EXISTS survival_data jsonb;

ALTER TABLE public.analysis_survival_curves
  ALTER COLUMN time DROP NOT NULL;
