import { useEffect,useState } from "react";
import type { ClusteringMethod, DistanceMetric } from "@/lib/clustering";
import type { DendrogramNode } from "@/components/bioinformatics/Dendrogram";
export function useClustering(data:number[][],method:ClusteringMethod,metric:DistanceMetric){
  const [state,setState]=useState<{input:number[][];order:number[];tree:DendrogramNode|null;error?:string}>({input:data,order:[],tree:null});
  useEffect(()=>{
    if(method==="none"||data.length<2){setState({input:data,order:data.map((_,i)=>i),tree:null});return;}
    const worker=new Worker(new URL("../lib/clustering.worker.ts",import.meta.url),{type:"module"});
    worker.onmessage=(e:MessageEvent<{result?:{order:number[];tree:DendrogramNode};error?:string}>)=>setState({input:data,order:e.data.result?.order??data.map((_,i)=>i),tree:e.data.result?.tree??null,error:e.data.error});
    worker.onerror=()=>setState({input:data,order:data.map((_,i)=>i),tree:null,error:"Clustering unavailable"});
    worker.postMessage({data,method,metric});return()=>worker.terminate();
  },[data,method,metric]);
  return state.input===data?state:{input:data,order:data.map((_,i)=>i),tree:null};
}