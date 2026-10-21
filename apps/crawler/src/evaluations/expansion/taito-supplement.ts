import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput,evidence,project } from './shared';

/** Complete per-project HTML table rows; the separately registered first PDF row is excluded. */
export function extractTaitoSupplement(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='13106'||input.sourceId!=='f6042ad2f86315f4e34339a4'||input.format!=='html')return[];
 const text=input.text;const header=text.match(/事務事業評価一覧表\nNo\.[\s\S]*?H30\n実績値[\s\S]*?目的\n達成度\n/);
 if(!header||!text.startsWith('令和元年度 事務事業評価結果'))return[];
 const starts=[...text.matchAll(/^(\d+)\n([^\n]*(?:部|委員会|事務局))\n([^\n]+)\n/gm)];const result:ProjectEvaluation[]=[];
 for(let i=0;i<starts.length;i++){
  if(input.truncated&&i===starts.length-1)continue;
  const m=starts[i];const end=starts[i+1]?.index??text.indexOf('■ 行政評価のＴＯＰへ戻る',m.index!);
  if(end<0||m.index!<header.index!||m[1]==='1')continue;
  const raw=text.slice(m.index!,end);const body=raw.slice(m[0].length);
  const ratings=body.match(/^([1-5])\n([1-5])\n([1-5])\n([1-5])\n(維持|改善|拡大|縮小|廃止・終了)\n/gm);
  if(ratings?.length!==1)continue;
  const marker=ratings[0];const offset=body.indexOf(marker);const cells=body.slice(0,offset).trim().split('\n');
  if(cells.length<4)continue;
  const comments=body.slice(offset+marker.length).trim();if(!comments)continue;
  const p=project(input,`html-row-${m[1]}`,cells[0],2019,raw,m.index);
  p.department=m[2]+' '+m[3];p.evaluatedFiscalYear=2018;p.outcomes=comments;
  p.evidence.push(evidence(input,header[0],header.index));
  const values=marker.trim().split('\n');
  for(const[j,label]of['必要性','効率性','手段の適切性','目的達成度','方向性'].entries())p.ratings.push({kind:'self',label,value:values[j],scale:null,evidence:evidence(input,marker,m.index!+m[0].length+offset)});
  if(!['90','203'].includes(m[1]))p.indicators.push({name:`【指標】${cells.slice(1,-2).join('')}`,fiscalYear:2018,target:null,actual:/^[-－―]$/.test(cells.at(-2)!)?null:cells.at(-2)!,unit:/^[-－―]$/.test(cells.at(-1)!)?null:cells.at(-1)!,evidence:evidence(input,raw,m.index)});
  p.warnings.push('HTMLの事業別評価一覧行。表頭で平成30年度実績を確認。活動・成果区分はこの表に明示されず【指標】で保持。費用欄はない。既存PDFの行政経営推進（行1）は重複防止のため除外。行90の複数値と行203の将来注記付き指標は数値化せず原文保持。');
  result.push(p);
 }
 return result;
}
