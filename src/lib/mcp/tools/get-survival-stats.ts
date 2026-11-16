import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../_supabase";
import {normalizeAnalysis} from "../../analysisData";
import {logRankObserved} from "../../survivalEngine";
import {observedGroupCox} from "../../coxphAnalysis";

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
      .select("survival_pvalue, cox_ph_results,document")
      .eq("id", analysisId)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Analysis not found" }], isError: true };
    let survival={survival_pvalue:data.survival_pvalue,cox_ph_results:data.cox_ph_results,source:"precomputed"};
    if(data.document){
      try{
        const doc=normalizeAnalysis(data.document),groups=Object.fromEntries(doc.samples.map(s=>[s.sample_id,s.subtype]));
        const observed=doc.rawSurvivalData??[];
        survival={survival_pvalue:doc.survival_pvalue??logRankObserved(observed,groups)?.pValue??null,cox_ph_results:doc.coxPHResults??observedGroupCox(observed,groups),source:doc.coxPHResults?"precomputed":"individual outcomes"};
      }catch{return {content:[{type:"text",text:"Saved analysis is invalid; re-import original JSON"}],isError:true};}
    }
    return {
      content: [{ type: "text", text: JSON.stringify(survival, null, 2) }],
      structuredContent: { survival },
    };
  },
});
