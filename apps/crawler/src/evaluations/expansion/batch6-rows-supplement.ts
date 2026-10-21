import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const docs:Record<string,string>={'11219':'1ddd38b5f9624439f6ae412d','36489':'087d15d5bf7f69b936ea48a8','14384':'63faf204e9cb509818cdd624'};
/** Explicit single-line business evaluations, not name-only indexes. */
export function extractBatch6RowsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.format!=='pdf'||docs[input.municipalityCode]!==input.sourceId)return [];
 const out:ProjectEvaluation[]=[];let department:string|null=null;let offset=0;
 const seen=new Set<string>();
 for(const line of input.text.split('\n')){
  const start=offset;offset+=line.length+1;
  if(input.truncated&&offset>=input.text.length)continue;
  let code:string|undefined,name:string|undefined,values:string[]=[],cost:string|undefined;
  if(input.municipalityCode==='11219'){
   const m=line.match(/^\d+ \d+ \d+ (?:★ )?(\d+) (\S+) (\S+) (-?[\d,]+) (?:[☑a-dー] )+([A-D]) ([A-D]) ([A-D]) (\d\.\S+)(?: |$)/);
   if(m){[,code,name,department,cost]=m;values=[m[8]];}
  }else if(input.municipalityCode==='36489'){
   const head=line.match(/^令和７年度 事務事業評価 \d+ (\S+)$/);if(head)department=head[1];
   const m=line.match(/^\d+ (\d{4}-\d{3}) (.+) (\d+(?:拡大\(見直\)|統合\(見直\)|見直\(見直\)|移管\(見直\)|縮小\(見直\)|その他\(見直\)|現状継続|休止|廃止|完了・終了))$/);
   if(m){[,code,name]=m;values=[m[3]];}
  }else{
   const head=line.match(/^\d+ (\S+) (\d+) /);if(head)department=head[1];
   const m=line.match(/^(?:\d+ \S+ )?(\d+) (.+) (継続（[^）]+）|廃止・中止|完了) (継続（[^）]+）|廃止・中止|完了)$/);
   if(m){[,code,name]=m;values=[m[3],m[4]];}
  }
  if(!code||!name||seen.has(code))continue;
  seen.add(code);const p=project(input,code,name,2025,line,start);p.department=department;
  if(input.municipalityCode==='11219'){
   p.evaluatedFiscalYear=2024;
   const headerEnd=input.text.search(/^1 1 1 /m);
   const header=headerEnd>=0?input.text.slice(0,headerEnd):null;
   if(header)p.evidence.push(evidence(input,header,0));
   p.warnings.push('金額種別は原資料見出し「事業総コスト（千円）」に基づき総コストとして保持。算定式（歳入控除・財源控除等の有無）は本資料に記載がなく、支出決算額と同義ではありません。');
   if(cost?.startsWith('-'))p.warnings.push('原資料の事業総コストは負数。原表記の符号を維持しており、歳入控除等の算定内訳は未確認です。負数をゼロ・正数に補正していません。');
   if(cost)p.amounts.push({kind:'fullCost',fiscalYear:2024,amountYen:Number(cost.replaceAll(',',''))*1000,rawValue:cost,rawUnit:'千円',evidence:evidence(input,line,start)});
  }
  values.forEach((value,i)=>p.ratings.push({kind:'self',label:input.municipalityCode==='14384'?`${i+1}次評価`:input.municipalityCode==='36489'?'２次評価':'事業動向',value,scale:null,evidence:evidence(input,line,start)}));
  p.warnings.push('評価結果一覧の確定単行を部分構造化。詳細個票ではありません。活動・成果指標は未抽出。列や名称が折り返されている行は推測で結合せず除外しています。');out.push(p);
 }
 return out;
}
