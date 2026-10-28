/** 箱根町 (14382): 第2期まち・ひと・しごと創生総合戦略 令和6年度 施策別評価結果（施策別事業別の評価シート）の事業別進捗度。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

const SOURCE = '3311de0a13ff86b66aab8ae8';
const HEAD = /箱根町第２期\nまち・ひと・しごと創生総合戦略\n\n令和６年度 施策別評価結果/;
const SCALE = 'Ａ 順調に実施できている／Ｂ 概ね実施できている／Ｃ 実施に向けて検討している／Ｄ 課題等があり実施が困難';
// 事業ブロック: ■番号から次の■番号まで。分類（1字）・事業名・内容・R6 の実施状況・進捗度を含む。
const MARK = /\n■[０-９\d]+\n/g;

/** 評価シートの見かたのページにある記入例（施策①■1の再掲）は、本編と同じ値のときだけ1件にまとめ、異なる場合はその事業を採らない。 */
export function extractHakoneStrategy(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14382' || input.sourceId !== SOURCE) return [];
  const t = input.text, head = t.match(HEAD);
  if (!head) return [];
  const byName = new Map<string, ProjectEvaluation[]>();
  const marks = [...t.matchAll(MARK)];
  marks.forEach((m, k) => {
    const block = t.slice(m.index!, marks[k + 1]?.index ?? t.length);
    // 見出し: ■番号の後の2行（分類1字と事業名、順不同）。
    const head2 = block.match(/^\n■[０-９\d]+\n\n([^\n]+)\n\n([^\n]+)\n/);
    const progs = [...block.matchAll(/\n(進捗度 ([A-D])：[^\n]+)/g)];
    if (!head2 || progs.length !== 1) return;
    const nameRaw = [head2[1], head2[2]].filter(s => s.trim().length > 1);
    if (nameRaw.length !== 1) return;
    const name = nameRaw[0].trim();
    const at = m.index! + block.indexOf(`\n${nameRaw[0]}\n`) + 1;
    const p = project(input, name, name, null, nameRaw[0], at);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, head[0], head.index!));
    p.ratings.push({ kind: 'self', label: '総合戦略 事業の進捗度（令和6年度）', value: progs[0][2], scale: SCALE, evidence: evidence(input, progs[0][1], m.index! + progs[0].index! + 1) });
    p.warnings.push('まち・ひと・しごと創生総合戦略の施策別事業別の評価シートから、令和6年度の事業の進捗度を取得（総合計画の施策別評価とは別の評価）。');
    byName.set(name, [...byName.get(name) ?? [], p]);
  });
  return [...byName.values()].filter(ps => new Set(ps.map(p => p.ratings[0].value)).size === 1).map(ps => ps[ps.length - 1]);
}
