import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput, project, evidence} from './shared';

export interface SheetReview {unit:string; code?:string; name?:string; disposition:string; reason:string; existingIds?:string[]}
const mogamiBooks:Record<string,[number,number]>={
 '13de8a6ce5d6470c5f84ab83':[123,165], 'e0478ac24f6040c9088eedbf':[276,309],
};
const mogamiNames:Record<number,string>={131:'消防団再編',155:'宅内配管費用助成',162:'町営バス事業',164:'公共施設等適正管理基金の制定',282:'若者交流・定住・婚活促進事業',289:'ワークライフバランスの啓蒙',304:'小中学校ＩＣＴ環境整備事業',305:'大学との連携',308:'収納率向上検討委員会'};
/** Individual sheets, not plan chapters. Costs/ratings remain unset where table alignment is ambiguous. */
export function reviewMogamiSheets(input:CachedInput,prior:ProjectEvaluation[]){
 const projects:ProjectEvaluation[]=[],units:SheetReview[]=[];
 const range=mogamiBooks[input.sourceId];if(input.municipalityCode!=='06362'||!range)return {projects,units};
 if(input.truncated)throw new Error('Mogami requires verified complete book');
 const marks=[...input.text.matchAll(/最上町事務事業評価シート/g)],seen=new Set<number>();
 for(let i=0;i<marks.length;i++){
  const start=marks[i].index!,raw=input.text.slice(start,marks[i+1]?.index??input.text.length),head=raw.split('１ 事務事業の目的・内容等(Plan)')[0];
  const no=Number(head.match(/№\s*(\d+)/)?.[1]),code=head.match(/\b\d-\d-\d-\d-\d\b/)?.[0];
  if(!Number.isInteger(no)||no<range[0]||no>range[1]||seen.has(no)||!code)throw new Error('Mogami sheet boundary/identity mismatch');seen.add(no);
  const name=mogamiNames[no]??head.match(/根拠法令\s*([^\n]+)\n令和/)?.[1];
  if(!name||!head.includes(name)||!raw.includes('令和5年度(評価年度事業費)')||!raw.includes('事務事業の成果と課題、方向性(Action)'))throw new Error(`Mogami incomplete identity/year/sheet ${no}`);
  const common={unit:String(no),code,name};
  if(no===159){if(!raw.includes('NO142と同じ事業であるため、事務事業評価では統合。'))throw new Error('Mogami alias evidence changed');units.push({...common,disposition:'explicit_duplicate',reason:'NO142と同じ事業であるため、事務事業評価では統合。'});continue;}
  const existing=prior.filter(p=>p.evaluatedFiscalYear===2023&&(p.projectCode===code||p.projectName.normalize('NFKC')===name.normalize('NFKC')));
  if(existing.length){units.push({...common,disposition:'existing_record_preserved',reason:'Explicit FY2023 and project code/name match; no prior field overwritten',existingIds:existing.map(x=>x.id)});continue;}
  const p=project(input,code,name,null,raw,start);p.evaluatedFiscalYear=2023;
  // Only the two independently reviewed, contiguous narrative cells; other sheets have interleaved labels.
  if(no===128||no===142){const m=raw.match(/事業の目的\n\n([^]*?)\n\n事業の内容\n\n([^]*?)\n\n２ 事業経費/);if(!m)throw new Error('Mogami bounded narrative changed');p.purpose=m[1];p.activities=m[2];}
  p.warnings.push('令和5年度（評価年度事業費）の明示による2023年度の個票。令和6年度（現年度事業費）と区別。金額・指標・評価点の表は列対応を確定できず未収録。既存の同年度・同事業番号を除外。段組みで見出しが混在する文章欄は未設定。');
  projects.push(p);units.push({...common,disposition:'new_individual_record',reason:'Complete bounded sheet, explicit FY2023, no existing code/name in that fiscal year'});
 }
 if(seen.size!==range[1]-range[0]+1)throw new Error('Mogami book has missing sheets');return {projects,units};
}

const titleAliases:Record<string,string>={'4b2edb72a2ed731ff25c5927':'空き家に関する総合相談窓口','70c91a8c9c5de9f416a435e7':'認可保育所の誘致'};
const normalized=(s:string)=>s.normalize('NFKC').replaceAll('’',"'");
/** Taito's single-sheet FY2019 report: FY2018 is explicitly attached to the activity cell. */
export function reviewTaitoSheet(input:CachedInput,title:string,prior:ProjectEvaluation[]){
 const projects:ProjectEvaluation[]=[],units:SheetReview[]=[];
 if(input.municipalityCode!=='13106'||input.format!=='pdf')return {projects,units};
 const t=input.text,heading='令和元年度 事務事業評価シート';
 if(!t.startsWith(heading))return {projects,units};
 const name=t.match(/所\n管\n\n([^\n]+)\n\n事務事業名\n/)?.[1];
 const complete=!input.truncated&&t.split(heading).length===2&&t.includes('［総合評価］')&&t.includes('今後の方向性');
 const years=[...t.matchAll(/事業内容\s*\[(H|R)(\d+)年度\]/g)];
 if(!complete||!name||years.length!==1||years[0][1]!=='H'||years[0][2]!=='30'||(normalized(name)!==normalized(title)&&titleAliases[input.sourceId]!==name)){
  units.push({unit:input.sourceId,disposition:'layout_identity_hold',reason:'Single complete sheet, explicit target year, or title/header correspondence not established'});return {projects,units};
 }
 const existing=prior.filter(p=>(normalized(p.projectName)===normalized(name)||normalized(p.projectName)===normalized(title))&&(p.evaluatedFiscalYear===2018||p.evaluatedFiscalYear===null));
 if(existing.length){units.push({unit:input.sourceId,name,disposition:'existing_or_unknown_period_hold',reason:'Same name in FY2018 or unknown fiscal year; preserve existing',existingIds:existing.map(x=>x.id)});return {projects,units};}
 const p=project(input,name,name,2019,t,0);p.projectCode=null;p.evaluatedFiscalYear=2018;
 // Purpose/activities are intentionally not split: some labels occur inside their own text cells.
 p.warnings.push('台東区の令和元年度・単独事業評価シート。事業内容[H30年度]により評価対象2018年度。本文の所管・事務事業名見出しで名称を特定し公式掲載名と照合。段組みの文章欄、金額、指標、評価欄の対応は推測せず、個票全文を根拠として保持。');
 p.evidence.push(evidence(input,years[0][0],years[0].index));projects.push(p);units.push({unit:input.sourceId,name,disposition:'new_individual_record',reason:'Single complete sheet; header title verified; explicit FY2018; no same/unknown-period name'});return {projects,units};
}

/** Ogawa: identity-only reconciliation of complete sheets already registered in the same evaluation cycle.
 * It does not infer the target fiscal year from the evaluation year and never emits a new record.
 */
export function reviewOgawaIdentity(input:CachedInput,prior:ProjectEvaluation[]){
 const units:SheetReview[]=[];
 if(input.municipalityCode!=='11343'||input.format!=='pdf'||input.truncated)return {projects:[],units};
 const t=input.text,year=t.match(/^令和\s*([３４５345])\s*(?:提\s*)?年度/),name=t.match(/\(1\)事業名\n\n([^\n]+)\n/);
 if(!year||!name||!t.includes('第５次総合振興計画事務事業評価シート（様式１）'))return {projects:[],units};
 const ey=2018+Number(year[1].normalize('NFKC')),known=prior.filter(p=>p.evaluationYear===ey&&normalized(p.projectName)===normalized(name[1]));
 if(known.length===1)units.push({unit:input.sourceId,name:name[1],disposition:'existing_evaluation_identity_preserved',reason:'Exact business name and explicit evaluation year match; target fiscal year not inferred, full field coverage unproven',existingIds:known.map(x=>x.id)});
 else units.push({unit:input.sourceId,name:name[1],disposition:'layout_identity_hold',reason:'No unique existing business/evaluation-year identity; target fiscal year needs source-specific confirmation'});
 return {projects:[],units};
}
