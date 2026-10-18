import Papa from "papaparse";
export function parseDelimitedFile(text: string): { headers: string[]; rows: string[][] } {
  const result=Papa.parse<string[]>(text.replace(/^\uFEFF/,""),{skipEmptyLines:"greedy"});
  if(result.errors.length)throw new Error(result.errors[0].message);
  const [rawHeaders,...rows]=result.data,headers=rawHeaders?.map(h=>h.trim())??[];
  if(headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error("Column names must be nonempty and unique");
  if(rows.some(r=>r.length!==headers.length))throw new Error("All rows must have the same number of columns");
  return {headers,rows};
}
export function buildAnnotations(headers:string[],rows:string[][],sampleIds:string[]) {
  const ids=new Set(sampleIds),matches=headers.map((_,i)=>rows.reduce((n,r)=>n+Number(ids.has(r[i])),0)),best=Math.max(...matches);
  if(!best)throw new Error("No sample IDs match this analysis");
  const choices=matches.map((n,i)=>n===best?i:-1).filter(i=>i>=0);
  if(choices.length!==1)throw new Error("More than one column matches sample IDs; keep a single sample ID column");
  const index=choices[0],annotations:Record<string,Record<string,string>>=Object.create(null),seen=new Set<string>();
  for(const row of rows){const id=row[index];if(!id)throw new Error("Missing sample ID");if(seen.has(id))throw new Error(`Duplicate sample ID: ${id}`);seen.add(id);if(!ids.has(id))continue;annotations[id]=Object.fromEntries(headers.flatMap((h,i)=>i===index?[]:[[h,row[i]]]));}
  return {sampleColumn:headers[index],columns:headers.filter((_,i)=>i!==index),annotations};
}