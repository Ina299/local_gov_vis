/**
 * グループ m23 共通: 公開済みレコードを作った抽出をもう一度走らせ、目的のないレコードについて同じ資料から欄を取り出して補強用の記録を作る。
 * 事業名・所管・年度は元の抽出の値をそのまま使い（公開済みレコードとの照合のため）、ID は別にする。金額・指標・評価は持たせない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, stableId } from '../shared';

export interface Narrative { purpose: string | null; activities?: string | null; outcomes?: string | null; raw: string; at: number }
type Extract = (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[];

/** 元の抽出の各レコード（この資料由来で目的のないもの）について fill が返した欄を持つ記録を返す。 */
export function refill(input: CachedInput, inputs: CachedInput[], base: Extract, warning: string,
  fill: (p: ProjectEvaluation, input: CachedInput) => Narrative | null): ProjectEvaluation[] {
  const out: ProjectEvaluation[] = [];
  for (const p of base(input, inputs)) {
    if (p.purpose || p.evidence[0]?.sourceUrl !== input.sourceUrl || p.evidence[0]?.sha256 !== input.sourceSha256) continue;
    const f = fill(p, input);
    if (!f) continue;
    out.push({ ...p, id: stableId(input, `${p.projectCode ?? p.projectName}:${p.evaluatedFiscalYear ?? p.evaluationYear}:purpose`, p.evaluationYear),
      amounts: [], indicators: [], ratings: [], purpose: f.purpose, activities: f.activities ?? null, outcomes: f.outcomes ?? null,
      evidence: [...p.evidence.filter(e => e.sourceUrl === input.sourceUrl && e.sha256 === input.sourceSha256), evidence(input, f.raw, f.at)],
      warnings: [warning] });
  }
  return out;
}

/** 元の抽出の根拠（evidence[0]）の文字位置。 */
export function startOf(p: ProjectEvaluation): number | null {
  const m = /^extracted-text:chars:(\d+)-/.exec(p.evidence[0]?.cell ?? '');
  return m ? Number(m[1]) : null;
}

/** 折り返しの改行を除く。箇条の記号で始まる行の前の改行は残す。 */
export const joinWrapped = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
  .reduce((a, l, i) => a + (i && /^(・|○|〇|●|◎|※|【|[①-⑳]|（[０-９\d]+）|\(\d+\))/.test(l) ? '\n' : '') + l, '');
