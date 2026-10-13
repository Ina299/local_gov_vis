import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractOfunato(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='03203'||input.format!=='pdf'||input.truncated)return [];
 const text=input.text;const identity=text.match(/^事務事業ID\n(\d+)\n令和 2 年度 事務事業評価シート/);const name=text.match(/^事務事業名 (.+?) 実施計画登載事業/m);
 if(!identity||!name||!text.includes('－ 2/2 － （大船渡市）'))return [];
 const item=project(input,identity[1],name[1],2020,text,0);item.evaluatedFiscalYear=2019;item.department=text.match(/^部課名 (.+?) 期間限定複数年度/m)?.[1]??null;
 const start=text.indexOf('(2) 総事業費・指標等の推移');const end=text.indexOf('－ 1/2 －');const block=text.slice(start,end);
 const header='27年度 (実績) 28年度 (実績) 29年度 (実績) 30年度 (実績） 元年度 (実績) 2年度 (目標)';
 if(block.includes(header)){
  const labels=[['事業費計 （A）','actual'],['人件費計 (B)','personnel'],['トータルコスト(A)＋(B)','fullCost']] as const;
  for(const [label,kind] of labels){const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const row=block.match(new RegExp(`^.*?${escaped} 千 円 ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+)$`,'m'));
   if(row)for(let i=1;i<=5;i++)item.amounts.push({kind,fiscalYear:2014+i,amountYen:Number(row[i].replace(/,/g,''))*1000,rawValue:row[i],rawUnit:'千円',evidence:evidence(input,block,start)});
  }
  for(const [letter,name,unit] of [['サ','実施済調査地点数','地点'],['シ','実施済調査項目数','項目']]){
   const label=text.match(new RegExp(`${letter} ${name} ${unit}`));if(!label)continue;
   const row=block.match(new RegExp(`^(?:⑦成果指標 )?${letter} ${unit} ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+) ([\\d,]+)$`,'m'));
   if(row){item.evidence.push(evidence(input,label[0],label.index));for(let i=1;i<=5;i++)item.indicators.push({name:`【成果指標】${name}`,unit,fiscalYear:2014+i,target:null,actual:row[i],evidence:evidence(input,block,start)});}
  }
 }
 item.warnings.push('2020評価、前年度2019実績。表の平成27～30年度・令和元年度実績のみ転記し、令和2年度目標と冒頭の複数年度事業用全体計画0円は実績に含めません。選択印を失った評価欄は判定を推測していません。直接費・人件費とその合計は加算不可。');return [item];
}
