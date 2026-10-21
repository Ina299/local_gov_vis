import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Thirteen real R6 closing-account sheets; OCR-damaged numeric columns are not reconstructed. */
export function extractChigasaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14207' || input.sourceId !== 'c461260f8903dc6aa3fa0fa2' || input.format !== 'pdf' || input.truncated) return [];
  const headers=[...input.text.matchAll(/^(?:3 )?令和 6年度決算事業評価シート\n評価対象：令和 6年度決算\n/gm)];
  const results:ProjectEvaluation[]=[];
  const seen=new Set<string>();
  for(let i=0;i<headers.length;i++){
    const start=headers[i].index!;
    const block=input.text.slice(start,headers[i+1]?.index??input.text.length);
    const footer=block.match(/^-(\d+)-$/m);
    if(!footer)continue;
    // End at the first printed footer, excluding the next committee's divider/list.
    const raw=block.slice(0,footer.index!+footer[0].length);
    const name=raw.match(/\n(?:ー|1 基礎情報)\n([^\n]+)\n/);
    if(!name||!raw.includes('4月1日時点）'))continue;
    let title=name[1];
    // The same name is independently readable without this OCR border in the contents.
    if(title==='I公共下水道施設の地震対策事業'&&input.text.includes('公共下水道施設の地震対策事業―'))title=title.slice(1);
    if(seen.has(title))throw new Error(`Duplicate Chigasaki title: ${title}`);
    seen.add(title);
    const item=project(input,`name:${title}`,title,null,raw,start);
    item.evaluatedFiscalYear=2024;
    const afterName=raw.slice(name.index!+name[0].length);
    item.department=afterName.match(/^([^\s]+部[^\s]*課)(?= |\n)/)?.[1]??null;
    const description=raw.match(/年 ?4月1日時点）\n([\s\S]+?)(?=\n(?:I\n|[口■璽圃]|1\n1\n1直営|ー\nヘ))/);
    if(description&&description[1].trim()){
      item.activities=`【事業概要】${description[1].trim()}`;
      item.evidence.push(evidence(input,description[0],start+description.index!));
    }
    item.warnings.push(`原典印刷ページ${footer[1]}の個票。R6は決算対象年度で、評価実施年度は不明。事業コードは本文から確認できないため名称で識別。OCRに桁分断・列見出し欠損があり、費用・指標数値・選択評価を推測で復元していません。事業概要以外の左右列混在文章は原文証拠に保持。`);
    if(name[1]!==title)item.warnings.push('個票名称先頭のOCR文字Iは目次の同一名称と照合して罫線由来と判断し除外。');
    results.push(item);
  }
  return results;
}
