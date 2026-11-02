/**
 * 06205 新庄市: 令和6年度事務事業評価シート（事後評価、柱別PDF）。公開済みレコードの空欄の目的を補う。
 * 事業名・事業コード・担当部署は公開済みレコードを作った抽出（batch7/g3-mixed）をそのまま使い、その事業名の行を含むシートから読む。
 * 「事業の目的（どのような状態にしたいのか）」欄の本文は、抽出テキストで次のどちらかの位置に出る。
 * - 欄の見出しの直後（「したいのか」と「事業の内容」の見出しの間にちょうど1段落）。このとき、費用表の見出し「３．事業費」と
 *   「（単位：千円）」の間に段落がないこと（そこに段落があると、事業の内容の本文が割れて出ている可能性がある）。
 * - 見出しの直後が空のとき、「３．事業費」と「（単位：千円）」の間のちょうど1段落。このとき、事業の内容と事業の結果の欄
 *   （「（周知方法）」の見出しから「事業の結果」の見出しまで）にちょうど2段落あること（両欄の本文がそろっている）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, stableId, type CachedInput } from '../shared';
import { entries as g3 } from '../batch7/g3-mixed';
import { segments } from '../batch9/i3-util';
import { block, blockEvidence, type Block } from './m3-narrative';

const SHEET = /^令和[6６]年度事務事業評価シート（事後評価）\n/gm;
const LABEL = '\n事業の目的\nどのような状態に\nしたいのか\n\n', CONTENT = '事業の内容\nどのような方法・手段で\n事業を行ったか\n（周知方法）\n\n';
const COST = '\n３．事業費\n\n', UNIT = '\n\n（単位：千円）';
/** 本文1行は55字前後。 */
const WRAP = 45;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '06205') return [];
  const base = g3['06205'].extract(input, inputs);
  if (!base.length) return [];
  const t = input.text, sheets = segments(t, SHEET), out: ProjectEvaluation[] = [];
  /** seg の from から to までの段落（空行区切り）。 */
  const paragraphs = (seg: string, from: number, to: number) => seg.slice(from, to).split('\n\n').filter(Boolean);
  for (const p of base) {
    const at = Number(/^extracted-text:chars:(\d+)-/.exec(p.evidence[0].cell ?? '')?.[1] ?? -1);
    const sheet = sheets.find(s => s.start <= at && at < s.end);
    if (!sheet || (input.truncated && sheet.end === t.length)) continue;
    const seg = t.slice(sheet.start, sheet.end), once = (s: string) => { const i = seg.indexOf(s); return i >= 0 && seg.indexOf(s, i + 1) < 0 ? i : -1; };
    const label = once(LABEL), content = once(CONTENT), result = once('\n\n事業の結果\n'), cost = once(COST);
    if (label < 0 || content < 0 || result < content || cost < result) continue;
    const unit = seg.indexOf(UNIT, cost);
    if (unit < 0) continue;
    const floating = paragraphs(seg, cost + COST.length, unit);
    let b: Block | null = null;
    if (content === label + LABEL.length) {
      if (floating.length !== 1 || paragraphs(seg, content + CONTENT.length, result).length !== 2) continue;
      b = block(t, sheet.start + cost + COST.length, /^$/, { minWrap: WRAP });
      if (b && b.at + b.raw.length !== sheet.start + unit) b = null;
    } else {
      if (floating.length) continue;
      b = block(t, sheet.start + label + LABEL.length, /^$/, { minWrap: WRAP });
      if (b && b.at + b.raw.length + 2 !== sheet.start + content) b = null;
    }
    if (!b) continue;
    const q: ProjectEvaluation = { ...p, id: stableId(input, `narrative|${p.projectCode}|${p.projectName}|${at}`, null),
      amounts: [], indicators: [], ratings: [], evidence: [...p.evidence], warnings: [...p.warnings] };
    q.purpose = b.value;
    q.evidence.push(evidence(input, LABEL.trim(), sheet.start + label + 1), blockEvidence(input, b));
    q.warnings.push('新庄市 令和6年度事務事業評価シートの「事業の目的（どのような状態にしたいのか）」欄を収録。抽出テキストで本文が欄の見出しの直後、'
      + 'または（見出しの直後が空で、事業の内容・結果の本文がそろっている場合に限り）「３．事業費」の見出しの直後に出るもの。PDFの折り返しの改行を除いた。');
    out.push(q);
  }
  return out;
}

export const entry = {
  extract,
  scope: '新庄市 令和6年度事務事業評価シート（事後評価、柱別PDF）の「事業の目的」欄（本文の位置が様式から確定するもの）。',
};
