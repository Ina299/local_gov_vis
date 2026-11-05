import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 高松市（令和7年度（6年度決算分）事務事業評価表【事中・事後評価】）
// 公開済みレコードは同じ課別PDFの評価表の「事務事業 （事業名）」から作られ、evaluationYear 2025・evaluatedFiscalYear 2024。
// 【事業の目的】の「意図（どのような状態にしたいか）」欄を目的とする。見出しは2行に折り返して本文の1・2行目の行頭に付いて
// 出力されるため（「意図（どのような 」「状態にしたいか） 」）、行頭の見出しの断片だけを除き、欄の幅での折り返しをつなぐ。
// 根拠は見出しの断片を含む欄全体（原文の部分文字列）。【事業の活動】の見出しの手前までが欄。
const TITLE = /^令和 7年度（ 6年度決算分） 高松市事務事業評価表【事中・事後評価】$/gm;
const NAME = /^事務事業 ([^\n]+)$/m;
const INTENT = /\n(意図（どのような ([^\n]+)\n状態にしたいか）(?: ([^\n]+))?((?:\n(?!【)[^\n]+)*))\n【事業の活動】\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37201' || !/\/gyousei_hyoka\/kekka\/kikaku_up20250821\.files\/[^/]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(TITLE)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const n = NAME.exec(seg), m = INTENT.exec(seg);
    if (!n || !m || seg.match(/^事務事業 /gm)!.length !== 1) return;
    const rest = m[4].split('\n').filter(Boolean);
    // 本文の行に別の欄の見出し・表の値が混ざる場合は採らない。
    if ([m[2], m[3] ?? '', ...rest].some(l => /^(対象|活動指標|単位|①|②)|（何を）/.test(l))) return;
    const purpose = [m[2], m[3] ?? '', ...rest].join('').trim();
    if (!/。$/.test(purpose)) return;
    const p = project(input, `R7:${n[1]}:narrative`, n[1].trim(), 2025, n[0], start + n.index!);
    p.evaluatedFiscalYear = 2024;
    p.purpose = purpose;
    p.evidence.push(evidence(input, h[0], start), evidence(input, m[1], start + m.index! + 1));
    p.warnings.push('高松市 事務事業評価表の【事業の目的】「意図（どのような状態にしたいか）」欄を目的として収録。'
      + '行頭に付いて出力された見出しの断片を除き、欄の幅での折り返しをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '高松市 令和7年度（6年度決算分）事務事業評価表: 【事業の目的】の意図（目的）。',
};
