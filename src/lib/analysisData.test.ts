import { expect,test } from "bun:test";
import example from "../../public/examples/example-GSE62254-nmf-results.json";
import {normalizeAnalysis} from "./analysisData";
import {parseDelimitedFile,buildAnnotations} from "./delimited";
import {matrixExtent,hierarchicalCluster} from "./clustering";
import {computePCA,computeUMAP} from "./dimensionality";
test("sample outcomes, marker weights and unknown fields survive round trip",()=>{
  const data=normalizeAnalysis({...example,extra:{keep:true}});
  expect(data.rawSurvivalData).toHaveLength(300);expect(data.markerGenes[0].weight).toBe(1);
  expect(normalizeAnalysis(JSON.parse(JSON.stringify(data)))).toEqual(data);
});
test("reject null samples, duplicates and malformed matrices",()=>{
  expect(()=>normalizeAnalysis({...example,samples:[null]})).toThrow();
  const d=normalizeAnalysis(example);expect(()=>normalizeAnalysis({...d,samples:[d.samples[0],d.samples[0]]})).toThrow();
  expect(()=>normalizeAnalysis({...d,heatmapData:{...d.heatmapData,values:[[NaN]]}})).toThrow();
});
test("quoted CSV and duplicate sample validation",()=>{
  const p=parseDelimitedFile('sample_id,label\na,"two, values"\nb,"line\nbreak"');
  expect(buildAnnotations(p.headers,p.rows,['a','b']).annotations.a.label).toBe('two, values');
  expect(buildAnnotations(p.headers,p.rows,['a','b']).annotations.b.label).toBe('line\nbreak');
  expect(()=>buildAnnotations(p.headers,[p.rows[0],p.rows[0]],['a'])).toThrow();
  expect(()=>parseDelimitedFile('a,a\n1,2')).toThrow();
});
test("large matrix extent avoids argument spreading",()=>{
  expect(matrixExtent(Array.from({length:200},()=>Array.from({length:1000},(_,i)=>i-500)))).toEqual({min:-500,max:499});
});
test("Ward uses Euclidean variance linkage",()=>{
  const c=hierarchicalCluster([[0],[1],[5]],'ward','euclidean');
  expect(c.tree?.distance).toBeCloseTo(Math.sqrt(27),8);
  expect(()=>hierarchicalCluster([[0],[1]],'ward','manhattan')).toThrow();
});
test("PCA and seeded UMAP are deterministic",()=>{
  expect(computePCA([[1,2]])).toEqual({scores:[],variance:[]});
  const rows=[[0,0],[1,0],[0,1],[1,1],[2,1],[1,2]];
  expect(computePCA(rows)).toEqual(computePCA(rows));expect(computeUMAP(rows)).toEqual(computeUMAP(rows));
});