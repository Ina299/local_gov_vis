import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';

export type FieldCandidate = { field: 'purpose'|'activities'|'outcomes'|'evaluationYear'|'evaluatedFiscalYear'; value: string|number; quote: string };
export type MatchedBlock = { text:string; identityQuote:string };
const norm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
/** Exact source blocks only; repeated names are not resolved by proximity. */
export function assignment3Block(code:string,text:string,p:ProjectEvaluation):MatchedBlock|null {
  const patterns:Record<string,RegExp>={
    '08205':/^令和８年度 事務事業評価シート$/gm,
    '13214':/^事務事業評価票 所管課/gm,
    '27214':/^令和 7 年度 事業評価シート$/gm,
    '19207':/^行政評価シート（事務事業評価） 評価年度/gm,
    '35211':/^具体施策 \d+/gm,
  };
  const pattern=patterns[code];
  if(pattern){
    const starts=[...text.matchAll(pattern)].map(x=>x.index!);
    const candidates=starts.map((s,i)=>text.slice(s,starts[i+1]??text.length)).map(b=>{
      const line = code==='08205'?b.match(/^事業名 (.+?)(?: 款 |$)/m):code==='13214'?b.match(/^事業番号 (\d+) 事務事業 (.+?) 細事業/m):code==='27214'?b.match(/^事業番号 (\d+) 事業名称 (.+)$/m):code==='19207'?b.match(/^事業名 (.+?) 担当課/m):b.match(/^事 業 名 (.+)$/m);
      if(!line)return null;
      const name=line[code==='13214'||code==='27214'?2:1];
      if(norm(name)!==norm(p.projectName))return null;
      if(p.projectCode&&['13214','27214'].includes(code)&&norm(line[1])!==norm(p.projectCode))return null;
      return {text:b,identityQuote:line[0]};
    }).filter((x):x is MatchedBlock=>!!x);
    return candidates.length===1?candidates[0]:null;
  }
  // Existing char-offset evidence supplies an already reviewed independent sheet boundary.
  const ev=p.evidence.filter(e=>e.rawText.length>150&&e.cell?.startsWith('extracted-text:chars:')&&text.includes(e.rawText)).sort((a,b)=>b.rawText.length-a.rawText.length)[0];
  if(!ev)return null;
  const line=ev.rawText.split('\n').find(x=>norm(x).includes(norm(p.projectName)));
  return line?{text:ev.rawText,identityQuote:line}:null;
}
const between=(b:string,start:RegExp,end:RegExp):string|null=>{
  const m=start.exec(b);if(!m)return null;const tail=b.slice(m.index+m[0].length);const e=end.exec(tail);return e?tail.slice(0,e.index).trim():null;
};
const sentence=(s:string|null)=>s?.match(/^[\s\S]*?。/)?.[0].trim()??null;
export function assignment3Fields(code:string,b:string,p:ProjectEvaluation):FieldCandidate[]{
  const out:FieldCandidate[]=[];
  const add=(field:FieldCandidate['field'],s:string|null)=>{if(s&&s.length>=8&&s.length<3000&&b.includes(s)&&p[field]===null)out.push({field,value:s,quote:s});};
  if(code==='08205'){
    const purpose=sentence(between(b,/意図\n\(どのように\)\n/,/事業の概要/));
    add('purpose',purpose);
    if(purpose){
      const rest=b.slice(b.indexOf(purpose)+purpose.length);const section=rest.slice(0,rest.search(/事業全体|長 期 目 標/));
      // Keep the original inline label when it bisects the same narrative; do not join fragments.
      if(section.includes('事業の概要')) add('activities',sentence(section.trim()));
    }
    const result=between(b,/６\.事業評価（総括評価）[^\n]*\n事業の成果\n/,/事業の方向性/);
    if(result)add('outcomes',result);
  }
  if(code==='27214'){
    const section=between(b,/（単位：千円） [^\n]*\n/,/【A】/);
    if(section?.includes('事業目的')){
      const value=sentence(section.replace(/^事業目的\n/,''));
      if(value&&!/[【】]|事業費|財源|人件費/.test(value))add('purpose',value);
    }
  }
  if(code==='13214'){
    const m=b.match(/^事業目的 ([^\n]+。)$/m);add('purpose',m?.[1]??null);
  }
  if(code==='11365'){
    // Only a complete sentence on the explicitly labelled evaluation-year line is unambiguous.
    const m=b.match(/^評価年度 令和 7 年度 (.+。)$/m);add('purpose',m?.[1]??null);
  }
  if(code==='19207'){
    const section=between(b,/^事業名 [^\n]+\n/m,/^１ 計画/m);
    if(section?.includes('事業内容（簡潔に）'))add('activities',section.replace(/^事業内容（簡潔に） /,''));
  }
  if(code==='06205'){
    add('purpose',sentence(between(b,/事業の目的 /,/\n事業の内容 /)));
  }
  if(code==='30206'){
    const section=between(b,/^事 業 名 [^\n]+\n/m,/\n事\n/);
    if(section?.includes('実 施 目 的'))add('purpose',section);
  }
  if(code==='05214'){
    const m=b.match(/^目的・成果 (.+)$/m);add('purpose',m?.[1]??null);
  }
  if(code==='35211'){
    add('activities',between(b,/【事業の概要】\n/,/【事業の成果[・･]課題】/));
    add('outcomes',between(b,/【事業の成果[・･]課題】\n/,/事業の\n必要性|事業の評価|事業の\n評価/));
  }
  return out;
}
