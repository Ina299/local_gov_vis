import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProjectEvaluation } from '../../web/src/types/evaluation';
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const present = (v: string | null) => v !== null && !/^\s*[-―－ー–—]*\s*$/.test(v);
const numeric = (v: string | null) => present(v) && /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*%?$/.test(v!.normalize('NFKC').trim());
export function summarizeRecords(records: ProjectEvaluation[]) {
  const count = (f: (p: ProjectEvaluation) => boolean) => records.filter(f).length;
  const fields = records.flatMap(p => p.amounts);
  const byKindYear: Record<string, { fields: number; nonNullValues: number; records: number }> = {};
  for (const p of records) {
    const keys = new Set<string>();
    for (const a of p.amounts) {
      const k = `${a.kind}:${a.fiscalYear ?? 'unknown'}`; keys.add(k);
      const row = byKindYear[k] ??= { fields: 0, nonNullValues: 0, records: 0 };
      row.fields++; row.nonNullValues += Number(a.amountYen !== null);
    }
    for (const k of keys) byKindYear[k].records++;
  }
  const isOutcome = (p: ProjectEvaluation) => p.indicators.some(i => i.name.includes('【成果指標】'));
  const hasExplicitActual = (p: ProjectEvaluation) => p.indicators.some(i => i.name.includes('【成果指標】') && present(i.actual));
  return {
    records: records.length,
    withAmounts: count(p => p.amounts.some(a => a.amountYen !== null)),
    withActualAmounts: count(p => p.amounts.some(a => a.kind === 'actual' && a.amountYen !== null)),
    withIndicators: count(p => p.indicators.length > 0),
    // Legacy audit calls any non-null target/actual "numeric"; retained only for reconciliation.
    withNumericIndicators: count(p => p.indicators.some(i => i.actual !== null || i.target !== null)),
    withOutcomeIndicators: count(isOutcome), withOutcomes: count(p => p.outcomes !== null),
    withRatings: count(p => p.ratings.length > 0),
    amountFields: fields.length, amountFieldsWithValue: fields.filter(a => a.amountYen !== null).length,
    amountFieldsUnknownYear: fields.filter(a => a.fiscalYear === null).length, amountFieldsUnknownValue: fields.filter(a => a.amountYen === null).length, amountByKindYear: byKindYear,
    indicatorFields: records.reduce((n,p)=>n+p.indicators.length,0),
    indicatorFieldsUnknownYear: records.flatMap(p=>p.indicators).filter(i=>i.fiscalYear===null).length,
    explicitOutcomeActualRecords: count(hasExplicitActual),
    strictNumericOutcomeActualRecords: count(p => p.indicators.some(i => i.name.includes('【成果指標】') && numeric(i.actual))),
    outcomeLabelWithoutActualRecords: count(p => isOutcome(p) && !hasExplicitActual(p)),
    narrativeOnlyOutcomeRecords: count(p => present(p.outcomes) && !hasExplicitActual(p)),
    unknownOutcomeRecords: count(p => !present(p.outcomes) && !hasExplicitActual(p)),
    unknownEvaluationYearRecords: count(p => p.evaluationYear === null),
    unknownAssessedFiscalYearRecords: count(p => p.evaluatedFiscalYear === null),
    bothYearsUnknownRecords: count(p => p.evaluationYear === null && p.evaluatedFiscalYear === null),
    noStructuredAmountRecords: count(p => !p.amounts.some(a => a.amountYen !== null)),
    unlabelledIndicatorRoleRecords: count(p => p.indicators.some(i => !/【(?:成果|活動|対象)指標】/.test(i.name))),
  };
}
export function duplicateCandidates(records: ProjectEvaluation[]) {
  const names = new Map<string, ProjectEvaluation[]>();
  for (const p of records) { const key = `${p.municipalityCode}:${p.projectName}`; names.set(key, [...(names.get(key) ?? []), p]); }
  const pairs: object[] = [];
  for (const list of names.values()) for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
    const a=list[i], b=list[j];
    const yearBasis = a.evaluatedFiscalYear !== null && b.evaluatedFiscalYear !== null ? 'evaluatedFiscalYear'
      : a.evaluationYear !== null && b.evaluationYear !== null ? 'evaluationYear' : null;
    const sameYear = yearBasis ? a[yearBasis] === b[yearBasis] : null;
    const departmentRelation = a.department === null || b.department === null ? 'unknown' : a.department === b.department ? 'same' : 'different';
    const classification = sameYear === false ? 'different_year_reappearance' : sameYear === null ? 'unknown_year_relationship'
      : departmentRelation === 'different' ? 'same_year_different_department'
      : a.projectCode !== b.projectCode ? 'same_year_different_code_review' : 'same_year_same_code_review';
    pairs.push({municipalityCode:a.municipalityCode,projectName:a.projectName,classification,yearBasis,departmentRelation,
      exactEvidenceOverlap: a.evidence.some(e => b.evidence.some(f => e.sourceUrl === f.sourceUrl && e.rawText === f.rawText)),
      substantialEvidenceOverlap: a.evidence.some(e => e.rawText.length > 100 && b.evidence.some(f => e.sourceUrl === f.sourceUrl && e.rawText === f.rawText)),
      records:[a,b].map(p => ({id:p.id,projectCode:p.projectCode,department:p.department,evaluationYear:p.evaluationYear,evaluatedFiscalYear:p.evaluatedFiscalYear,
        evidence:p.evidence.map(e => ({url:e.sourceUrl,sha256:e.sha256,cell:e.cell,rawTextSha256:hash(e.rawText)}))}))});
  }
  return pairs;
}
export async function audit(root: string) {
  const manifests: {path:string;sha256:string}[]=[];
  async function load(path:string) { const bytes=await readFile(resolve(root,path));manifests.push({path,sha256:hash(bytes)});return {bytes,value:JSON.parse(bytes.toString())}; }
  const {value:provenance}=await load('data/evaluations/cached-expansion-provenance.json');
  const audits=new Map<string, {file:string;row:Record<string,unknown>}>();
  const auditFiles=(await readdir(resolve(root,'data/evaluations'))).filter(f=>/^cached-extraction-audit(?:-batch[0-9]+)?\.json$/.test(f)).sort();
  for(const file of auditFiles) {
    const {value}=await load(`data/evaluations/${file}`);
    for(const row of value.municipalities) {if(audits.has(row.code))throw new Error(`Duplicate audit municipality ${row.code}`);audits.set(row.code,{file,row});}
  }
  const all:ProjectEvaluation[]=[];const municipalities=[];const discrepancies:object[]=[];
  for(const shard of provenance.shards) {
    const {value,bytes}=await load(`apps/web/public/${shard.datasetPath}`);
    if(hash(bytes)!==shard.datasetSha256 || bytes.length!==shard.datasetBytes)throw new Error(`Shard changed: ${shard.municipalityCode}`);
    const records:ProjectEvaluation[]=value.projects;all.push(...records);const stats=summarizeRecords(records);
    const prior=audits.get(shard.municipalityCode);
    if(!prior)throw new Error(`Missing audit: ${shard.municipalityCode}`);
    const savedDocs=prior.row.documents as {sourceUrl:string;sourceSha256:string;records:number}[];
    const currentDocs=value.sources.flatMap((s:{documents:unknown[]})=>s.documents) as {url:string;sha256:string;projectCount:number}[];
    for(const d of savedDocs) {
      const matches=currentDocs.filter(c=>c.url===d.sourceUrl && c.sha256===d.sourceSha256 && c.projectCount===d.records);
      if(matches.length!==1)discrepancies.push({code:shard.municipalityCode,field:'document',saved:d,matchingDocuments:matches.length});
    }
    if(savedDocs.length!==currentDocs.length)discrepancies.push({code:shard.municipalityCode,field:'documentCount',saved:savedDocs.length,recomputed:currentDocs.length});
    for(const k of ['records','withAmounts','withActualAmounts','withIndicators','withNumericIndicators','withOutcomeIndicators','withOutcomes','withRatings'] as const)
      if(prior.row[k]!==stats[k])discrepancies.push({code:shard.municipalityCode,field:k,saved:prior.row[k],recomputed:stats[k]});
    if(records.length!==shard.primaryEvaluationRecords)throw new Error('Provenance record count mismatch');
    municipalities.push({code:shard.municipalityCode,name:shard.municipalityName,auditFile:prior.file,...stats});
  }
  if(audits.size!==municipalities.length)throw new Error('Audit/provenance municipality sets differ');
  // Detect concurrent integration while reading; this audit describes one immutable input snapshot.
  for(const m of manifests)if(hash(await readFile(resolve(root,m.path)))!==m.sha256)throw new Error(`Concurrent input change: ${m.path}`);
  const duplicates=duplicateCandidates(all);
  return {schemaVersion:1,offlineOnly:true,scope:'cachedExpansion only; counts are records, not unique all-year municipal businesses',
    definitions:{actualCosts:'kind=actual does not establish direct costs or exclude personnel; no cost totals are summed',
      outcomeActual:'Source-labelled 【成果指標】 with non-empty non-dash actual, not targets alone',
      narrativeOnly:'Nonempty outcomes text without explicit outcome actual; can include activity indicators or targets',
      unknownOutcome:'No separated outcomes text and no explicit outcome actual; evidence may still contain unparsed outcomes',
      duplicates:'Exact names within a municipality; candidates are not confirmed duplicates; absent years never prove same year',
      numericLegacy:'withNumericIndicators matches legacy audit non-null target/actual; strict numeric actual is reported separately'},
    inputManifest:manifests,municipalityCount:municipalities.length,totals:summarizeRecords(all),municipalities,
    auditDiscrepancies:discrepancies,duplicateRecordIds:all.map(x=>x.id).filter((x,i,a)=>a.indexOf(x)!==i),duplicateCandidates:duplicates};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const root=resolve(process.argv[2]??'.');const result=await audit(root);const output=JSON.stringify(result,null,2)+'\n';
  if(process.argv[3])await writeFile(resolve(process.argv[3]),output);else process.stdout.write(output);
}
