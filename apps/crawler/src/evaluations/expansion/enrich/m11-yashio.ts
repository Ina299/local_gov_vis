/**
 * 11234 八潮市: 令和7年度 事務事業評価シート（対象：R6年度実施事業）。公開済みレコード（同じPDFの評価シート）の空欄の
 * 目的・事業内容を補う。抽出テキストでは欄の見出しと本文が離れて並ぶため、位置が様式で決まる欄だけを読む。
 * - 目的: 「事業目的」欄の本文は、費用表の見出し「単位：円」または欄の見出し「事業概要」の直前の段落に出る
 *   （事業概要欄の本文は「事業の対象」の［ ］の直後に出るため、直前の段落が「]」で終わるものは除く）。候補が1つだけの場合。
 * - 事業内容: 「事業の実施状況（見込み）」の縦書きの見出し「令和6年度」の直後の段落（R6年度の実施状況）。
 *   令和5・6・7年度の見出しが順に1つずつある場合に限る。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { block, blockEvidence } from './m3-narrative';

const HEAD = '事務事業評価シート（対象：R6年度実施事業）\n';
const vertical = (y: number) => `\n令\n和\n${y}\n年\n度\n\n`;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11234' || input.format !== 'pdf' || !/\/r7-zimuzigyohyoka\.files\/r7-record\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    if (input.truncated && k === starts.length - 1) return;
    const end = t.indexOf('■事業の評価 （R6年度の事後評価）', s);
    if (end < 0 || (starts[k + 1] !== undefined && end > starts[k + 1])) return;
    const seg = t.slice(s, end);
    const h = /\n事務事業名 ([^\n]+)\n/.exec(seg);
    if (!h || /^(所属コード|位置付け|主要事業|部|課)/.test(h[1])) return;
    const name = h[1].trim();
    const p = project(input, `narrative|${name}`, name, null, h[0].slice(1, -1), s + h.index! + 1);
    p.id = stableId(input, `narrative|${name}|${s}`, null); p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, HEAD.trim(), s));
    const dept = /\n課\n\n([^\n]+(?:課|室|局|委員会))\n/.exec(seg);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), s + dept.index! + 1)); }

    // 目的: 「単位：円」「事業概要」の直前の段落（段落全体が欄の本文として読めるもの）
    const purposes = ['\n\n単位：円\n', '\n\n事業概要\n'].flatMap(label => {
      const at = seg.indexOf(label);
      if (at < 0 || seg.indexOf(label, at + 1) >= 0) return [];
      const from = seg.lastIndexOf('\n\n', at - 1) + 2;
      if (from < 2 || /\]$/.test(seg.slice(0, from - 2))) return [];
      const b = block(t, s + from, /^$/, { minWrap: 25 });
      return b && b.at + b.raw.length === s + at && /。$/.test(b.value) ? [b] : [];
    });
    if (purposes.length === 1) { p.purpose = purposes[0].value; p.evidence.push(blockEvidence(input, purposes[0])); }

    // 事業内容: 令和6年度の実施状況
    const ys = [5, 6, 7].map(y => seg.indexOf(vertical(y)));
    if (ys.every((x, i) => x >= 0 && seg.indexOf(vertical([5, 6, 7][i]), x + 1) < 0) && ys[0] < ys[1] && ys[1] < ys[2]) {
      const b = block(t, s + ys[1] + vertical(6).length, /^$/, { minWrap: 25 });
      if (b && b.at + b.raw.length <= s + ys[2]) {
        p.activities = b.value;
        p.evidence.push(evidence(input, vertical(6).trim(), s + ys[1] + 1), blockEvidence(input, b));
      }
    }
    if (!p.purpose && !p.activities) return;
    p.warnings.push('八潮市 事務事業評価シート（対象：R6年度実施事業）。目的は「事業目的」欄の本文（費用表の見出し「単位：円」または「事業概要」の直前の段落で、候補が1つだけのもの）、'
      + '事業内容は「事業の実施状況（見込み）」の令和6年度の段落。PDFの折り返しの改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '八潮市 令和7年度 事務事業評価シート（対象：R6年度実施事業、所管別PDF）の「事業目的」欄と「事業の実施状況」の令和6年度欄。',
};
