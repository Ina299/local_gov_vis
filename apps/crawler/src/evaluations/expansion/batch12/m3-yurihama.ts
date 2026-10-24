/** Batch-12 (m3) extractor for 31370 湯梨浜町: 教育行政の点検及び評価（平成21・22年度）の「教育委員会点検・評価における主要事業シート」. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, nfkc, type Entry } from '../batch9/i1-util';

/** 平成22年度版・平成21年度版。平成23年度以降は施策レベルの点検・評価（主要施策・重点施策）のため対象外。 */
const SOURCES = new Set(['c02d3310be6bae69ab4e1037', 'ded88d1f08fcc411f6697785']);
const TITLE = /^平成([２-９０-９]+)年度\n\n湯梨浜町教育行政の点検及び評価\n/;
const HEAD = '教育委員会点検・評価における主要事業シート\n';
const NAME = /^教育委員会点検・評価における主要事業シート\n事業名 ?([0-9０-９]+)[．.] ?([^\n]+)\n(?=事業のねらい|担当課|\n)/;
const DEPT = /担当課(?: |\n\n)([^\n]+?(?:課|室|館)(?:（[^）\n]+）)?)\n/;
const YEN = '([0-9０-９][0-9０-９,]*) 円';

function yurihama(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '31370' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const fy = 1988 + Number(nfkc(title[1]));
  const starts = [...t.matchAll(new RegExp(HEAD, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length), nm = NAME.exec(sheet);
    if (!nm) return;
    const name = nm[2].trim(), no = nfkc(nm[1]);
    const p = project(input, `No.${no}`, name, null, nm[0].slice(HEAD.length).trim(), s + HEAD.length);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0].trim(), 0));
    const dept = DEPT.exec(sheet);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), s + dept.index)); }
    // 予算額・決算額: one stand-alone 「N 円」 line between the 予算額 label and the 決算額 label, and one right after the 決算額 label.
    const ya = sheet.indexOf('予\n\n算\n\n額'), ka = sheet.indexOf('決\n\n算 額', ya);
    if (ya >= 0 && ka > ya) {
      const zone = sheet.slice(ya, ka), lines = [...zone.matchAll(/(?<=\n)([^\n]*円)(?=\n)/g)];
      const budget = lines.length === 1 ? new RegExp(`^${YEN}$`).exec(lines[0][1]) : null;
      const actual = new RegExp(`^決\\n\\n算 額\\n\\n${YEN}\\n(?!\\n?[^\\n]*円)`).exec(sheet.slice(ka));
      if (budget && actual) {
        p.amounts.push(amount(input, 'budget', fy, budget[1], '円', lines[0][1], s + ya + lines[0].index!));
        p.amounts.push(amount(input, 'actual', fy, actual[1], '円', actual[0].trim(), s + ka));
      } else if (lines.length) p.warnings.push('予算額・決算額が学校別・内訳別など複数の金額に分かれて出力されるため未収録。');
    }
    p.warnings.push(`湯梨浜町教育委員会「平成${nfkc(title[1])}年度 湯梨浜町教育行政の点検及び評価」の主要事業シート（No.${no}）。自己評価・課題は文章のため未収録。評価年度は本文に明記がないため未設定。`);
    out.push(p);
  });
  return out;
}

export const yurihamaEntries: Record<string, Entry> = {
  '31370': {
    extract: input => yurihama(input),
    scope: '湯梨浜町 教育行政の点検及び評価（平成21・22年度）の「主要事業シート」の事業名・担当課・予算額と決算額（各1件に確定するもののみ、円）。平成23年度以降の施策レベルの点検・評価、事業名が改行で分割されるシート、学校別などに分かれる金額は対象外。',
  },
};
