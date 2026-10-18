import { agnes, type Cluster } from "ml-hclust";
import type { DendrogramNode } from "@/components/bioinformatics/Dendrogram";
export type ClusteringMethod="none"|"average"|"complete"|"single"|"ward";
export type DistanceMetric="euclidean"|"manhattan"|"correlation";
export function distance(a:number[],b:number[],metric:DistanceMetric):number{
  if(metric==="euclidean")return Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0));
  if(metric==="manhattan")return a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0);
  const ma=a.reduce((s,v)=>s+v,0)/a.length,mb=b.reduce((s,v)=>s+v,0)/b.length;
  const va=a.reduce((s,v)=>s+(v-ma)**2,0),vb=b.reduce((s,v)=>s+(v-mb)**2,0);
  if(!va||!vb)return a.every((v,i)=>v===b[i])?0:1;
  return 1-a.reduce((s,v,i)=>s+(v-ma)*(b[i]-mb),0)/Math.sqrt(va*vb);
}
export function hierarchicalCluster(data:number[][],method:ClusteringMethod,metric:DistanceMetric):{order:number[];tree:DendrogramNode|null}{
  if(method==="none"||data.length<2)return {order:data.map((_,i)=>i),tree:null};
  if(method==="ward"&&metric!=="euclidean")throw new Error("Ward requires Euclidean distances");
  const root=agnes(data,{method:method==="ward"?"ward2":method,distanceFunction:(a,b)=>distance(a,b,metric)});
  const convert=(c:Cluster):DendrogramNode=>({indices:c.indices(),distance:c.height,left:c.children[0]?convert(c.children[0]):undefined,right:c.children[1]?convert(c.children[1]):undefined});
  return {order:root.indices(),tree:convert(root)};
}
export function matrixExtent(values:number[][]):{min:number;max:number}{
  let min=Infinity,max=-Infinity;for(const row of values)for(const v of row){if(v<min)min=v;if(v>max)max=v;}
  return {min:Number.isFinite(min)?min:0,max:Number.isFinite(max)?max:1};
}