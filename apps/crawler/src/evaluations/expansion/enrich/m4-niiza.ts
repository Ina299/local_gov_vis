/** 新座市 (11230): 第５次総合計画実施計画 事務事業評価シート（対象：令和６年度実施事業）の「事業概要」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコード（batch12/m5-niiza）は同じシートから作られ、目的・事業内容が空欄。シートに「目的」欄はなく、
// 左列「事業概要」の本文が、右列の評価項目名（事業の実施状況・事業の必要性【市民ニーズ】）と
// 「事業の効率性【見直す余地】／施策への貢献度／事業概要」の欄名の間に1つの段落として抽出される票に限って、事業内容として採る
// （m1-rusutsu と同じく事業概要は事業内容に当てる）。「実施内容」「事業の成果・分析」は段組みで本文の並びが入れ替わる票があり、
// どちらの欄の本文か確定しないため対象外。
const SHEET = '第５次新座市総合計画実施計画 事務事業評価シート\n（対象：令和６年度実施事業）\n';
const BEFORE = '\n事業の実施状況\n事業の必要性\n【市民ニーズ】\n\n';
const AFTER = '\n\n事業の効率性\n【見直す余地】\n施策への貢献度\n\n事業概要\n';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11230' || input.format !== 'pdf') return [];
  const t = input.text;
  if (!t.startsWith(SHEET)) return [];
  const starts = [...t.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const sheet = t.slice(s, starts[i + 1] ?? t.length);
    const n = /\n事業\n\n([^\n]+)\n\n所属\n\n([^\n]+)(?=\n\n事業の実施状況\n)/.exec(sheet);
    if (!n) return;
    const a = sheet.indexOf(BEFORE), b = sheet.indexOf(AFTER);
    if (a !== n.index! + n[0].length + 1 || b < 0 || sheet.indexOf(AFTER, b + 1) >= 0) return;
    const text = sheet.slice(a + BEFORE.length, b);
    if (!text.trim() || text.includes('\n\n')) return;
    const name = n[1].trim();
    const p = project(input, `${name}:overview`, name, null, n[1], s + n.index! + n[0].indexOf(n[1]));
    p.evaluatedFiscalYear = 2024;
    p.department = n[2].trim();
    p.activities = text;
    p.evidence.push(evidence(input, text, s + a + BEFORE.length));
    p.warnings.push('事務事業評価シートの「事業概要」欄の本文を事業内容として収録（右列の評価項目名と「事業概要」の欄名の間に1段落として抽出された票のみ）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '新座市 第５次総合計画実施計画 事務事業評価シート（対象：令和６年度実施事業）の「事業概要」欄（事業内容として）。シートに目的欄はない。「実施内容」「事業の成果・分析」は段組みで本文の並びが入れ替わるため対象外。',
};
