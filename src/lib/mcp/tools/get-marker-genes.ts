import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../_supabase";

export default defineTool({
  name: "get_marker_genes",
  title: "Get marker genes",
  description: "Return top marker genes per subtype for one saved analysis. topN defaults to 25 per subtype.",
  inputSchema: {
    analysisId: z.string(),
    topN: z.number().int().positive().optional().describe("Genes per subtype (default 25)."),
    subtype: z.string().optional().describe("Filter to a single subtype."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ analysisId, topN, subtype }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const limit = topN ?? 25;
    let q = sb
      .from("analysis_marker_genes")
      .select("gene, subtype, log_fold_change, p_value, rank")
      .eq("analysis_id", analysisId)
      .order("subtype", { ascending: true })
      .order("rank", { ascending: true });
    if (subtype) q = q.eq("subtype", subtype);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const bySubtype: Record<string, any[]> = {};
    for (const row of data ?? []) {
      (bySubtype[row.subtype] ||= []).push(row);
    }
    const trimmed: any[] = [];
    for (const s of Object.keys(bySubtype)) trimmed.push(...bySubtype[s].slice(0, limit));
    return {
      content: [{ type: "text", text: JSON.stringify(trimmed, null, 2) }],
      structuredContent: { markerGenes: trimmed },
    };
  },
});
