import type {ProjectEvaluation} from '../../../../../web/src/types/evaluation';
import {type CachedInput,evidence,project} from '../shared';
/** 栗山町「令和4年度｜政策評価結果」ページ末尾の外部評価（政策評価委員会）結果表。3行（政策分野・評価事業・外部評価結果）だけを読む。 */
const SOURCE='b1f9151fc2821eff142e13d2';
const TITLE='令和4年度｜政策評価結果 - 栗山町公式ホームページ';
const HEADER='政策分野\n評価事業\n外部評価結果\n';
const RESULT=/^(計画通りに進める|改善を検討|抜本的見直し)$/;
function extract(input:CachedInput):ProjectEvaluation[]{
 if(input.sourceId!==SOURCE||!input.text.startsWith(TITLE))return [];
 const h=input.text.indexOf(HEADER);if(h<0||input.text.indexOf(HEADER,h+1)>=0)return [];
 const end=input.text.indexOf('（2）',h);if(end<0)return [];
 const lines:{s:string;start:number}[]=[];let offset=h+HEADER.length;
 for(const line of input.text.slice(offset,end).split('\n')){if(line)lines.push({s:line,start:offset});offset+=line.length+1;}
 // 各行は 大分野 / 小分野 / 事業名 / 結果 の4行。
 if(lines.length!==12)return [];
 const out:ProjectEvaluation[]=[];
 for(let i=0;i<12;i+=4){
  const name=lines[i+2],result=lines[i+3];if(!RESULT.test(result.s))return [];
  const start=lines[i].start,raw=input.text.slice(start,result.start+result.s.length);
  const p=project(input,name.s,name.s,2022,raw,start);
  p.ratings.push({kind:'external',label:'政策評価委員会 外部評価結果',value:result.s,scale:null,evidence:evidence(input,result.s,result.start)});
  p.evidence.push(evidence(input,'事中評価（4～9月の実施状況に対する評価）'));
  p.warnings.push('令和4年度政策評価結果ページの外部評価結果表（事中評価）。評価年度は表題の令和4年度。評価対象期間は「4～9月の実施状況」とあるが対象年度の明記がないため評価対象年度は空。担当課・予算・指標はページに無く、事後評価（担当課評価）の個別結果は別PDFのため未構造化。');
  out.push(p);
 }
 return out;
}
export const entries:Record<string,{extract:(input:CachedInput,inputs:CachedInput[])=>ProjectEvaluation[];scope:string}>={
 '01429':{extract,scope:'令和4年度政策評価結果ページの政策評価委員会（外部評価）3事業の判定のみ。令和5年度委員会報告書は既存データと同一事業・同年度のため除外。担当課評価189事業の個別結果・個人評価点は対象外。'},
};
