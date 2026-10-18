import type { SurvivalObservation } from "./analysisData";
import { completeCohort, fitCox, concordance, encode, type CoxFit, type CovariateData } from "./survivalEngine";
import { chiSquareTail, dot } from "./numerics";
import stats from "jstat";

export interface CoxPHResult {
  referenceGroup: string;
  groups: Array<{
    subtype: string;
    hazardRatio: number;
    lowerCI: number;
    upperCI: number;
    pValue: number;
    coefficient: number;
    se: number;
  }>;
  waldTest: {
    chiSquare: number;
    df: number;
    pValue: number;
  };
  stratifiedBy?: string;
}

export interface StratifiedCoxPHResult extends CoxPHResult {
  strataResults: Array<{
    stratum: string;
    nSamples: number;
    groups: CoxPHResult['groups'];
  }>;
  pooledHR: Array<{
    subtype: string;
    hazardRatio: number;
    lowerCI: number;
    upperCI: number;
    pValue: number;
  }>;
  interactionTest?: {
    chiSquare: number;
    df: number;
    pValue: number;
    significant: boolean;
  };
}

export interface MultivariateCoxPHResult {
  covariates: Array<{
    name: string;
    hazardRatio: number;
    lowerCI: number;
    upperCI: number;
    pValue: number;
    pValueBonferroni: number;
    pValueFDR: number;
    coefficient: number;
    se: number;
  }>;
  waldTest: {
    chiSquare: number;
    df: number;
    pValue: number;
  };
  concordance?: number;
  logLikelihood?: number;
}

export interface ModelComparisonResult {
  nullModel: {
    covariates: string[];
    logLikelihood: number;
    df: number;
    aic: number;
  };
  fullModel: {
    covariates: string[];
    logLikelihood: number;
    df: number;
    aic: number;
  };
  likelihoodRatioTest: {
    chiSquare: number;
    df: number;
    pValue: number;
  };
  addedCovariates: string[];
  significantImprovement: boolean;
}

export interface BackwardEliminationResult {
  steps: Array<{
    step: number;
    removedCovariate: string | null;
    removedPValue: number | null;
    remainingCovariates: string[];
    modelAIC: number;
    waldPValue: number;
  }>;
  finalCovariates: string[];
  significantCovariates: string[];
  removedCovariates: string[];
  threshold: number;
}

export interface ForwardSelectionResult {
  steps: Array<{
    step: number;
    addedCovariate: string | null;
    addedPValue: number | null;
    selectedCovariates: string[];
    modelAIC: number;
    waldPValue: number;
    lrtPValue?: number;
    aicChange?: number;
  }>;
  finalCovariates: string[];
  rejectedCovariates: string[];
  threshold: number;
}

export interface StepwiseSelectionResult {
  steps: Array<{
    step: number;
    action: 'add' | 'remove';
    covariate: string;
    pValue: number;
    selectedCovariates: string[];
    modelAIC: number;
    concordance?: number;
  }>;
  finalCovariates: string[];
  addedCovariates: string[];
  removedCovariates: string[];
  threshold: number;
  finalConcordance?: number;
}

export interface CrossValidationResult {
  folds: number;
  concordanceScores: number[];
  meanConcordance: number;
  stdConcordance: number;
  ci95Lower: number;
  ci95Upper: number;
}

export interface MultivariateCoxPHResult { fit?: CoxFit; termNames?: string[] }
export const formatHR = (hr: number, lower: number, upper: number) => `${hr.toFixed(2)} (${lower.toFixed(2)}–${upper.toFixed(2)})`;
export function resultFromFit(fit: CoxFit): MultivariateCoxPHResult {
  const covariates=fit.columns.map((c,i)=>{
    const coefficient=fit.beta[i]/c.scale,se=Math.sqrt(fit.covariance[i][i])/c.scale,pValue=chiSquareTail((coefficient/se)**2,1);
    return {name:c.name,coefficient,se,pValue,hazardRatio:Math.exp(coefficient),lowerCI:Math.exp(coefficient-1.96*se),upperCI:Math.exp(coefficient+1.96*se),pValueBonferroni:Math.min(1,pValue*fit.columns.length),pValueFDR:pValue};
  });
  const sorted=[...covariates].sort((a,b)=>a.pValue-b.pValue);let previous=1;
  for(let i=sorted.length-1;i>=0;i--){previous=Math.min(previous,sorted[i].pValue*sorted.length/(i+1));sorted[i].pValueFDR=previous;}
  return {covariates,waldTest:{chiSquare:fit.wald,df:fit.columns.length,pValue:chiSquareTail(fit.wald,fit.columns.length)},logLikelihood:fit.logLikelihood,concordance:concordance(fit.outcomes,fit.x.map(x=>dot(x,fit.beta))),fit,termNames:[...new Set(fit.columns.map(c=>c.term))]};
}
export function multivariateCoxPH(outcomes: SurvivalObservation[], data: CovariateData, _groups?: Record<string,string>, _counts?: Record<string,number>, strata?: Record<string,string>): MultivariateCoxPHResult | null {
  try{return resultFromFit(fitCox(completeCohort(outcomes,data),data,strata));}catch{return null;}
}
export function compareNestedModels(reduced: MultivariateCoxPHResult|null, full: MultivariateCoxPHResult|null): ModelComparisonResult|null {
  if(!full?.fit)return null;
  const f=full.fit,r=reduced?.fit;
  const nullCovariates=reduced?.termNames??[],fullCovariates=full.termNames??[];
  if(nullCovariates.some(n=>!fullCovariates.includes(n)))return null;
  if(r && (r.outcomes.length!==f.outcomes.length || r.outcomes.some((o,i)=>o.sample_id!==f.outcomes[i].sample_id||o.time!==f.outcomes[i].time||o.event!==f.outcomes[i].event||r.strata[i]!==f.strata[i])))return null;
  const nullDf=r?.columns.length??0,fullDf=f.columns.length,df=fullDf-nullDf;
  if(df<=0)return null;
  const nullLL=r?.logLikelihood??f.nullLogLikelihood,chiSquare=2*(f.logLikelihood-nullLL);
  if(chiSquare < -1e-7)return null;
  const pValue=chiSquareTail(Math.max(0,chiSquare),df);
  return {nullModel:{covariates:nullCovariates,logLikelihood:nullLL,df:nullDf,aic:-2*nullLL+2*nullDf},fullModel:{covariates:fullCovariates,logLikelihood:f.logLikelihood,df:fullDf,aic:-2*f.logLikelihood+2*fullDf},likelihoodRatioTest:{chiSquare:Math.max(0,chiSquare),df,pValue},addedCovariates:fullCovariates.filter(n=>!nullCovariates.includes(n)),significantImprovement:pValue<0.05};
}
const subset=(data:CovariateData,names:string[])=>Object.fromEntries(names.map(n=>[n,data[n]]));
const aic=(m:MultivariateCoxPHResult)=>-2*(m.logLikelihood??0)+2*m.covariates.length;
function context(outcomes:SurvivalObservation[],data:CovariateData,names:string[]) {
  const cohort=completeCohort(outcomes,data,names);
  return (terms:string[])=>multivariateCoxPH(cohort,subset(data,terms));
}
export function stepwiseModelComparison(outcomes:SurvivalObservation[],data:CovariateData,_groups:Record<string,string>,names:string[],_counts?:Record<string,number>):ModelComparisonResult[]{
  const fit=context(outcomes,data,names),results:ModelComparisonResult[]=[];let previous=fit([]);
  for(let i=1;i<=names.length;i++){const model=fit(names.slice(0,i)),comparison=compareNestedModels(previous,model);if(!model)break;if(comparison)results.push(comparison);previous=model;}
  return results;
}
export function backwardElimination(outcomes:SurvivalObservation[],data:CovariateData,_groups:Record<string,string>,names:string[],_counts?:Record<string,number>,threshold=0.05):BackwardEliminationResult{
  const fit=context(outcomes,data,names),steps:BackwardEliminationResult['steps']=[],removedCovariates:string[]=[];let selected=[...names],model=fit(selected);
  if(!model)return {steps,finalCovariates:[],significantCovariates:[],removedCovariates:[],threshold};
  steps.push({step:0,removedCovariate:null,removedPValue:null,remainingCovariates:[...selected],modelAIC:aic(model),waldPValue:model.waldTest.pValue});
  while(selected.length){
    const candidates=selected.map(term=>{const reduced=fit(selected.filter(n=>n!==term)),comparison=compareNestedModels(reduced,model);return {term,reduced,p:comparison?.likelihoodRatioTest.pValue??-1};}).sort((a,b)=>b.p-a.p);
    const worst=candidates[0];if(!worst?.reduced||worst.p<threshold)break;
    selected=selected.filter(n=>n!==worst.term);removedCovariates.push(worst.term);model=worst.reduced;
    steps.push({step:steps.length,removedCovariate:worst.term,removedPValue:worst.p,remainingCovariates:[...selected],modelAIC:aic(model),waldPValue:model.waldTest.pValue});
  }
  return {steps,finalCovariates:selected,significantCovariates:selected,removedCovariates,threshold};
}
export function forwardSelection(outcomes:SurvivalObservation[],data:CovariateData,_groups:Record<string,string>,names:string[],_counts?:Record<string,number>,threshold=0.05):ForwardSelectionResult{
  const fit=context(outcomes,data,names),steps:ForwardSelectionResult['steps']=[];let selected:string[]=[],model=fit([]);
  if(!model)return {steps,finalCovariates:[],rejectedCovariates:names,threshold};
  steps.push({step:0,addedCovariate:null,addedPValue:null,selectedCovariates:[],modelAIC:aic(model),waldPValue:1});
  while(selected.length<names.length){
    const best=names.filter(n=>!selected.includes(n)).map(term=>{const full=fit([...selected,term]);return {term,full,p:compareNestedModels(model,full)?.likelihoodRatioTest.pValue??1};}).sort((a,b)=>a.p-b.p)[0];
    if(!best?.full||best.p>=threshold)break;
    const change=aic(model)-aic(best.full);selected=[...selected,best.term];model=best.full;
    steps.push({step:steps.length,addedCovariate:best.term,addedPValue:best.p,lrtPValue:best.p,aicChange:change,selectedCovariates:[...selected],modelAIC:aic(model),waldPValue:model.waldTest.pValue});
  }
  return {steps,finalCovariates:selected,rejectedCovariates:names.filter(n=>!selected.includes(n)),threshold};
}
export interface StepwiseSelectionResult { removalThreshold?: number }
export function stepwiseSelection(outcomes:SurvivalObservation[],data:CovariateData,_groups:Record<string,string>,names:string[],_counts?:Record<string,number>,entryThreshold=0.05,removalThreshold=0.10):StepwiseSelectionResult{
  const fit=context(outcomes,data,names),steps:StepwiseSelectionResult['steps']=[],addedCovariates:string[]=[],removedCovariates:string[]=[],visited=new Set<string>();let selected:string[]=[],model=fit([]);
  for(let iteration=0;iteration<names.length*5 && model;iteration++){
    const key=[...selected].sort().join('\0');if(visited.has(key))break;visited.add(key);
    const best=names.filter(n=>!selected.includes(n)).map(term=>{const full=fit([...selected,term]);return {term,full,p:compareNestedModels(model,full)?.likelihoodRatioTest.pValue??1};}).sort((a,b)=>a.p-b.p)[0];
    if(!best?.full||best.p>=entryThreshold)break;
    selected.push(best.term);addedCovariates.push(best.term);model=best.full;
    steps.push({step:steps.length+1,action:'add',covariate:best.term,pValue:best.p,selectedCovariates:[...selected],modelAIC:aic(model),concordance:model.concordance});
    while(selected.length){
      const worst=selected.map(term=>{const reduced=fit(selected.filter(n=>n!==term));return {term,reduced,p:compareNestedModels(reduced,model)?.likelihoodRatioTest.pValue??-1};}).sort((a,b)=>b.p-a.p)[0];
      if(!worst?.reduced||worst.p<=removalThreshold)break;
      selected=selected.filter(n=>n!==worst.term);removedCovariates.push(worst.term);model=worst.reduced;
      steps.push({step:steps.length+1,action:'remove',covariate:worst.term,pValue:worst.p,selectedCovariates:[...selected],modelAIC:aic(model),concordance:model.concordance});
    }
  }
  return {steps,finalCovariates:selected,addedCovariates,removedCovariates,threshold:entryThreshold,removalThreshold,finalConcordance:model?.concordance};
}
export function crossValidateConcordance(outcomes:SurvivalObservation[],data:CovariateData,groups:Record<string,string>,names:string[],_counts?:Record<string,number>,folds=5):CrossValidationResult{
  const cohort=completeCohort(outcomes,data,names),scores:number[]=[];
  const empty={folds,concordanceScores:[],meanConcordance:NaN,stdConcordance:NaN,ci95Lower:NaN,ci95Upper:NaN};
  if(folds<2||cohort.length<folds*5)return empty;
  const ordered=[...cohort].sort((a,b)=>a.event-b.event||a.sample_id.localeCompare(b.sample_id));
  for(let fold=0;fold<folds;fold++){
    const train=ordered.filter((_,i)=>i%folds!==fold),test=ordered.filter((_,i)=>i%folds===fold);
    try{
      // Repeat selection entirely within the training fold, avoiding selection leakage.
      const chosen=stepwiseSelection(train,subset(data,names),groups,names).finalCovariates;
      const model=fitCox(train,subset(data,chosen));
      const trainingLevels=new Map(chosen.map(term=>[term,new Set(train.map(o=>String(data[term][o.sample_id])))]));
      if(test.some(o=>model.columns.some(c=>c.level!==undefined&&!trainingLevels.get(c.term)?.has(String(data[c.term][o.sample_id])))))return empty;
      const x=encode(test,data,model.columns).x,c=concordance(test,x.map(row=>dot(row,model.beta)));
      if(c===undefined)return empty;scores.push(c);
    }catch{return empty;}
  }
  const mean=scores.reduce((a,b)=>a+b,0)/scores.length,std=Math.sqrt(scores.reduce((s,c)=>s+(c-mean)**2,0)/(scores.length-1)),margin=stats.jStat.studentt.inv(0.975,scores.length-1)*std/Math.sqrt(scores.length);
  return {folds,concordanceScores:scores,meanConcordance:mean,stdConcordance:std,ci95Lower:Math.max(0,mean-margin),ci95Upper:Math.min(1,mean+margin)};
}
export function observedGroupCox(outcomes:SurvivalObservation[],groups:Record<string,string>,strata?:Record<string,string>):CoxPHResult|null{
  const matched=outcomes.filter(o=>groups[o.sample_id] && (!strata||strata[o.sample_id]));
  // Prefix numeric labels so grouping remains categorical, not a continuous trend.
  const categorical=Object.fromEntries(Object.entries(groups).map(([id,g])=>[id,`group:${g}`]));
  const model=multivariateCoxPH(matched,{group:categorical},undefined,undefined,strata);
  if(!model)return null;
  const levels=[...new Set(matched.map(o=>groups[o.sample_id]))].sort();
  return {referenceGroup:levels[0],groups:model.covariates.map((c,i)=>({...c,subtype:levels[i+1]})),waldTest:model.waldTest};
}
