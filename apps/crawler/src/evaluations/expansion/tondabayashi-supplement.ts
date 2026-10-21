import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Additional 2024 sheets only; the legacy 2025 extraction remains frozen. */
export function extractTondabayashiSupplement(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27214' || input.format !== 'pdf') return [];
  const headers = [...input.text.matchAll(/^令和 6 年度 事業評価シート$/gm)];
  const records: ProjectEvaluation[] = [];
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index!;
    const section = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const end = section.match(/^-[0-9]+-$/m) ?? section.match(/^C 充実$/m);
    if (!end) continue; // The final cached page may stop in the middle of its evaluation.
    const raw = section.slice(0, end.index! + end[0].length);
    const title = raw.match(/^事業番号 (\S+) 事業名称 (.+)$/m);
    if (!title || !raw.includes('■改善事項（ACTION）')) continue;
    const record = project(input, title[1], title[2], 2024, raw, start);
    record.department = raw.match(/^部署名 (.+)$/m)?.[1] ?? null;
    if (/令和5年度 令和6年度 令和7年度 令和8年度/.test(raw)) {
      record.evaluatedFiscalYear = 2023;
      const expensePart = raw.slice(0, raw.indexOf('■実施（DO）'));
      const amount = expensePart.match(/^決算 ([\d,]+)$/m);
      if (amount && expensePart.includes('（単位：千円）')) {
        record.amounts.push({ kind: 'actual', fiscalYear: 2023, amountYen: Number(amount[1].replaceAll(',', '')) * 1000, rawValue: amount[1], rawUnit: '千円', evidence: evidence(input, amount[0], start + amount.index!) });
      }
    }
    record.warnings.push('評価欄の選択肢と評価結果が交差する本文のため評価文字を推定せず個票全体を保持。金額は年度列が明示された単独の決算行のみ抽出。');
    records.push(record);
  }
  return records;
}

/** Four utility sheets omitted by the legacy numeric-code-only adapter. */
export function extractTondabayashi2025Missing(input: CachedInput): ProjectEvaluation[] {
 if(input.municipalityCode!=='27214'||input.format!=='pdf'||input.sourceId!=='0e5628aec4660c5f7a9d0a76'||input.truncated)return[];
 const headers=[...input.text.matchAll(/^令和 7 年度 事業評価シート$/gm)];const records:ProjectEvaluation[]=[];
 for(let i=0;i<headers.length;i++){
  const h=headers[i];const section=input.text.slice(h.index!,headers[i+1]?.index??input.text.length);const footer=section.match(/^-[0-9]+-$/m)??section.match(/^C 充実$/m);if(!footer)continue;
  const raw=section.slice(0,footer.index!+footer[0].length);const title=raw.match(/^事業番号 (未設定[1-4]) 事業名称 (.+)$/m);if(!title)continue;
  const r=project(input,title[1],title[2],2025,raw,h.index!);r.department=raw.match(/^部署名 (.+)$/m)?.[1]??null;r.evaluatedFiscalYear=2024;
  const row=raw.match(/【A】事業費 ([\d,]+) ([\d,]+) ([\d,]+)(?=\n|$)/);
  if(row&&raw.includes('事業コスト 令和5年度決算 令和6年度決算 令和7年度予算')&&raw.includes('（単位：千円）'))for(let c=0;c<3;c++)r.amounts.push({kind:c===2?'budget':'actual',fiscalYear:2023+c,amountYen:Number(row[c+1].replaceAll(',',''))*1000,rawValue:row[c+1],rawUnit:'千円',evidence:evidence(input,row[0],h.index!+row.index!)});
  r.warnings.push('事業番号は原文の「未設定」表記を維持。数値コードのみの旧抽出で未収録だった下水道4個票の追加。');records.push(r);
 }
 return records;
}
