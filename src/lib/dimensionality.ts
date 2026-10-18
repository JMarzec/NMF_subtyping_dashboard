import { PCA } from "ml-pca";
import { UMAP } from "umap-js";
import type { SampleResult } from "@/data/mockNmfData";
export function nmfVectors(samples:SampleResult[]):number[][] {
  const keys=Object.keys(samples[0]??{}).filter(k=>k.startsWith("score_")).sort();
  if(!keys.length)return [];
  const rows=samples.map(s=>keys.map(k=>Number(s[k])));
  if(rows.some(r=>r.some(v=>!Number.isFinite(v)))||samples.some(s=>Object.keys(s).filter(k=>k.startsWith("score_")).length!==keys.length))return [];
  return rows;
}
export function computePCA(rows:number[][]) {
  if(rows.length<2||!rows[0]?.length)return {scores:[] as number[][],variance:[] as number[]};
  const n=rows[0].length,keep=Array.from({length:n},(_,i)=>i).filter(i=>rows.some(r=>r[i]!==rows[0][i]));
  if(!keep.length)return {scores:[] as number[][],variance:[] as number[]};
  const clean=rows.map(r=>keep.map(i=>r[i]));
  if(clean.some(r=>r.some(v=>!Number.isFinite(v))))return {scores:[] as number[][],variance:[] as number[]};
  const model=new PCA(clean,{center:true,scale:false});
  return {scores:model.predict(clean).to2DArray(),variance:model.getExplainedVariance().map(v=>100*v)};
}
export function computeUMAP(rows:number[][]):number[][] {
  if(rows.length<4||!rows[0]?.length)return [];
  let seed=42;
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  return new UMAP({nComponents:2,nNeighbors:Math.min(15,rows.length-1),nEpochs:150,minDist:0.1,random}).fit(rows);
}