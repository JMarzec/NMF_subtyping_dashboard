import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireAuth } from "../_supabase";

export default defineTool({
  name: "list_analyses",
  title: "List NMF analyses",
  description: "List the signed-in user's saved NMF analyses (id, name, creation date, and summary size).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("analyses")
      .select("id, name, created_at, summary, survival_pvalue")
      .order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      created_at: a.created_at,
      n_subtypes: a.summary?.n_subtypes,
      n_samples: a.summary?.n_samples,
      survival_pvalue: a.survival_pvalue,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { analyses: rows },
    };
  },
});
