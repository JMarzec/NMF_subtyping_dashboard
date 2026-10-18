import { z } from "zod";

const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const probability = finite.min(0).max(1);
const text = z.string().min(1);
const sampleSchema = z.object({ sample_id: text, subtype: text }).catchall(z.union([z.string(), finite, z.boolean(), z.null()]));
const markerSchema = z.object({ gene: text, subtype: text, weight: finite }).passthrough();
const pointSchema = z.object({ time: nonnegative, survival: probability, atRisk: nonnegative.optional(), events: nonnegative.optional(), censored: nonnegative.optional(), stdErr: nonnegative.optional(), lowerCI: probability.optional(), upperCI: probability.optional() }).passthrough();
const outcomeSchema = z.object({ sample_id: text, subtype: text.optional(), time: nonnegative, event: z.union([z.literal(0), z.literal(1)]) }).passthrough();
export type SurvivalObservation = z.infer<typeof outcomeSchema>;
const schema = z.object({
  summary: z.object({ dataset: text, n_samples: z.number().int().positive(), n_genes: z.number().int().nonnegative(), n_subtypes: z.number().int().positive(), subtype_counts: z.record(z.number().int().nonnegative()), cophenetic_correlation: probability, silhouette_mean: finite.min(-1).max(1), optimal_rank: z.number().int().positive().optional() }).passthrough(),
  samples: z.array(sampleSchema).min(1),
  markerGenes: z.array(markerSchema),
  heatmapData: z.object({ genes: z.array(text), samples: z.array(text), sampleSubtypes: z.array(text), values: z.array(z.array(finite)) }).optional(),
  rankMetrics: z.array(z.object({ rank: z.number().int().positive(), cophenetic: probability, silhouette: finite.min(-1).max(1) })).optional(),
  survivalData: z.array(z.object({ subtype: text, nTotal: nonnegative.optional(), nEvents: nonnegative.optional(), nCensored: nonnegative.optional(), timePoints: z.array(pointSchema).min(1) })).optional(),
  rawSurvivalData: z.array(outcomeSchema).optional(),
  survival_pvalue: probability.optional(),
  coxPHResults: z.object({ referenceGroup: text, groups: z.array(z.object({ subtype: text, hazardRatio: finite.positive(), lowerCI: finite.positive(), upperCI: finite.positive(), pValue: probability })), waldTest: z.object({ chiSquare: nonnegative, df: z.number().int().nonnegative(), pValue: probability }) }).optional(),
  annotations: z.object({ sampleColumn: text, columns: z.array(text), annotations: z.record(z.record(z.string())) }).optional(),
}).passthrough();
export type AnalysisData = z.infer<typeof schema>;

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`); };

export function normalizeAnalysis(value: unknown): AnalysisData {
  const raw = object(value);
  const markers = raw.markerGenes ?? raw.marker_genes;
  const outcomes = raw.rawSurvivalData ?? raw.raw_survival_data;
  const data = schema.parse({ ...raw,
    samples: raw.samples ?? raw.sampleResults ?? raw.sample_results,
    markerGenes: Array.isArray(markers) ? markers.map(m => { const g = object(m); return { ...g, weight: g.weight ?? g.score ?? g.log_fold_change }; }) : markers,
    heatmapData: raw.heatmapData ?? raw.heatmap_data,
    rankMetrics: raw.rankMetrics ?? raw.rank_metrics,
    survivalData: raw.survivalData ?? raw.survival_data,
    coxPHResults: raw.coxPHResults ?? raw.cox_ph_results,
    rawSurvivalData: Array.isArray(outcomes) ? outcomes.map(o => { const r = object(o); return { ...r, sample_id: r.sample_id ?? r.sampleId, event: r.event === true ? 1 : r.event === false ? 0 : r.event }; }) : outcomes,
  });
  const ids = data.samples.map(s => s.sample_id);
  unique(ids, "sample IDs");
  const counts: Record<string, number> = {};
  data.samples.forEach(s => { counts[s.subtype] = (counts[s.subtype] ?? 0) + 1; });
  if (data.summary.n_samples !== ids.length || data.summary.n_subtypes !== Object.keys(counts).length || Object.keys(data.summary.subtype_counts).length !== Object.keys(counts).length || Object.entries(counts).some(([s,n]) => data.summary.subtype_counts[s] !== n)) throw new Error("Summary counts do not match the samples");
  if (data.heatmapData) {
    const h = data.heatmapData;
    unique(h.samples, "heatmap sample IDs"); unique(h.genes, "heatmap gene names");
    if (h.values.length !== h.genes.length || h.sampleSubtypes.length !== h.samples.length || h.values.some(row => row.length !== h.samples.length)) throw new Error("Heatmap dimensions do not match labels");
    if (h.samples.some((id,i) => !ids.includes(id) || data.samples.find(s => s.sample_id === id)?.subtype !== h.sampleSubtypes[i])) throw new Error("Heatmap samples do not match the analysis");
  }
  data.survivalData?.forEach(group => {
    let previousTime = -1, previousSurvival = 1;
    group.timePoints.forEach(p => { if (p.time <= previousTime || p.survival > previousSurvival) throw new Error("Survival curves must have increasing times and nonincreasing survival"); previousTime = p.time; previousSurvival = p.survival; });
  });
  if (data.rawSurvivalData) { unique(data.rawSurvivalData.map(o => o.sample_id), "survival sample IDs"); if (data.rawSurvivalData.some(o => !ids.includes(o.sample_id))) throw new Error("Survival outcomes contain unknown samples"); }
  return data;
}