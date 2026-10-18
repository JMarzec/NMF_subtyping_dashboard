import { hierarchicalCluster, type ClusteringMethod, type DistanceMetric } from "./clustering";
self.onmessage=(event:MessageEvent<{data:number[][];method:ClusteringMethod;metric:DistanceMetric}>)=>{
  try{self.postMessage({result:hierarchicalCluster(event.data.data,event.data.method,event.data.metric)});}
  catch(e:unknown){self.postMessage({error:e instanceof Error?e.message:"Clustering failed"});}
};