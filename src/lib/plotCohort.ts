import type {SampleResult} from "@/data/mockNmfData";
export function plotCohort(samples:SampleResult[],excludedSubtypes:Set<string>,selectedAnnotation:string|null,excludedValues:Set<string>,annotations?:Record<string,Record<string,string>>){
 return samples.filter(s=>!excludedSubtypes.has(s.subtype)&&!(selectedAnnotation&&excludedValues.has(annotations?.[s.sample_id]?.[selectedAnnotation]??"")));
}