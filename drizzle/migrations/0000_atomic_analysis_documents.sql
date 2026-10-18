ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS document jsonb;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS analyses_owner_created_id_idx ON public.analyses (user_id, created_at DESC, id DESC);
CREATE OR REPLACE FUNCTION public.save_analysis(p_id uuid, p_name text, p_document jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) = 0 OR jsonb_typeof(p_document) <> 'object' OR jsonb_typeof(p_document->'summary') <> 'object' OR jsonb_typeof(p_document->'samples') <> 'array' OR jsonb_typeof(p_document->'markerGenes') <> 'array' THEN RAISE EXCEPTION 'Invalid analysis document'; END IF;
 IF EXISTS (SELECT 1 FROM public.analyses WHERE id=p_id AND user_id=v_user) THEN
  IF EXISTS (SELECT 1 FROM public.analyses WHERE id=p_id AND user_id=v_user AND document=p_document AND name=trim(p_name)) THEN RETURN p_id; END IF;
  RAISE EXCEPTION 'Analysis ID already exists';
 END IF;
 INSERT INTO public.analyses(id,user_id,name,summary,rank_metrics,survival_pvalue,cox_ph_results,heatmap_data,survival_data,document)
 VALUES(p_id,v_user,trim(p_name),p_document->'summary',p_document->'rankMetrics',(p_document->>'survival_pvalue')::numeric,p_document->'coxPHResults',p_document->'heatmapData',p_document->'survivalData',p_document);
 INSERT INTO public.analysis_samples(analysis_id,sample_id,subtype,data) SELECT p_id,s->>'sample_id',s->>'subtype',s FROM jsonb_array_elements(p_document->'samples') s;
 INSERT INTO public.analysis_marker_genes(analysis_id,gene,subtype,log_fold_change,p_value,rank,data) SELECT p_id,g->>'gene',g->>'subtype',(g->>'log_fold_change')::numeric,COALESCE(g->>'p_value',g->>'pValue')::numeric,(ord-1)::integer,g FROM jsonb_array_elements(p_document->'markerGenes') WITH ORDINALITY AS e(g,ord);
 RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_analysis(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_analysis(uuid,text,jsonb) TO authenticated;
COMMENT ON TABLE public.analysis_survival_curves IS 'DEPRECATED for new saves: authoritative curves are in analyses.document; retained for legacy recovery.';
COMMENT ON COLUMN public.analyses.document IS 'Authoritative normalized analysis payload including raw outcomes and annotations; NULL marks legacy saves requiring validation/re-import.';