/** 上天草市 (43212): 平成25年度行政評価 事務事業評価シートの「目的・目標（何のために）」「事務事業概要（どのようなことを）」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じシートの見出し（事務事業名・所属、評価年度2013）だけ（batch8/h5-a.ts）。事務事業名は同じ取り方で、所属は照合に使わない
// （同名の事業が2つあれば補強しない）。欄名は2行に分かれ、2行目（「めに）」「ようなことを）」）が本文の行の間に1行として挟まる。
//  目的: 「目的・目標（何のた 」で始まる行から「事務事業概要」の欄の手前の空行まで。欄名の2行目以外に欄名・空行がないもの。
//  事業内容: 「事務事業概要（どの 」で始まる行から、指標の参照「…指標①」の行まで（その後に空行なしで「対象者」の欄が続く票、または空行の後に「対象者」が続く票）。
// どちらも欄名の2行目の行だけを除いて本文の行を改行でつなぐ（出典には欄名を含む原文を記録）。
const SHEET = /平成25年度 事務事業評価シート\n事務事業評価シート\n基本情報\n/g;
const PURPOSE = /\n(目的・目標（何のた ([^\n]+)\n((?:[^\n]+\n)*?))\n事務事業概要（どの /;
const CONTENT = /\n\n(事務事業概要（どの ([^\n]+)\n((?:[^\n]+\n)*?)…指標①)\n\n対象者（誰に対して /;
const LABELS = /^(?:法令|市条例|その他|事業開始|根|拠|計画|施策|政策|基本計画|対象者|手段|期待される|…指標)/;

/** 欄名の2行目（label）がちょうど1行あり、他の行がすべて本文であるとき、その行を除いた本文。 */
function body(first: string, rest: string, label: string): string | null {
  const lines = [first, ...rest.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '')];
  if (lines.filter(l => l === label).length !== 1) return null;
  const text = lines.filter(l => l !== label);
  if (text.some(l => !l.trim() || LABELS.test(l) || l.endsWith('）') && l.length < 8)) return null;
  return text.join('\n');
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '43212' || input.sourceId !== '0ff90970f4dbea910db8c8af' || !input.text.startsWith('平成 25 年度行政評価事務事業評価シート')) return [];
  const t = input.text, starts = [...t.matchAll(SHEET)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const sheet = t.slice(s, starts[i + 1] ?? t.length);
    const name = /\n([^\n]+)\n\n\(予算事業名\)/.exec(sheet);
    if (!name || /事業コード|予算科目|事務事業名|基本情報/.test(name[1])) return;
    const pu = PURPOSE.exec(sheet), co = CONTENT.exec(sheet);
    const purpose = pu && !pu[3].includes('\n\n') ? body(pu[2], pu[3], 'めに）') : null;
    const content = co && !co[3].includes('\n\n') ? body(co[2], co[3], 'ようなことを）') : null;
    if (!purpose && !content) return;
    const p = project(input, `補強:${name[1]}`, name[1], 2013, name[1], s + name.index + 1);
    p.projectCode = null;
    p.evidence.push(evidence(input, '平成 25 年度行政評価事務事業評価シート', 0));
    if (purpose) { p.purpose = purpose; p.evidence.push(evidence(input, pu![1].slice(0, -1), s + pu!.index + 1)); }
    if (content) { p.activities = content; p.evidence.push(evidence(input, co![1], s + co!.index + 2)); }
    p.warnings.push('平成25年度 事務事業評価シートの「目的・目標（何のために）」「事務事業概要（どのようなことを）」欄の本文。欄名の2行目（「めに）」「ようなことを）」）が本文の行の間に挟まるため、その1行だけを除いてつないだ（出典は欄名を含む原文）。'
      + '欄の途中に空行や他の欄名が入る票は対象外。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '上天草市 平成25年度行政評価 事務事業評価シートから、目的・目標（何のために）と事務事業概要（どのようなことを）の欄。欄名の2行目だけを除いた本文で、空行や他の欄名が混ざる票は対象外。',
};
