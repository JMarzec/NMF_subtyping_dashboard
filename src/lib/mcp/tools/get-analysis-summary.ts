import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../_supabase";

export default defineTool({
  name: "get_analysis_summary",
  title: "Get analysis summary",
  description: "Fetch the summary (optimal rank, subtype counts, n_samples) for one saved NMF analysis.",
  inputSchema: { analysisId: z.string().describe("Analysis id from list_analyses.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ analysisId }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("analyses")
      .select("id, name, summary, rank_metrics, survival_pvalue, cox_ph_results, created_at")
      .eq("id", analysisId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Analysis not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { analysis: data },
    };
  },
});
