import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';
/** 上尾市 令和８年度行政評価「事務事業評価結果一覧（令和７年度に実施した事業）」。1セル1行に崩れた表から、列が順に揃った行だけを読む。 */
const SOURCE='f22c144785cb01036c5a66bd';
const TITLE='■令和８年度上尾市行政評価',LIST='事務事業評価結果一覧（令和７年度に実施した事業）';
const DEPT=/(課|室|センター|所|館|局|部)$/;
function extract(input:CachedInput):ProjectEvaluation[]{
 if(input.sourceId!==SOURCE||!input.text.startsWith(TITLE)||!input.text.includes(LIST))return [];
 const tokens:{s:string;start:number}[]=[];let offset=0;
 for(const line of input.text.split('\n')){if(line.trim())tokens.push({s:line,start:offset});offset+=line.length+1;}
 const out=new Map<string,ProjectEvaluation>(),conflicts=new Set<string>();
 for(let i=0;i+3<tokens.length;i++){
  if(!/^\d+$/.test(tokens[i].s)||!/^\d+$/.test(tokens[i+1].s)||!/^\d+$/.test(tokens[i+2].s))continue;
  const head=tokens[i+3].s.match(/^(?:★ )?(\d+) (\S+)(?: (\S+))?$/);if(!head)continue;
  let j=i+4,department=head[3];
  if(!department){if(!tokens[j]||!/^\S+$/.test(tokens[j].s))continue;department=tokens[j++].s;}
  if(!DEPT.test(department)||!tokens[j]||!/^-?\d{1,3}(?:,\d{3})*$/.test(tokens[j].s))continue;
  const cost=tokens[j++].s;
  while(tokens[j]?.s==='☑')j++;
  let ok=true;
  for(let k=0;k<8;k++)if(!tokens[j+k]||!/^[a-dー]$/.test(tokens[j+k].s))ok=false;
  for(let k=8;k<11;k++)if(!tokens[j+k]||!/^[A-D]$/.test(tokens[j+k].s))ok=false;
  if(!ok||!tokens[j+11]||!/^\d\.\S+$/.test(tokens[j+11].s))continue;
  const last=tokens[j+11],start=tokens[i].start,raw=input.text.slice(start,last.start+last.s.length);
  const code=head[1],name=head[2];
  const p=project(input,code,name,2026,raw,start);p.department=department;p.evaluatedFiscalYear=2025;
  p.evidence.push(evidence(input,TITLE,0),evidence(input,LIST));
  p.amounts.push({kind:'fullCost',fiscalYear:2025,amountYen:Number(cost.replaceAll(',',''))*1000,rawValue:cost,rawUnit:'千円',evidence:evidence(input,raw,start)});
  p.ratings.push({kind:'self',label:'事業動向',value:last.s,scale:null,evidence:evidence(input,raw,start)});
  p.warnings.push('金額種別は原資料見出し「事業総コスト（千円）」に基づき総コストとして保持。算定式（歳入控除・財源控除等の有無）は本資料に記載がなく、支出決算額と同義ではありません。');
  if(cost.startsWith('-'))p.warnings.push('原資料の事業総コストは負数。原表記の符号を維持しており、歳入控除等の算定内訳は未確認です。負数をゼロ・正数に補正していません。');
  p.warnings.push('評価結果一覧の行を部分構造化（抽出テキストは1セル1行）。No・大項目・中項目・事業番号・事業名・所属名・事業総コスト・小評価8欄・総合評価3欄・事業動向が順に並ぶ行のみ採用し、事業番号行が離れた行や列順が崩れたページの行は除外。小評価・総合評価は見出しとの列対応が抽出テキストから確定できないため未構造化。活動・成果指標は本資料にありません。');
  const old=out.get(code);
  if(old){if(old.projectName!==name||old.amounts[0].rawValue!==cost||old.ratings[0].value!==last.s)conflicts.add(code);else old.evidence.push(evidence(input,raw,start));continue;}
  out.set(code,p);
 }
 return [...out].filter(([code])=>!conflicts.has(code)).map(([,p])=>p);
}
export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '11219':{extract,scope:'令和８年度上尾市行政評価の事務事業評価結果一覧（令和７年度に実施した事業）のうち列順が確定できる行の事業番号・事業名・所属名・事業総コスト・事業動向のみ。施策評価シート・政策評価、小評価・総合評価の各欄、コメントは対象外。'},
};
