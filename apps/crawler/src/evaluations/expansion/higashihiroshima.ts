import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Individual detail narratives only; policy-group tables and group costs are excluded. */
export function extractHigashihiroshima(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34212' || input.format !== 'pdf' || input.truncated) return [];
  const year = input.text.match(/^令和([４５６])年度目的別事業群説明書\(決算\)/);
  if (!year) return [];
  const fiscalYear = 2018 + Number(year[1].normalize('NFKC'));
  // Every header, including unsupported wrapped names, participates in boundary detection.
  const headers = [...input.text.matchAll(/^事務事業 ([^\n]+)$/gm)];
  const records: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const m = headers[i][0].match(/^事務事業 ([\d０-９]+[-－][\d０-９]+) (.+?) 予算 ([\d,]+) 千円 決算 ([\d,]+) 千円$/);
    if (!m) continue;
    const start = headers[i].index!;
    let text = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const boundary = text.search(/\n(?:事業の概要|概要シート|令和 [456] 年度 目的別事業群総括管理)/);
    if (boundary >= 0) text = text.slice(0, boundary);
    if (!/^内容$/m.test(text) || text.length < 140 || !/\n-\d+-\s*$/.test(text)) continue;
    const code = `${m[1].normalize('NFKC')}：${m[2]}`;
    if (seen.has(code)) continue;
    seen.add(code);
    const record = project(input, code, m[2], null, text, start);
    record.evaluatedFiscalYear = fiscalYear;
    const headerEvidence = evidence(input, headers[i][0], start);
    for (const [kind, value] of [['budget', m[3]], ['actual', m[4]]] as const) {
      const amountYen = Number(value.replaceAll(',', '')) * 1000;
      if (Number.isSafeInteger(amountYen)) record.amounts.push({ kind, fiscalYear, amountYen,
        rawValue: value, rawUnit: '千円', evidence: headerEvidence });
    }
    const outcome = text.indexOf('【成果・課題】');
    if (outcome >= 0) record.outcomes = text.slice(outcome).replace(/\n-\d+-\s*$/, '').trim();
    record.activities = text.slice(text.indexOf('\n内容\n') + 4, outcome >= 0 ? outcome : undefined).replace(/\n-\d+-\s*$/, '').trim();
    record.warnings.push('目的別事業群の総括票ではなく、事業ごとの内容・成果・課題を記載した詳細節を部分構造化しています。群の合計費用・成果指標は配分していません。識別子は群内番号が資料内で再使用されるため原文番号と事業名を組み合わせたものです。');
    records.push(record);
  }
  return records;
}
