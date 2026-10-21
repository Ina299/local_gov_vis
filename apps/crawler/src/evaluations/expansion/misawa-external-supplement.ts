import type{ProjectEvaluation}from '../../../../web/src/types/evaluation';
import{type CachedInput,evidence,project}from './shared';
import{extractMisawa}from './misawa';
const external:Record<string,{year:number;fy:number;names:string[]}>= {
 '244fa9c67fb4a37deae392b9':{year:2010,fy:2009,names:['家庭児童相談室設置費','介護予防一般高齢者事業','消費生活窓口事業']},
 '2c50cf843b96a1e855378c93':{year:2011,fy:2010,names:['危機管理能力の強化','国民保護計画の推進','防災知識の普及','校内研修講師派遣事業']},
 '1fc4bafb9960a75495f38555':{year:2012,fy:2011,names:['こころの健康まちづくり事業','医療機器購入費','地域生活支援事業費','介護予防特定高齢者事業','介護予防一般高齢者事業','介護予防支援事業','家庭教育学級運営事業費','広域漁港整備事業','観光費（観光ＰＲ推進事業）','古間木団地建替事業','南ニュータウン整備事業']},
};
function lines(input:CachedInput){return [...input.text.matchAll(/^[0-9０-９]+ ([0-9]{4}[A-Za-z]{2}[0-9]) (\S+)(?: (.*))?$/gm)];}
/** Combine new batch candidates only. The original extractor and baseline stay unchanged. */
export function extractMisawaWithExternalSupplement(input:CachedInput,inputs:CachedInput[]):ProjectEvaluation[]{
 const own=extractMisawa(input);
 if(input.municipalityCode!=='02207'||input.format!=='pdf')return own;
 for(const p of own)for(const source of inputs){const spec=external[source.sourceId];if(!spec||source.truncated||source.municipalityCode!=='02207'||p.evaluationYear!==spec.year||p.evaluatedFiscalYear!==spec.fy)continue;
  for(const m of lines(source))if(m[1]===p.projectCode){p.evidence.push(evidence(source,m[0],m.index!));p.warnings.push('同年度外部評価一覧の同一事業コード行を追加根拠として保持。外部意見は前後行と混在するため評定・成果文章へ未分離。');}
 }
 const spec=external[input.sourceId];if(!spec||input.truncated)return own;
 const baseline=inputs.flatMap(s=>extractMisawa(s));
 for(const m of lines(input)){
 const name=m[3]?.split(' ')[0];if(!name||!spec.names.includes(name)||baseline.some(p=>p.projectCode===m[1]&&p.evaluationYear===spec.year))continue;
 const p=project(input,m[1],name,spec.year,m[0],m.index!);p.evaluatedFiscalYear=spec.fy;p.department=m[2];
 p.evidence.push(evidence(input,input.text.split('\n').slice(0,2).join('\n'),0));
 p.warnings.push('外部評価一覧の事業コード・担当課・完結した名称行のみ部分抽出。同年度の内部一覧で抽出済みの同一コードは新規レコードにせず追加証拠を統合。総合評点は内部評価の再掲であり外部評定として転記しない。横長表の前後に混在する外部意見・方向性・費用は未抽出。');own.push(p);
 }
 return own;
}

const responses:Record<string,{year:number;names:Record<string,string>}>= {
 '4a161a48944a4bc3bdbdb7fe':{year:2010,names:{'2430Ab1':'生活対策費（消費者の会補助金）','2430Ac1':'消費生活窓口事業','4220Bx1':'畜産業費(市牛・じゃがまつり実行委員会補助金)','4220Cx2':'（仮）産直郷土食フェア運営費補助金','4411Ac1':'商工振興費（商工会商工振興事業費補助金他）','5110Bb2':'三沢市青い森鉄道活用会議事業'}},
 '642d9fa25f97ab619f75ac59':{year:2011,names:{'2121Ca1':'仏沼自然観察ボランティアガイド養成事業'}},
};
export function extractMisawaCombinedSupplement(input:CachedInput,inputs:CachedInput[]):ProjectEvaluation[]{
 const own=extractMisawaWithExternalSupplement(input,inputs);const spec=responses[input.sourceId];
 if(spec&&input.format==='pdf'&&!input.truncated){
  const existing=inputs.flatMap(s=>extractMisawaWithExternalSupplement(s,inputs));
  for(const [code,name]of Object.entries(spec.names)){
   if(existing.some(p=>p.projectCode===code&&p.evaluationYear===spec.year))continue;
   const m=[...input.text.matchAll(/^.*$/gm)].find(m=>m[0].includes(name)&&m[0].endsWith(code));if(!m)continue;
   const p=project(input,code,name,spec.year,m[0],m.index!);p.evidence.push(evidence(input,input.text.match(/平成[０-９]+年度 [^\n]+/)![0]));
   p.warnings.push('外部評価対応表の文字化け部分を除き、可読な名称・事業コード同一行のみ採用。対応年度は明示されるが対象実績年度は未明記のため未設定。同年度同コードは内部/外部一覧へ証拠統合。左右混在の外部意見・市回答は文章分離せず費用・評点も抽出しない。');own.push(p);
  }
 }
 for(const p of own)for(const other of inputs){const meta=responses[other.sourceId];if(!meta||other.sourceId===input.sourceId||other.truncated||meta.year!==p.evaluationYear)continue;for(const m of other.text.matchAll(/^.*$/gm))if(p.projectCode&&m[0].endsWith(p.projectCode))p.evidence.push(evidence(other,m[0],m.index!));}
 return own;
}
