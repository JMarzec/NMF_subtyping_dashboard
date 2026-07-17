import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../_supabase";

export default defineTool({
  name: "get_survival_stats",
  title: "Get survival statistics",
  description: "Return log-rank p-value and Cox PH hazard ratios / CIs for one saved analysis.",
  inputSchema: { analysisId: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ analysisId }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("analyses")
      .select("survival_pvalue, cox_ph_results")
      .eq("id", analysisId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Analysis not found" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { survival: data },
    };
  },
});
