import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** The cached PDF text has lost empty table cells. Never assign its cost or
 * indicator numbers to years by counting the remaining values. */
export function extractMobara(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12210' || input.format !== 'pdf' || input.truncated) return [];
  const heading = /令和6年度\s+3か年事務事業戦略シート/g;
  const starts = [...input.text.matchAll(heading)].map(match => match.index!);
  const results = new Map<string, ProjectEvaluation>();
  for (let i = 0; i + 1 < starts.length; i++) {
    const first = input.text.slice(starts[i], starts[i + 1]);
    const identity = first.match(/実施計画事業名 担当課・係等\n([^\n]+)/);
    if (!identity) continue; // second pages and summary lists are not projects
    const code = first.slice(0, identity.index).match(/\b\d{9}\b/)?.[0];
    const second = input.text.slice(starts[i + 1], starts[i + 2] ?? input.text.length);
    const secondCode = second.slice(0, second.indexOf('A:妥当である')).match(/\b\d{9}\b/)?.[0];
    if (!code || code !== secondCode || second.includes('実施計画事業名 担当課・係等')) continue;
    const [name, ...department] = identity[1].trim().split(/\s+/);
    if (!name || !department.length) continue;
    const block = input.text.slice(starts[i], starts[i + 2] ?? input.text.length);
    const record = project(input, code, name, 2024, block, starts[i]);
    record.department = department.join(' ');
    const activityStart = second.indexOf('活動内容と成果（');
    const activityEnd = second.indexOf('必要性の評価', activityStart);
    if (activityStart >= 0 && activityEnd > activityStart) {
      // This municipal field explicitly combines activity and results. Preserve
      // that label rather than presenting its counts as outcome indicators.
      record.outcomes = second.slice(activityStart, activityEnd).trim();
      record.evidence.push(evidence(input, record.outcomes, starts[i + 1] + activityStart));
    }
    const ratingStart = second.indexOf('総合評価');
    const ratingEnd = second.indexOf('分析・評価', ratingStart);
    if (ratingStart >= 0 && ratingEnd > ratingStart) {
      const rating = second.slice(ratingStart, ratingEnd).match(/[ABCDＡＢＣＤ][：:][^\n]+/);
      if (rating) record.ratings.push({ kind: 'self', label: '総合評価', value: rating[0], scale: null,
        evidence: evidence(input, rating[0], starts[i + 1] + ratingStart + rating.index!) });
    }
    record.warnings.push('費用の計画・予算・決算列と指標の年度列は空欄の位置が失われているため数値を未構造化。活動内容と成果は原典の合体欄を原文のまま保持し、成果指標とは区別。対象事業年度は確定せず未設定。');
    const previous = results.get(code);
    if (previous) {
      if (previous.projectName !== record.projectName) throw new Error(`Mobara code/name conflict: ${code}`);
      previous.evidence.push(...record.evidence);
      if (record.outcomes && previous.outcomes !== record.outcomes) previous.outcomes = [previous.outcomes, record.outcomes].filter(Boolean).join('\n\n');
      for (const rating of record.ratings) {
        if (!previous.ratings.some(item => item.value === rating.value)) previous.ratings.push(rating);
      }
      previous.warnings.push('同一資料内の同一実施計画整理番号・事業名の複数評価票を1事業に統合。費用を合算せず、各票の出典と記述を保存。');
    } else results.set(code, record);
    i++; // paired evaluation page is part of this record
  }
  return [...results.values()];
}
