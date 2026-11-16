import {expect,test} from "bun:test";
import {plotCohort} from "./plotCohort";
test("subtype and annotation exclusions apply together",()=>{
 const samples=[{sample_id:'a',subtype:'A'},{sample_id:'b',subtype:'B'},{sample_id:'c',subtype:'B'}];
 expect(plotCohort(samples,new Set(['A']),'stage',new Set(['high']),{b:{stage:'high'},c:{stage:'low'}}).map(s=>s.sample_id)).toEqual(['c']);
});