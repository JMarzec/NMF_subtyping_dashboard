import { describe, expect, test } from "bun:test";
import reference from "./fixtures/cox-efron.json";
import { completeCohort, fitCox, concordance, kaplanMeier, logRankObserved } from "./survivalEngine";
import { resultFromFit, compareNestedModels, backwardElimination, crossValidateConcordance } from "./coxphAnalysis";
import type { SurvivalObservation } from "./analysisData";
const outcomes = reference.outcomes as SurvivalObservation[];
const data = reference.covariates;
describe("Observed survival inference",()=>{
  test("joint Efron fit matches independent PHReg reference",()=>{
    const fit=fitCox(outcomes,data);
    fit.beta.forEach((b,i)=>expect(b/fit.columns[i].scale).toBeCloseTo(reference.expected.beta[i],6));
    fit.covariance.forEach((r,i)=>r.forEach((v,j)=>expect(v/fit.columns[i].scale/fit.columns[j].scale).toBeCloseTo(reference.expected.covariance[i][j],6)));
    expect(fit.logLikelihood).toBeCloseTo(reference.expected.logLikelihood,6);
    expect(fitCox(outcomes,{x:data.x}).logLikelihood).toBeCloseTo(reference.expected.reducedLogLikelihood,6);
  });
  test("LRT uses fitted likelihood and categorical parameter count",()=>{
    const full=resultFromFit(fitCox(outcomes,data)),reduced=resultFromFit(fitCox(outcomes,{x:data.x}));
    const result=compareNestedModels(reduced,full);
    expect(result?.likelihoodRatioTest.df).toBe(3);
    expect(result?.likelihoodRatioTest.chiSquare).toBeCloseTo(2*(reference.expected.logLikelihood-reference.expected.reducedLogLikelihood),6);
    expect(result?.fullModel.aic).toBeCloseTo(-2*reference.expected.logLikelihood+8,6);
  });
  test("rejects duplicate predictors and different cohorts",()=>{
    expect(()=>fitCox(outcomes,{x:data.x,duplicate:data.x})).toThrow();
    expect(compareNestedModels(resultFromFit(fitCox(outcomes.slice(1),{x:data.x})),resultFromFit(fitCox(outcomes,data)))).toBeNull();
  });
  test("common candidate cohort excludes missing values once",()=>{
    const z={...data.z};delete z.s0;
    expect(completeCohort(outcomes,{...data,z})).toHaveLength(89);
  });
  test("concordance excludes censored early and tied survival pairs",()=>{
    const rows:SurvivalObservation[]=[{sample_id:'a',time:1,event:0},{sample_id:'b',time:2,event:1},{sample_id:'c',time:3,event:0}];
    expect(concordance(rows,[100,2,1])).toBe(1);
    expect(concordance(rows,[100,1,1])).toBe(0.5);
    expect(concordance(rows.map(o=>({...o,event:0})),[3,2,1])).toBeUndefined();
  });
  test("KM uses event-time risk sets and exact step median",()=>{
    const rows:SurvivalObservation[]=[{sample_id:'a',time:1,event:1},{sample_id:'b',time:1,event:0},{sample_id:'c',time:3,event:1}];
    const curve=kaplanMeier(rows,{a:'A',b:'A',c:'A'})[0];
    expect(curve.timePoints[0].survival).toBeCloseTo(2/3,12);
    expect(curve.timePoints[0].atRisk).toBe(3);
    expect(curve.timePoints[1].survival).toBe(0);
  });
  test("multigroup log-rank is order invariant with full covariance",()=>{
    const rows:SurvivalObservation[]=Array.from({length:30},(_,i)=>({sample_id:`r${i}`,time:1+(i%10)+(i%3),event:i%4===0?0:1}));
    const groups=Object.fromEntries(rows.map((o,i)=>[o.sample_id,['A','B','C'][i%3]]));
    const a=logRankObserved(rows,groups),b=logRankObserved([...rows].reverse(),Object.fromEntries(Object.entries(groups).map(([id,g])=>[id,{A:'C',B:'A',C:'B'}[g]])));
    expect(a?.degreesOfFreedom).toBe(2);expect(a?.chiSquare).toBeCloseTo(b?.chiSquare??-1,10);
  });
  test("backward elimination may remove the final nonsignificant term",()=>{
    const rows:SurvivalObservation[]=Array.from({length:40},(_,i)=>({sample_id:`r${i}`,time:Math.floor(i/2)+1,event:1}));
    const noise=Object.fromEntries(rows.map((o,i)=>[o.sample_id,i%2]));
    expect(backwardElimination(rows,{noise},{},['noise']).finalCovariates).toEqual([]);
  });
  test("cross validation repeats training selection reproducibly",()=>{
    const a=crossValidateConcordance(outcomes,data,{},Object.keys(data)),b=crossValidateConcordance(outcomes,data,{},Object.keys(data));
    expect(a.concordanceScores).toHaveLength(5);expect(a.concordanceScores).toEqual(b.concordanceScores);
  });
});