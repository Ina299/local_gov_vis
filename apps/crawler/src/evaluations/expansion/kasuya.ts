import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Named project opinions from the external committee; not full assessment sheets. */
export function extractKasuya(input: CachedInput): ProjectEvaluation[] {
  if(input.municipalityCode!=='40349'||input.format!=='pdf'||!input.text.startsWith('粕屋町行政評価委員会 意見書'))return [];
  const year=input.text.match(/令和([４５])年/);const assessed=input.text.match(/が実施した令和([３４])年度の行政評価/);
  if(!year||!assessed)return [];
  const toNumber=(v:string)=>Number(v.normalize('NFKC'));
  const end=input.text.indexOf('■ 総 括 ■');if(end<0)return [];
  const headings=[...input.text.slice(0,end).matchAll(/^重点プロジェクト [^\n]+\n事務事業名 ([^\n]+)\n/gm)];
  const rows:ProjectEvaluation[]=[];const seen=new Set<string>();
  for(let i=0;i<headings.length;i++){
    const start=headings[i].index!;const block=input.text.slice(start,headings[i+1]?.index??end);
    if(!block.includes('１．委員会の評価結果及び意見等'))continue;
    const summaryStart=block.indexOf('２．本事業に係る外部評価のまとめ');if(summaryStart<0)continue;
    const name=headings[i][1].trim();if(seen.has(name))throw new Error(`Duplicate Kasuya opinion: ${name}`);seen.add(name);
    const item=project(input,`name:${name}`,name,2018+toNumber(year[1]),block,start);
    item.evaluatedFiscalYear=2018+toNumber(assessed[1]);
    item.department=block.match(/^担当部署 ([^\n]+)$/m)?.[1]??null;
    const purpose=block.indexOf('事業目的 ');const activity=block.indexOf('実施方法 ');const rating=block.indexOf('１．委員会の評価結果及び意見等');
    if(purpose>=0&&activity>purpose){item.purpose=block.slice(purpose,activity).trim();item.evidence.push(evidence(input,item.purpose,start+purpose));}
    if(activity>=0&&rating>activity){item.activities=block.slice(activity,rating).trim();item.evidence.push(evidence(input,item.activities,start+activity));}
    const summary=block.slice(summaryStart).replace(/\n[0-9]+\s*$/,'').trim();
    item.ratings.push({kind:'external',label:'本事業に係る外部評価のまとめ',value:summary,scale:null,evidence:evidence(input,summary,start+summaryStart)});
    item.warnings.push('行政評価委員会意見書の事業別外部評価意見を部分構造化。完全な事務事業評価個票ではありません。委員の評価割合は成果指標ではなく、全体総括も個別事業の成果として転記していません。');
    rows.push(item);
  }
  return rows;
}
