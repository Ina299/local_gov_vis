import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** H22 external project opinions joined to same-number appendices, never counted twice. */
export function extractMarugame(input:CachedInput):ProjectEvaluation[]{
 if(input.municipalityCode!=='37202'||input.sourceId!=='db0d1e8fda886d55fbade986'||input.format!=='pdf'||input.truncated)return[];
 const headers=[...input.text.matchAll(/^事業(?:番号|名) ([０-９0-9]+) 事業名 (.+?) 事業費 ([\d,]+) 千円\n/gm)];
 const appendices=[...input.text.matchAll(/^事務事業評価シート 事業番号 (\d+)\n【事業概要】/gm)];
 const result:ProjectEvaluation[]=[];
 for(let i=0;i<headers.length;i++){
  const h=headers[i],start=h.index!,code=h[1].normalize('NFKC');
  let end=headers[i+1]?.index??input.text.indexOf('\n(2) その他全般にわたる意見等',start);
  if(end<0)continue;
  const raw=input.text.slice(start,end);
  if(!raw.includes('所見'))continue;
  const item=project(input,code,h[2],2010,raw,start);
  const opinion=raw.match(/^廃止 統合 協働・民活 改善 現状継続 (改善|統合|廃止|現状継続|協働・民活)\n[^\n]+\n([\s\S]+)/m);
  if(opinion){
   item.ratings.push({kind:'external',label:'行政評価委員会・事業の方向性',value:opinion[1],scale:null,evidence:evidence(input,opinion[0],start+opinion.index!)});
   item.outcomes=`【外部評価委員会の所見】${opinion[2].trim()}`;
  }
  const appendixIndex=appendices.findIndex(a=>a[1]===code);
  if(appendixIndex>=0){
   const a=appendices[appendixIndex],offset=a.index!;
   const text=input.text.slice(offset,appendices[appendixIndex+1]?.index??input.text.length);
   item.evidence.push(evidence(input,text,offset));
   item.department=text.match(/^２\.担当部名 (.+?) ３\.担当課名 (.+)$/m)?.slice(1).join(' ')??null;
   // H22 budget expense excludes personnel explicitly; header summary totals include estimates.
   const budget=text.match(/【平成22年度予算】\n①事業に要する経費\n([\d,]+) （千円）\n（人件費を除く）/);
   if(budget)item.amounts.push({kind:'budget',fiscalYear:2010,amountYen:Number(budget[1].replaceAll(',',''))*1000,rawValue:budget[1],rawUnit:'千円',evidence:evidence(input,budget[0],offset+budget.index!)});
   const history=text.match(/【事業費の推移（千円）と実績】[^\n]*\n財源内訳\n年度 決算額\n一般財源 国・県支出金 起債 その他\n/);
   if(history){
    const rows=text.slice(history.index!+history[0].length).matchAll(/^H(19|20|21) ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)\n/gm);
    for(const r of rows){if(Number(r[2].replaceAll(',',''))!==r.slice(3).reduce((sum,v)=>sum+Number(v.replaceAll(',','')),0))continue;
     item.amounts.push({kind:'actual',fiscalYear:1988+Number(r[1]),amountYen:Number(r[2].replaceAll(',',''))*1000,rawValue:r[2],rawUnit:'千円',evidence:evidence(input,r[0],offset+history.index!+history[0].length+r.index!)});
    }
   }
  }
  item.warnings.push('外部評価の事業別意見と同番号の参考個票を統合。枝項目別所見・再掲個票を別事業として数えません。対象年度は単一に確定せず未設定。見出し事業費は人件費含む概算のため金額化せず、明示されたH22予算と全財源列が揃い合計一致する過年度決算のみ構造化。');
  result.push(item);
 }
 return result;
}
