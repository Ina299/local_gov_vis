import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from './shared';
const externalSources:Record<string,number>={
 '3331314e3e38e4308335f360':2013,'11144ed252ce3c0da4729e72':2014,'0cc89f4d61a6ae6de905a7f7':2015,
 '463830e28109355720bdfb2c':2016,'99b8b97bcd0b392862b37f19':2018,'c7d351e27a42b39c31094eee':2019,
 'bcc3f38e236212c54babb233':2020,'22865a99950729e27b8fda7c':2022,'efb1de0460170d14016aefdf':2023,'7cfd2d1a220285b0f7891dea':2024,
};
/** External evaluation units, not the summary listing or constituent budget lines. */
export function extractMarugameSupplement(input:CachedInput):ProjectEvaluation[]{
 const year=externalSources[input.sourceId];if(input.municipalityCode!=='37202'||!year||input.format!=='pdf')return[];
 const t=input.text;const start=t.indexOf('事 業 別 評 価 結 果');
 const heads=[...t.matchAll(/^(?:事業)?№ (?:予算事業名|取組名称) 所管部?課\n/gm)].filter(m=>{
  const next=t.indexOf('＜',m.index!+m[0].length);return m.index!>start&&next-m.index!<220&&/^＜(?:主な事業概要|事業の概要|取組の目的)＞/.test(t.slice(next));
 });
 const out:ProjectEvaluation[]=[];
 for(let i=0;i<heads.length;i++){
  const m=heads[i];const footer=t.slice(m.index!).search(/^４[．.]\s*丸亀市行政評価委員会について/m);
  const end=heads[i+1]?.index??(footer<0?-1:m.index!+footer);if(end<0||input.truncated&&i===heads.length-1)continue;
  const raw=t.slice(m.index!,end);const marker=raw.indexOf('＜');const header=raw.slice(m[0].length,marker).trim();
  const lines=header.split('\n');const named=lines.find(l=>/^[①-⑳０-９\d]+(?:-[①-⑳])? /.test(l));if(!named)continue;
  const match=named.match(/^([^ ]+) (\S+)(?: (.*))?$/);if(!match)continue;
  let code=match[1].normalize('NFKC'),name=match[2],department=match[3]??null;
  const other=lines.filter(l=>l!==named);
  // H26 rows 5-1/5-2 share a single completed evaluation; keep one joint unit.
  if(year===2014&&code==='5-1'){
   name='家庭児童相談事業費／児童虐待・ＤＶ対策等支援事業費';code='5-1+5-2';department='子育て支援課';
  }else if(other.length){department=[department,...other].filter(Boolean).join(' ');}
  const overview=raw.match(/＜(?:主な事業概要|事業の概要|取組の目的)＞\n([\s\S]*?)\n＜評価結果＞/);
  const result=raw.match(/＜評価結果＞\n事業の方向性 ([\s\S]*?)\n＜各委員/);
  if(!overview||!result)continue;
  const direction=result[1].match(/^(拡充|改善|維持|縮小|廃止)/);if(!direction)continue;
  if(year===2020&&code==='1')code+='-'+department;
  const p=project(input,`external-${code}`,name,year,raw,m.index);p.department=department;p.activities=overview[1].trim();p.outcomes=result[1].trim();
  p.ratings.push({kind:'external',label:'事業の方向性',value:direction[1],scale:null,evidence:evidence(input,result[0],m.index!+result.index!)});
  p.evidence.push(evidence(input,t.slice(0,t.indexOf('\n丸亀市行政評価')+1),0));
  p.warnings.push('外部評価の独立した事業・取組単位。委員個人の投票数を最終評価へ転用せず、明示された事業の方向性と評価本文を保持。対象実績年度は評価年度から推定しない。本文中の金額・件数は年度・金額種別が明示された定型欄ではないため数値欄に転記しない。');
  if(code==='5-1+5-2')p.warnings.push('家庭児童相談と児童虐待・DV対策は原典の合同評価1票として保持し、同じ評価根拠を2事業へ複製しない。');
  out.push(p);
 }
 return out;
}
