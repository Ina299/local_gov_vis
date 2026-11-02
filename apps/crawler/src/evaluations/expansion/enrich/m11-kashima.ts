/**
 * 41207 鹿島市: 令和４年度 主要施策の成果説明書。公開済みレコード（各事業の見出し表）の空欄の事業内容を補う。
 * 事業名・所管課は公開済みレコードを作った抽出（batch12/m7-e）をそのまま使う。見出し表（事業名・事業費・財源・所管課・費目）の
 * 直後に「事業内容」欄の本文が続くため、見出し表の最後の値の次の段落（句点で終わり、途中の行がすべて欄の幅いっぱいで折り返すもの）を
 * 事業内容とする。段落の後に続く表・箇条（○の見出し）は収録しない。段落の後が○の見出し・欄の見出し・ページ番号・次の事業以外のときは採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { stableId, type CachedInput } from '../shared';
import { entries as m7e } from '../batch12/m7-e';
import { block, blockEvidence } from './m3-narrative';

/** 本文1行は全角42字前後。 */
const WRAP = 35;
const NEXT = /^\n\n([○〇]|事業内容\n|-\d+-\n|事業名\n|[^\n]*の主な事業)/;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '41207') return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const p of m7e['41207'].extract(input, inputs)) {
    const cell = /^extracted-text:chars:(\d+)-(\d+)$/.exec(p.evidence[0].cell ?? '');
    if (!cell) continue;
    const end = Number(cell[2]);
    if (t.slice(end, end + 2) !== '\n\n') continue;
    const b = block(t, end + 2, /^$/, { minWrap: WRAP, next: /./ });
    if (!b || !/。$/.test(b.value) || b.raw.split('\n').some(l => l.length > 60) || !NEXT.test(t.slice(b.at + b.raw.length))) continue;
    if (input.truncated && b.at + b.raw.length + 200 > t.length) continue;
    const q: ProjectEvaluation = { ...p, id: stableId(input, `narrative|${p.projectName}|${end}`, null),
      amounts: [], indicators: [], ratings: [], evidence: [...p.evidence, blockEvidence(input, b)], warnings: [...p.warnings] };
    q.activities = b.value;
    q.warnings.push('鹿島市 令和４年度 主要施策の成果説明書の「事業内容」欄のうち、見出し表の直後の段落を収録（続く表・箇条は含まない）。PDFの折り返しの改行を除いた。');
    out.push(q);
  }
  return out;
}

export const entry = {
  extract,
  scope: '鹿島市 令和４年度 主要施策の成果説明書の各事業の「事業内容」欄の冒頭の段落（見出し表の直後で句点で終わるもの）。',
};
