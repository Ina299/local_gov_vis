import type {ProjectEvaluation} from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
export function extractBatch6FinalRowsSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.format!=='pdf')return [];const out:ProjectEvaluation[]=[];
 const add=(code:string,name:string,dept:string|null,year:number|null,fy:number|null,raw:string,value:string)=>{const p=project(input,code,name,year,raw,input.text.indexOf(raw));p.department=dept;p.evaluatedFiscalYear=fy;p.ratings.push({kind:'self',label:'内部評価の結果・方向性',value,scale:null,evidence:evidence(input,raw,input.text.indexOf(raw))});p.warnings.push('一覧の名称と評価が確定する部分のみ構造化。詳細個票ではなく、費用・数値成果は未抽出。折返し名称や他列の文章を推測結合していません。');out.push(p);};
 if(input.municipalityCode==='01213'&&input.sourceId==='7dabc2352647a8e82eebe60c'){
  const raw='02030202 防災備蓄品整備事業 危機管理室 A';if(input.text.includes(raw))add('02030202','防災備蓄品整備事業','危機管理室',null,2024,raw,'A');
 }else if(input.municipalityCode==='40217'&&input.sourceId==='cbabc72ca249d54944bae1ef'){
  for(const m of input.text.matchAll(/^(3|7) (病児保育事業|選挙啓発事業) \d+ (\S+) [^\n]*見直し[^\n]*$/gm))add('internal-'+m[1],m[2],m[3],2025,2024,m[0],'見直し');
 }else if(input.municipalityCode==='14301'&&input.sourceId==='b22c7d8aa815b96b1155b898'){
  const specs=[['6','文化公演事業','福文','６ 福文 文化公演事業','■休止'],['8','緑化事業','環境課','８ 環境課 緑化事業','■廃止']];
  for(const [code,name,dept,anchor,value]of specs){const start=input.text.indexOf(anchor);if(start<0)continue;const end=input.text.indexOf('\n',start);const from=code==='8'?input.text.lastIndexOf('\n',start-2)+1:start;const raw=input.text.slice(from,end);if(raw.includes(value))add(code,name,dept,2010,2009,raw,value);}
 }
 return out;
}
