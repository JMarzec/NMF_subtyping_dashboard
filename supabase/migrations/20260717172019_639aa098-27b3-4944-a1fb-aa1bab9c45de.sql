
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Analyses
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary JSONB NOT NULL,
  rank_metrics JSONB,
  survival_pvalue NUMERIC,
  cox_ph_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO authenticated;
GRANT ALL ON public.analyses TO service_role;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own analyses" ON public.analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_analyses_user ON public.analyses(user_id, created_at DESC);
CREATE TRIGGER trg_analyses_updated BEFORE UPDATE ON public.analyses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Samples
CREATE TABLE public.analysis_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  sample_id TEXT NOT NULL,
  subtype TEXT NOT NULL,
  data JSONB NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_samples TO authenticated;
GRANT ALL ON public.analysis_samples TO service_role;
ALTER TABLE public.analysis_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own analysis samples" ON public.analysis_samples FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid()));
CREATE INDEX idx_samples_analysis ON public.analysis_samples(analysis_id);

-- Marker genes
CREATE TABLE public.analysis_marker_genes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  gene TEXT NOT NULL,
  subtype TEXT NOT NULL,
  log_fold_change NUMERIC,
  p_value NUMERIC,
  rank INT,
  data JSONB
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_marker_genes TO authenticated;
GRANT ALL ON public.analysis_marker_genes TO service_role;
ALTER TABLE public.analysis_marker_genes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own marker genes" ON public.analysis_marker_genes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid()));
CREATE INDEX idx_markers_analysis ON public.analysis_marker_genes(analysis_id, subtype, rank);

-- Survival curves
CREATE TABLE public.analysis_survival_curves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  subtype TEXT NOT NULL,
  time NUMERIC NOT NULL,
  survival NUMERIC,
  at_risk INT,
  events INT,
  censored INT,
  data JSONB
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_survival_curves TO authenticated;
GRANT ALL ON public.analysis_survival_curves TO service_role;
ALTER TABLE public.analysis_survival_curves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own survival curves" ON public.analysis_survival_curves FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_id AND a.user_id = auth.uid()));
CREATE INDEX idx_survcurves_analysis ON public.analysis_survival_curves(analysis_id, subtype, time);
