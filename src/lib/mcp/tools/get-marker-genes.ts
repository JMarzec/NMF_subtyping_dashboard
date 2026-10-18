import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth } from "../_supabase";

export default defineTool({
  name: "get_marker_genes",
  title: "Get marker genes",
  description: "Return top marker genes per subtype for one saved analysis. topN defaults to 25 per subtype.",
  inputSchema: {
    analysisId: z.string(),
    offset:z.number().int().nonnegative().optional(),
    pageSize:z.number().int().min(1).max(500).optional(),
    topN: z.number().int().min(1).max(100).optional().describe("Genes per subtype (default 25)."),
    subtype: z.string().optional().describe("Filter to a single subtype."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ analysisId, topN, subtype, offset=0, pageSize=100 }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const limit = topN ?? 25;
    const {data:analysis,error}=await sb.from("analyses").select("document").eq("id",analysisId).maybeSingle();
    if(error)return {content:[{type:"text",text:error.message}],isError:true};
    if(!analysis?.document)return {content:[{type:"text",text:"Analysis unavailable; re-import legacy data"}],isError:true};
    const document=analysis.document as {markerGenes?:Array<{gene:string;subtype:string;weight:number}>};
    const groups=new Map<string,NonNullable<typeof document.markerGenes>>();
    for(const marker of document.markerGenes??[]){if(subtype&&marker.subtype!==subtype)continue;const entries=groups.get(marker.subtype)??[];entries.push(marker);groups.set(marker.subtype,entries);}
    const all=[...groups.keys()].sort().flatMap(s=>(groups.get(s)??[]).sort((a,b)=>b.weight-a.weight).slice(0,limit));
    const trimmed=all.slice(offset,offset+pageSize);
    return {
      content: [{ type: "text", text: JSON.stringify(trimmed, null, 2) }],
      structuredContent: { markerGenes: trimmed, nextOffset:offset+pageSize<all.length?offset+pageSize:null },
    };
  },
});
