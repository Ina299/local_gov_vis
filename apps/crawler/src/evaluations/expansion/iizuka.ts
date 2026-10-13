import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractIizuka(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='40205'||input.format!=='pdf'||input.truncated)return [];
 const text=input.text;
 const title=text.match(/^令和(\d+)年度 飯塚市事務事業評価シート 令和 (\d+) 年 (\d+) 月 (\d+) 日 作成/);
 const identity=text.match(/^事務事業名 (.+) 事務事業№ (\d+) - (\d+)$/m);
 if(!title||!identity||!text.includes('６．事務事業の事後評価')||!text.includes('９.今後の事業の方向性と改善策'))return [];
 const year=2018+Number(title[1]);
 // The document labels the assessed year. Creation date alone is not an evaluation cycle.
 const item=project(input,`${identity[2]}-${identity[3]}`,identity[1],null,text,0);item.evaluatedFiscalYear=year;
 const department=text.match(/担当部 担当課 担当係 作成者職名 作成者氏名 所属長職名 所属長氏名\n(\S+) (\S+)/);
 item.department=department?`${department[1]} ${department[2]}`:null;
 const from=text.indexOf('５．事務事業実施にかかるコスト');const end=text.indexOf('６．事務事業の事後評価');
 const cost=text.slice(from,end);
 if(cost.includes('前年度実績（千円） 本年度実績（千円）')&&cost.includes('次年度予算（千円）')){
  const labels=[['人件費計（Ａ）','personnel'],['直接事業費（Ｂ）','actual'],['総事業費（Ａ+Ｂ）','fullCost']] as const;
  for(const [label,kind] of labels){
   const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const row=cost.match(new RegExp(`^${escaped} ([\\d,]+) ([\\d,]+) ([\\d,]+)$`,'m'));
   if(!row)continue;
   for(const [column,fiscalYear] of [[1,year-1],[2,year]])item.amounts.push({kind,fiscalYear,amountYen:Number(row[column].replace(/,/g,''))*1000,rawValue:row[column],rawUnit:'千円',evidence:evidence(input,cost,from)});
   if(kind==='actual')item.amounts.push({kind:'budget',fiscalYear:year+1,amountYen:Number(row[3].replace(/,/g,''))*1000,rawValue:row[3],rawUnit:'千円',evidence:evidence(input,cost,from)});
  }
 }
 const kpiStart=text.indexOf('４．成果指標（決算成果説明書と連動）');
 const kpi=text.slice(kpiStart,from);
 const heads=[...kpi.matchAll(/^指 [^\n]*単位 達成目標値 前年度実績 本年度実績 次年度見込\n/gm)];
 const value='[0-9０-９,，.．%％-]+';
 for(let i=0;i<heads.length;i++){
  const offset=heads[i].index!;const block=kpi.slice(offset,heads[i+1]?.index??kpi.length);
  const fields=block.match(new RegExp(`^指 単位[^\\n]+\\n([^\\n]+)\\n標 (\\S+) ${value} 目標値 (${value}) (${value}) (${value})$`,'m'));
  const actual=block.match(new RegExp(`実 績 (${value}) (${value})$`,'m'));
  if(!fields||!actual)continue;
  if(/^[0-9０-９]+$/.test(fields[2])) item.warnings.push(`成果指標「${fields[1]}」の原文単位は「${fields[2]}」で、単位として不明瞭です。推測修正せず原文を保持。`);
  if(/[％%]/.test(fields[2]) && /件数$/.test(fields[1])) item.warnings.push(`成果指標「${fields[1]}」は名称が件数、原文単位が百分率です。目標と実績の意味の一致を未確認のため原票を参照してください。`);
  for(const [index,fiscalYear] of [[1,year-1],[2,year]]){
   if(actual[index]==='-')continue;
   item.indicators.push({name:`【成果指標】${fields[1]}`,unit:fields[2],fiscalYear,actual:actual[index],target:fields[index+2]==='-'?null:fields[index+2],evidence:evidence(input,block,kpiStart+offset)});
  }
 }
 const outcomeStart=text.indexOf('８．今年度評価における成果と課題');const outcomeEnd=text.indexOf('９.今後の事業の方向性と改善策');
 if(outcomeStart>=0&&outcomeEnd>outcomeStart){item.outcomes=text.slice(outcomeStart,outcomeEnd).trim();item.evidence.push(evidence(input,item.outcomes,outcomeStart));}
 item.warnings.push('表題年度は対象事業年度として保持。作成日だけで評価実施年度は推測していません。費用は列3値が完全な行だけ採用し、直接費実績・人件費実績・合計実績・翌年度直接費予算を区別。人件費と合計は加算不可。成果指標は名称・単位・年度列を保持できる欄のみ原表どおり転記し、次年度見込は実績・目標に転記していません。');
 return [item];
}
