import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 国分寺市（令和7年度 事務事業評価票、令和6年度決算）
// 公開済みレコードは同じ部別PDFの事務事業評価票から作られ、目的・事業概要が空欄。「事業目的」「事業対象 … 事業概要」の
// ラベルは欄の文の縦の中央に置かれ、文はラベルの行の上下に分かれる（ラベルの行に文が付くこともある）。ラベルの上と下の
// 行数が釣り合い（差が1行以内）、文が句点で終わる場合だけ採る。事業概要は事業対象の折り返しが混じらないよう、最後の行
// 以外が全幅であることも確かめる。教育委員会（年度の記載のない版）は公開済みレコードに年度がないため対象外。
const HEAD = /(?:^|\n)事務事業評価票 所管課 (\S+)\n事業番号 (\d+) 事務事業 (.+?) 細事業 [^\n]*\n/g;
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

/** ラベルの行 j を挟む欄の文。上は from 行目から、下は句点で終わる行まで。釣り合わなければ null。 */
function around(lines: string[], from: number, j: number, own: string | null): { text: string; next: number } | null {
  const above = lines.slice(from, j), end = lines.findIndex((l, k) => k > j && l.endsWith('。'));
  const below = own?.endsWith('。') ? [] : end < 0 ? null : lines.slice(j + 1, end + 1);
  if (!below || Math.abs(above.length - below.length) > 1 || above.length > 3) return null;
  const all = [...above, ...own ? [own] : [], ...below];
  if (!all.length || !all.at(-1)!.endsWith('。') || all.slice(0, -1).some(l => l.endsWith('。'))) return null;
  return { text: all.join(''), next: j + 1 + below.length };
}

function sheet(input: CachedInput, h: RegExpMatchArray, block: string, at: number): ProjectEvaluation | null {
  const lines = block.split('\n');
  const j = lines.findIndex(l => l === '事業目的' || l.startsWith('事業目的 '));
  const k = lines.findIndex(l => /^事業対象 .* 事業概要(?: |$)/.test(l));
  if (j < 0 || k <= j) return null;
  const purpose = around(lines, 0, j, lines[j] === '事業目的' ? null : lines[j].slice(5));
  let activities: string | null = null;
  if (purpose && purpose.next <= k) {
    const own = / 事業概要 (.+)$/.exec(lines[k])?.[1] ?? null;
    const o = around(lines, purpose.next, k, own);
    // 最後の行以外が全幅（事業対象の欄の折り返しが混じっていない）こと、ラベルの下に余りの行がないこと。
    if (o && o.next === lines.length) {
      const body = [...lines.slice(purpose.next, k), ...own ? [own] : [], ...lines.slice(k + 1)];
      const full = Math.max(...body.map(width));
      if (body.slice(0, -1).every(l => width(l) >= full - 2)) activities = o.text;
    }
  }
  if (!purpose) return null;
  // IDは公開済みレコード（同じ資料・同じ番号）と別にする（同じIDのシートは補強の対象外になるため）。
  const p = project(input, `${h[2]}:narrative`, h[3], 2025, h[0].trim(), h.index! + (h[0].startsWith('\n') ? 1 : 0));
  p.projectCode = h[2];
  p.evaluatedFiscalYear = 2024;
  p.department = h[1];
  p.purpose = purpose.text;
  p.activities = activities;
  p.evidence.push(evidence(input, block, at));
  p.warnings.push('事務事業評価票の「事業目的」「事業概要」欄。ラベルの上下に分かれた行を、上下の行数が釣り合い句点で終わる場合だけつないだ。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13214' || !/\/001\/037\/388\/(?:0[1-9])[a-z]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(HEAD)) {
    const at = h.index! + h[0].length, end = t.indexOf('\n法令等 ', at);
    if (end < 0 || end - at > 1500) continue;
    const p = sheet(input, h, t.slice(at, end), at);
    if (p) out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '国分寺市 令和7年度 事務事業評価票（部別PDF、教育委員会を除く）: 事業目的・事業概要（目的・事業内容）。',
};
