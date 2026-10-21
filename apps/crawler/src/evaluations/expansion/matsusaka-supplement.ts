import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** Closed business rows in the retained beginning of chapter 3; policy stars are not business ratings. */
export function extractMatsusakaSupplement(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '24204' || input.sourceId !== 'afe3c327cc1563df042a0b57' || input.format !== 'pdf') return [];
  const sheets = [...input.text.matchAll(/^【([^】]+)】事務・事業管理シート(（ゼロ予算事業）)?$/gm)];
  const result: ProjectEvaluation[] = [];
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const start = sheet.index!;
    const chapterEnd = input.text.indexOf('第3章', start + sheet[0].length);
    const nextSheet = sheets[s + 1]?.index ?? -1;
    const end = chapterEnd < 0 ? nextSheet : nextSheet < 0 ? chapterEnd : Math.min(chapterEnd, nextSheet);
    if (end < 0) continue; // A final unclosed fragment is never accepted.
    const body = input.text.slice(start, end);
    if (!/^No\. 事業名 関係施策 令和[６6]年度 令和[７7]年度$/m.test(body)) continue;
    const headers = [...body.matchAll(/^当初予算（千円） 最終予算（千円） 活動指標 当初予算（千円） 活動指標$/gm)];
    for (let i = 0; i < headers.length; i++) {
      const offset = start + headers[i].index!;
      const raw = body.slice(headers[i].index!, headers[i+1]?.index ?? body.length);
      // Repeated zero-budget sheet headers start a new identity namespace.
      if (raw.includes('】事務・事業管理シート')) continue;
      const row = /^([0-9]+) (.+) ([1-7]-[①-⑳])$/m.exec(raw);
      if (!row) continue; // Wrapped names require layout review, not concatenation with indicator labels.
      const tail = raw.slice(row.index + row[0].length);
      const ratings = [...tail.matchAll(/(?:^|[ \n])([SABCDE])(?=[ \n]|$)/g)];
      if (ratings.length !== 1) continue;
      const p = project(input, `${sheet[1]}:${sheet[2] ? 'zero' : 'regular'}:${row[1]}`, row[2], null, raw, offset);
      p.department = sheet[1];
      p.evaluatedFiscalYear = 2024;
      p.evidence.push(evidence(input, input.text.slice(0, input.text.indexOf('\n', input.text.indexOf('\n') + 1))));
      p.evidence.push(evidence(input, sheet[0], start));
      p.evidence.push(evidence(input, body.slice(0, body.indexOf('\n当初予算')) ,start));
      p.ratings.push({ kind: 'self', label: '令和6年度 活動指標の評価', value: ratings[0][1], scale: null, evidence: evidence(input, raw, offset) });
      const budget = /^([\d,]+) ([\d,]+) 目標 実績 評価 /m.exec(tail);
      if (budget) p.amounts.push({ kind: 'budget', fiscalYear: 2024, amountYen: Number(budget[2].replaceAll(',', '')) * 1000, rawValue: budget[2], rawUnit: '千円', evidence: evidence(input, raw, offset) });
      p.warnings.push('第3章の完結した事業行のみ部分抽出。評点は活動指標の評価であり、施策全体の星評価とは別。金額は令和6年度の最終予算のみで決算額ではない。令和7年度は実行宣言の年度で評価実施年度へ転用しない。活動指標の目標・実績、当初予算、令和7年度予算は原文根拠に保持し数値列へ分離していない。保存本文は途中で切れており未収録の所属・行がある。');
      result.push(p);
    }
  }
  return result;
}
