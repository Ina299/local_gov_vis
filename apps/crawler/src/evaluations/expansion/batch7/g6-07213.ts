import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, eraYear, municipality } from './g6-util';

const HEAD = /事務事業評価表\n\n(\d+)\n\n(令和|平成)(\S+)年度実施事業\n事業名\n\n([^\n]+)\n\n担当課\n\n([^\n]+)\n\n業務名\n\n([^\n]+)\n\n担当係\n/g;
const DIRECTIONS = new Set(['維持', '拡充', '改善', '統合', '廃止', '休止', '縮小']);

/** 伊達市 事務事業評価表（令和6年度実施事業）: one record per 整理番号 (事業名＋業務名). */
function parse(input: CachedInput): ProjectEvaluation[] {
  const out: ProjectEvaluation[] = [], heads = [...input.text.matchAll(HEAD)];
  heads.forEach((h, i) => {
    const start = h.index!, end = heads[i + 1]?.index ?? input.text.length, sheet = input.text.slice(start, end);
    const fy = eraYear(h[2], h[3]);
    if (fy === null || !/課|室|局|所|館/.test(h[5])) return;
    const business = h[4].replace(/（再掲）$/, ''), task = h[6];
    const name = task === '－' ? business : `${business}：${task}`;
    const p = project(input, h[1], name, null, h[0].replace(/\n$/, ''), start);
    p.department = h[5]; p.evaluatedFiscalYear = fy;
    const dir = /今後の\n方向性\n\n([^\n]+)\n/.exec(sheet);
    if (dir && DIRECTIONS.has(dir[1])) p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir[1], scale: null, evidence: evidence(input, dir[0].replace(/\n$/, ''), start + dir.index) });
    // 目標値 R5〜R9 の5列と実績値2列（評価対象の令和6年度までなので R5・R6）が揃い、指標名・単位の並びが確定できる表だけ。
    const head = /指標名\n\n単位\n\n(?:([^\n]+)\n\n達成条件\n実績値が\n目標値\n\n([^\n]+)\n\n以上|達成条件\n実績値が\n目標値\n\n([^\n]+)\n\n([^\n]+)\n\n以上)\n\n区分\n\nR5年度\n\nR6年度\n\nR7年度\n\nR8年度\n\nR9年度\n\n目標値\n\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n\n実績値\n\n([\d,.]+)\n\n([\d,.]+)\n\n達成率/.exec(sheet);
    if (head && fy === 2024 && sheet.split('指標名').length === 2) {
      const indName = head[1] ?? head[3], unit = head[2] ?? head[4], targets = head.slice(5, 10), actuals = head.slice(10, 12);
      const ev = () => evidence(input, head[0], start + head.index);
      [2023, 2024, 2025, 2026, 2027].forEach((y, k) => p.indicators.push({ name: indName, fiscalYear: y, target: targets[k], actual: k < 2 ? actuals[k] : null, unit, evidence: ev() }));
    }
    p.warnings.push('伊達市 事務事業評価表（令和6年度実施事業）。評価年度は本文に明示がないため未設定。業務名が「－」でない場合は「事業名：業務名」を事業名とし、末尾の（再掲）は除いて同一業務の再掲を統合。',
      '事業費（財源内訳）は抽出テキストで年度列（04〜09年度）と値の列の対応が確定できないため未構造化。',
      '指標は R5〜R9 の目標値5列と実績値2列（令和6年度実施事業のため R5・R6 の実績）が揃い、指標名と単位の位置が確定できる単一指標の表だけ記録。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '07213': { extract: municipality('07213', parse), scope: '伊達市 事務事業評価表（令和6年度実施事業）の業務単位: 整理番号・事業名・業務名・担当課・今後の方向性・数値目標（単一指標で列が確定する表のみ）。事業費の年度別内訳とチェック項目の文章評価は対象外。' },
};
