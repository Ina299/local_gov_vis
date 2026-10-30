/**
 * 熊本県「主要な施策の成果」（令和7年度、一括ダウンロード版）。部局ごとのページに「主要な施策」欄（総合戦略の施策名）と
 * 予算額・決算額（単位：千円）があり、その右に欄内の主要事業（１ ○○事業 …）と成果が並ぶ。金額は施策欄単位で、個別事業の金額は記載がない。
 * 施策名の直後に予算額・決算額の2つの数値が続き、その直後に「１ 」で始まる最初の事業名が来る箇所だけを収録する。
 * 部局別に分割されたPDFは一括版と同じ内容のため対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const N = String.raw`\d{1,3}(?:,\d{3})*`;
const CODE = String.raw`施策[０-９\d]+[－―][①-⑳]`;
/** 施策名（1〜2行）→ 予算額 → 決算額 → 「１ 最初の事業名」 */
const ROW = new RegExp(String.raw`\n(${CODE}[^\n]*(?:\n[^\n\d０-９施（(][^\n]*)?)\n\n(${N})\n\n(${N}) (１ ?[^\n]+)`, 'g');
const squash = (s: string) => s.replace(/\s/g, '');
const HEAD = /\n（([^\n）]{2,20})）\n主 要 な 施 策\n/g;
const INTRO = /令和(\d|[０-９])年度における\n主要な施策の成果について本書のとおり提出します。/;

function extractKumamoto(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const intro = INTRO.exec(t.slice(0, 1000));
  // 一括版だけ（目次に知事公室から警察本部まで、各部局のページ見出しを含む）
  if (!intro || !t.slice(0, 3000).includes('警察本部') || [...t.matchAll(HEAD)].length < 20) return [];
  const fy = 2018 + num(intro[1]);
  const heads = [...t.matchAll(HEAD)].map(m => ({ at: m.index! + 1, raw: m[0].slice(1, m[0].indexOf('\n', 1)), dept: squash(m[1]) }));
  const units = [...t.matchAll(/（単位：千円）/g)].map(m => m.index!);
  // 施策名の全文（ページ内で折り返しが崩れて途中で切れた施策名を補うため、同じ文書に印字された施策名を集める）
  const labels = new Set([...t.matchAll(new RegExp(String.raw`\n(${CODE}[^\n]*(?:\n[^\n\d０-９施（(][^\n]*)?)\n`, 'g'))].map(m => squash(m[1])));
  const out: ProjectEvaluation[] = [];
  const count = new Map<string, number>();
  for (const m of t.matchAll(ROW)) {
    const at = m.index! + 1;
    if (num(m[3]) > num(m[2])) continue; // 決算額が予算額を上回る並びは列の取り違えの可能性
    const first = m[4].trim();
    if (/再掲/.test(first)) continue; // 再掲の事業から始まる欄は他の欄と金額が重複しうる
    const head = [...heads].reverse().find(h => h.at < at);
    const unit = [...units].reverse().find(u => u < at && (!head || u > head.at));
    if (!head || unit === undefined) continue;
    const printed = squash(m[1]);
    const code = /^施策[０-９\d]+[－―][①-⑳]/.exec(printed)![0];
    const longer = [...labels].filter(l => l !== printed && l.startsWith(printed));
    const name = longer.length === 1 ? longer[0] : printed;
    const key = `${head.dept}|${code}`;
    count.set(key, (count.get(key) ?? 0) + 1);
    const raw = m[0].slice(1, m[0].length - m[4].length - 1);
    const p = project(input, `${head.dept}-${code}-${count.get(key)}`, name, null, m[0].slice(1), at);
    p.department = head.dept;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head.raw, head.at), evidence(input, intro[0], intro.index), evidence(input, '（単位：千円）', unit));
    p.amounts.push(amount(input, 'budget', fy, m[2], '千円', raw, at), amount(input, 'actual', fy, m[3], '千円', raw, at));
    p.warnings.push(`金額は「主要な施策」欄（総合戦略の施策）単位の予算額・決算額（千円）で、欄内に掲げた主要事業（最初の事業: ${first}）の個別金額は原文に記載がない。決算年度は「令和${fy - 2018}年度における主要な施策の成果」による。`);
    if (name !== printed) p.warnings.push(`施策名が抽出テキストで途中まで（「${printed}」）のため、同じ文書に印字された同じ書き出しの施策名で補った。`);
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '43000': {
    scope: '令和7年度主要な施策の成果（一括版）の部局別「主要な施策」欄（総合戦略の施策名）ごとの予算額・決算額（千円）と部局。個別事業の金額は原文に記載がないため施策欄単位。施策名と金額・最初の事業名が抽出テキストで連続しない欄、再掲の事業から始まる欄、部局別に分割された同内容のPDF、正誤表の反映は対象外。',
    extract: (input) => extractKumamoto(input),
  },
};
