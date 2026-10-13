import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectEvaluation } from '../../web/src/types/evaluation';
import { summarizeRecords, duplicateCandidates } from '../src/audit-cached-expansion';
const base:ProjectEvaluation={id:'1',municipalityCode:'12345',municipalityName:'test',projectCode:'a',projectName:'same',department:'A',evaluationYear:2025,evaluatedFiscalYear:2024,purpose:null,activities:null,outcomes:null,amounts:[],indicators:[],ratings:[],evidence:[],extractionStatus:'partial',warnings:[]};
const evidence={sourceUrl:'url',sourcePageUrl:'url',format:'pdf' as const,fetchedAt:'date',sha256:'hash',rawText:'raw',page:null,sheet:null,cell:null};
test('cost records differ from cost fields, preserve zero and do not sum kinds',()=>{
 const stats=summarizeRecords([{...base,amounts:[{kind:'actual',fiscalYear:2024,amountYen:0,rawValue:'0',rawUnit:'円',evidence},{kind:'fullCost',fiscalYear:null,amountYen:null,rawValue:'-',rawUnit:'円',evidence}]}]);
 assert.equal(stats.withAmounts,1);assert.equal(stats.withActualAmounts,1);assert.equal(stats.amountFields,2);assert.equal(stats.amountFieldsUnknownYear,1);assert.equal(stats.amountFieldsUnknownValue,1);
});
test('outcome actual excludes labels, targets and dash values; narrative and unknown are distinct',()=>{
 const indicator={name:'【成果指標】test',fiscalYear:null,target:'20',actual:null,unit:null,evidence};
 const records=[{...base,outcomes:'narrative',indicators:[indicator]},{...base,id:'2',indicators:[{...indicator,actual:'－'}]},{...base,id:'3',indicators:[{...indicator,actual:'０'}]}];
 const s=summarizeRecords(records);assert.equal(s.withOutcomeIndicators,3);assert.equal(s.explicitOutcomeActualRecords,1);assert.equal(s.strictNumericOutcomeActualRecords,1);assert.equal(s.narrativeOnlyOutcomeRecords,1);assert.equal(s.unknownOutcomeRecords,1);
});
test('duplicate candidates separate fiscal year, department and unknown years without treating shared header as a repeated sheet',()=>{
 function pair(other:Partial<ProjectEvaluation>){return duplicateCandidates([base,{...base,id:'2',...other}])[0] as {classification:string};}
 assert.equal(pair({evaluatedFiscalYear:2023}).classification,'different_year_reappearance');
 assert.equal(pair({department:'B'}).classification,'same_year_different_department');
 assert.equal(pair({projectCode:'b'}).classification,'same_year_different_code_review');
 assert.equal(pair({evaluationYear:null,evaluatedFiscalYear:null}).classification,'unknown_year_relationship');
 const overlap=duplicateCandidates([{...base,evidence:[evidence]},{...base,id:'2',evidence:[evidence]}])[0] as {exactEvidenceOverlap:boolean;substantialEvidenceOverlap:boolean};
 assert.equal(overlap.exactEvidenceOverlap,true);assert.equal(overlap.substantialEvidenceOverlap,false);
});
