import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 横瀬町「行政評価結果一覧（令和元年度事務事業分）」
// 公開済みレコード（同じ資料の事務事業ごとの評価表から作成。目的・事業内容なし）の補強用。
// 事業概要の欄見出し（「何のために（目的・課題）」「誰・何を（対象）」「どんなことを・どのように(内容)」）と縦書きの
// 「事業概要」の1字が行として、または本文の行頭に付いて現れる。見出しの行・見出しの前置きを除いた本文の行を、
//  目的   ← 「業 何のために」の行から「要 誰・何を（対象）」の行まで
//  事業内容 ← 「どんなこと」の行から「単位：千円」の行まで
// として採る。本文の途中の行は欄の幅（40字以上）か句点で終わる行であること（表の区切りが混ざる形を外す）。
// 見出しの断片と空行・折り返しの改行だけを除き、句点で終わる行の後の改行は残す。
const PURPOSE_LABELS = [/^業 何のために(?: |$)/, /^概 （目的・課題）(?: |$)/];
const CONTENT_LABELS = [/^どんなこと(?: |$)/, /^を・どのよう(?: |$)/, /^に\(内容\)(?: |$)/];

interface Field { value: string; raw: string; at: number }

function region(seg: string, at: number, start: RegExp, end: RegExp, labels: RegExp[]): Field | null {
  const s = seg.search(start);
  if (s < 0) return null;
  const e = seg.slice(s).search(end);
  if (e < 0) return null;
  const raw = seg.slice(s, s + e).replace(/\n+$/, '');
  const lines: string[] = [];
  for (const line of raw.split('\n')) {
    let l = line;
    for (const re of labels) if (re.test(l)) { l = l.replace(re, ''); break; }
    if (l.trim()) lines.push(l.trim());
  }
  if (!lines.length || lines.slice(0, -1).some(l => l.length < 40 && !l.endsWith('。'))) return null;
  if (lines.some(l => labels.some(re => re.test(l)) || /^(要 誰・何を|事 その他関連施策|単位：千円)/.test(l))) return null;
  const value = lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') ? '\n' : '') + l, '');
  return { value, raw, at: at + s };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11361' || input.format !== 'pdf' || !input.text.startsWith('行政評価結果一覧\n（令和元年度事務事業分）\n')) return [];
  const t = input.text, starts = [...t.matchAll(/\n事務事業名\n\n([^\n]+)\n\n担当課所\n/g)], out: ProjectEvaluation[] = [];
  starts.forEach((h, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const at = h.index!, seg = t.slice(at, starts[i + 1]?.index ?? t.length);
    // 「事 その他関連施策」の行に続けて欄見出しが並ぶ形だけ。
    if ((seg.match(/\n事 その他関連施策(?: [^\n]*)?\n/g) ?? []).length !== 1) return;
    const pur = region(seg, at, /\n業 何のために(?: |\n)/, /\n要 誰・何を（対象）/, PURPOSE_LABELS);
    const act = region(seg, at, /\nどんなこと(?: |\n)/, /\n単位：千円\n/, CONTENT_LABELS);
    if (!pur && !act) return;
    const name = h[1].trim();
    const p = project(input, `${name}:narrative`, name, null, h[1], at + '\n事務事業名\n\n'.length);
    p.evaluatedFiscalYear = 2019;
    if (pur) { p.purpose = pur.value; p.evidence.push(evidence(input, t.slice(pur.at + 1, pur.at + pur.raw.length), pur.at + 1)); }
    if (act) { p.activities = act.value; p.evidence.push(evidence(input, t.slice(act.at + 1, act.at + act.raw.length), act.at + 1)); }
    p.warnings.push('横瀬町 行政評価結果一覧（令和元年度事務事業分）の事業概要のうち「何のために（目的・課題）」を目的、「どんなことを・どのように(内容)」を事業内容として収録。欄見出しの断片と折り返しの改行だけを除いた。');
    out.push(p);
  });
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '横瀬町 行政評価結果一覧（令和元年度事務事業分）の目的（何のために）・内容（どんなことを・どのように）。公開済みの同資料由来レコードの補強用。' };
