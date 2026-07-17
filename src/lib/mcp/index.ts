import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listAnalyses from "./tools/list-analyses";
import getAnalysisSummary from "./tools/get-analysis-summary";
import getMarkerGenes from "./tools/get-marker-genes";
import getSurvivalStats from "./tools/get-survival-stats";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "nmf-subtyping-mcp",
  title: "NMF Molecular Subtyping",
  version: "0.1.0",
  instructions:
    "Access the signed-in user's saved NMF molecular subtyping analyses from the AccelBio dashboard. Start with `list_analyses` to find an analysis id, then call `get_analysis_summary`, `get_marker_genes`, or `get_survival_stats` for details.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listAnalyses, getAnalysisSummary, getMarkerGenes, getSurvivalStats],
});
