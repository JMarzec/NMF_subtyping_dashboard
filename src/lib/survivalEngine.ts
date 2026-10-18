import type { SurvivalObservation } from "./analysisData";
import { Matrix, SingularValueDecomposition } from "ml-matrix";
import { chiSquareTail, dot, invert, multiply } from "./numerics";

export type CovariateData = Record<string, Record<string, string | number>>;
export interface EncodedColumn { name: string; term: string; level?: string; mean: number; scale: number }
export interface CoxFit {
  columns: EncodedColumn[]; beta: number[]; covariance: number[][];
  logLikelihood: number; nullLogLikelihood: number; wald: number;
  outcomes: SurvivalObservation[]; x: number[][]; strata: string[];
}
const numeric = (v: string | number) => v !== "" && Number.isFinite(Number(v));
export function completeCohort(outcomes: SurvivalObservation[], data: CovariateData, names = Object.keys(data)) {
  return outcomes.filter(o => names.every(n => data[n]?.[o.sample_id] !== undefined && data[n][o.sample_id] !== ""));
}
export function encode(outcomes: SurvivalObservation[], data: CovariateData, learned?: EncodedColumn[]) {
  const columns: EncodedColumn[] = learned ?? Object.keys(data).flatMap(term => {
    const values = outcomes.map(o => data[term][o.sample_id]);
    if (values.every(numeric)) {
      const nums = values.map(Number), mean = nums.reduce((a,b)=>a+b,0)/nums.length;
      const scale = Math.sqrt(nums.reduce((s,v)=>s+(v-mean)**2,0)/nums.length);
      if (scale < 1e-12) throw new Error(`Constant predictor: ${term}`);
      return [{name:term,term,mean,scale}];
    }
    const levels = [...new Set(values.map(String))].sort();
    if (levels.length < 2) throw new Error(`Constant predictor: ${term}`);
    return levels.slice(1).map(level => ({name:`${term}: ${level} (vs ${levels[0]})`,term,level,mean:0,scale:1}));
  });
  const x = outcomes.map(o => columns.map(c => c.level === undefined ? (Number(data[c.term]?.[o.sample_id])-c.mean)/c.scale : Number(String(data[c.term]?.[o.sample_id]) === c.level)));
  if (x.some(r=>r.some(v=>!Number.isFinite(v)))) throw new Error("Incomplete predictors");
  return {columns,x};
}

// Efron tied-event partial likelihood with analytic joint score/information.
export function evaluateCox(beta: number[], x: number[][], outcomes: SurvivalObservation[], strata: string[]) {
  const p = beta.length, score = Array(p).fill(0), information = Array.from({length:p},()=>Array(p).fill(0));
  let logLikelihood = 0;
  const eta = x.map(r=>dot(r,beta));
  for (const stratum of new Set(strata)) {
    const members = outcomes.map((_,i)=>i).filter(i=>strata[i]===stratum);
    const times = [...new Set(members.filter(i=>outcomes[i].event===1).map(i=>outcomes[i].time))].sort((a,b)=>a-b);
    for (const time of times) {
      const risk = members.filter(i=>outcomes[i].time>=time), deaths = members.filter(i=>outcomes[i].time===time && outcomes[i].event===1);
      const shift = risk.reduce((m,i)=>Math.max(m,eta[i]),-Infinity);
      const moments = (ids: number[]) => {
        let s0=0; const s1=Array(p).fill(0),s2=Array.from({length:p},()=>Array(p).fill(0));
        for (const i of ids) { const w=Math.exp(eta[i]-shift); s0+=w; for(let j=0;j<p;j++){s1[j]+=w*x[i][j];for(let k=0;k<p;k++)s2[j][k]+=w*x[i][j]*x[i][k];} }
        return {s0,s1,s2};
      };
      const r=moments(risk),d=moments(deaths);
      deaths.forEach(i=>{logLikelihood+=eta[i];for(let j=0;j<p;j++)score[j]+=x[i][j];});
      for(let l=0;l<deaths.length;l++) {
        const f=l/deaths.length,den=r.s0-f*d.s0;
        logLikelihood-=Math.log(den)+shift;
        const first=r.s1.map((v,j)=>(v-f*d.s1[j])/den);
        for(let j=0;j<p;j++){score[j]-=first[j];for(let k=0;k<p;k++)information[j][k]+=(r.s2[j][k]-f*d.s2[j][k])/den-first[j]*first[k];}
      }
    }
  }
  return {logLikelihood,score,information};
}

export function fitCox(outcomes: SurvivalObservation[], data: CovariateData, strataMap: Record<string,string> = {}): CoxFit {
  if (outcomes.length<2 || !outcomes.some(o=>o.event===1)) throw new Error("No observed events");
  if (new Set(outcomes.map(o=>o.sample_id)).size!==outcomes.length || outcomes.some(o=>!Number.isFinite(o.time)||o.time<0||(o.event!==0&&o.event!==1))) throw new Error("Invalid individual survival outcomes");
  const {columns,x}=encode(outcomes,data),p=columns.length;
  const strata=outcomes.map(o=>strataMap[o.sample_id]??"all");
  if(p){
    const centered=x.map(row=>row.map((v,j)=>v-x.reduce((s,r)=>s+r[j],0)/x.length));
    const singular=new SingularValueDecomposition(new Matrix(centered),{autoTranspose:true}).diagonal;
    if (singular.length<p || singular.some(v=>v<Math.max(...singular)*1e-10)) throw new Error("Redundant or collinear predictors");
  }
  let beta=Array(p).fill(0),current=evaluateCox(beta,x,outcomes,strata);
  const nullLogLikelihood=current.logLikelihood;
  let converged=p===0;
  for(let iter=0;iter<60 && p;iter++){
    if(Math.max(...current.score.map(Math.abs))<1e-7){converged=true;break;}
    const delta=multiply(invert(current.information),current.score);
    let step=1, accepted=false;
    for(let trial=0;trial<24;trial++){
      const nextBeta=beta.map((v,j)=>v+step*delta[j]),next=evaluateCox(nextBeta,x,outcomes,strata);
      if(Number.isFinite(next.logLikelihood) && next.logLikelihood>=current.logLikelihood-1e-10){beta=nextBeta;current=next;accepted=true;break;}
      step/=2;
    }
    if(!accepted || beta.some(v=>Math.abs(v)>30)) throw new Error("Cox model did not converge; possible separation");
  }
  if(!converged && p && Math.max(...current.score.map(Math.abs))>=1e-7) throw new Error("Cox model did not converge");
  const covariance=invert(current.information);
  if(covariance.some((r,i)=>r[i]<=0||r[i]>1e10)) throw new Error("Unstable Cox fit");
  return {columns,beta,covariance,logLikelihood:current.logLikelihood,nullLogLikelihood,wald:dot(beta,multiply(current.information,beta)),outcomes,x,strata};
}

export function concordance(outcomes: SurvivalObservation[], risks: number[]): number | undefined {
  let pairs=0,correct=0;
  for(let i=0;i<outcomes.length;i++)for(let j=i+1;j<outcomes.length;j++){
    const a=outcomes[i],b=outcomes[j];
    const early=a.time<b.time&&a.event===1?i:b.time<a.time&&b.event===1?j:undefined;
    if(early===undefined)continue;
    const late=early===i?j:i; pairs++; correct+=risks[early]===risks[late]?0.5:Number(risks[early]>risks[late]);
  }
  return pairs?correct/pairs:undefined;
}

export function kaplanMeier(outcomes: SurvivalObservation[], groups: Record<string,string>) {
  return [...new Set(outcomes.map(o=>groups[o.sample_id]).filter(Boolean))].sort().map(subtype=>{
    const rows=outcomes.filter(o=>groups[o.sample_id]===subtype),times=[...new Set(rows.map(o=>o.time))].sort((a,b)=>a-b);
    let survival=1,greenwood=0;
    const timePoints=times.map(time=>{
      const atRisk=rows.filter(o=>o.time>=time).length,events=rows.filter(o=>o.time===time&&o.event===1).length,censored=rows.filter(o=>o.time===time&&o.event===0).length;
      survival*=1-events/atRisk;
      if(events && atRisk>events)greenwood+=events/(atRisk*(atRisk-events));
      const stdErr=survival*Math.sqrt(greenwood);
      const se=survival>0&&survival<1?Math.sqrt(greenwood)/Math.abs(Math.log(survival)):0;
      const lowerCI=survival===0?0:survival===1?1:Math.exp(-Math.exp(Math.log(-Math.log(survival))+1.96*se));
      const upperCI=survival===0?0:survival===1?1:Math.exp(-Math.exp(Math.log(-Math.log(survival))-1.96*se));
      return {time,survival,atRisk,events,censored,stdErr,lowerCI,upperCI};
    });
    return {subtype,nTotal:rows.length,nEvents:rows.filter(o=>o.event===1).length,nCensored:rows.filter(o=>o.event===0).length,timePoints};
  });
}

export function logRankObserved(outcomes: SurvivalObservation[], groups: Record<string,string>, strata?:Record<string,string>) {
  const rows=outcomes.filter(o=>groups[o.sample_id]&&(!strata||strata[o.sample_id])),names=[...new Set(rows.map(o=>groups[o.sample_id]))].sort(),p=names.length-1;
  if(p<1)return null;
  const u=Array(p).fill(0),v=Array.from({length:p},()=>Array(p).fill(0));
  for(const stratum of new Set(rows.map(o=>strata?.[o.sample_id]??"all"))){
   const members=rows.filter(o=>(strata?.[o.sample_id]??"all")===stratum);
   for(const time of new Set(members.filter(o=>o.event===1).map(o=>o.time))){
    const risk=members.filter(o=>o.time>=time),deaths=members.filter(o=>o.time===time&&o.event===1),n=risk.length,d=deaths.length;
    if(n<=1)continue;
    const prop=names.slice(0,p).map(g=>risk.filter(o=>groups[o.sample_id]===g).length/n),factor=d*(n-d)/(n-1);
    for(let j=0;j<p;j++){u[j]+=deaths.filter(o=>groups[o.sample_id]===names[j]).length-d*prop[j];for(let k=0;k<p;k++)v[j][k]+=factor*((j===k?prop[j]:0)-prop[j]*prop[k]);}
   }
  }
  try{const chiSquare=Math.max(0,dot(u,multiply(invert(v),u)));return {chiSquare,pValue:chiSquareTail(chiSquare,p),degreesOfFreedom:p};}catch{return null;}
}