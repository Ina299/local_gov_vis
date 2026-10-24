import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { normalize } from '../batch8/h6-util';
import { municipalityRecords } from '../batch11/k0-util';
import { M5_IDS } from './m5-ids';

export type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/**
 * batch11（第5回取得）の資料だけを対象に、自治体の全資料を一度に抽出し、同じ事業・同じ年度の再掲は値が一致すれば統合・
 * 食い違えば除外、互いに衝突するレコードと既存構造化レコードと同名・同年度で衝突するもの（`existing` に列挙）を除外する。
 */
export function municipal(code: string, one: (i: CachedInput) => ProjectEvaluation[], existing: readonly string[] = []) {
  const skip = new Set(existing.map(normalize)), fresh = new Set(M5_IDS[code] ?? []);
  const parse = (i: CachedInput) => i.municipalityCode === code && fresh.has(i.sourceId) ? one(i).filter(p => !skip.has(normalize(p.projectName))) : [];
  const key = (p: ProjectEvaluation) => JSON.stringify([normalize(p.projectName), p.projectCode, p.evaluationYear, p.evaluatedFiscalYear]);
  return (input: CachedInput, inputs: CachedInput[]) => input.municipalityCode === code ? municipalityRecords(input, inputs, parse, key) : [];
}

/** Absolute offset of capture group `g` of a match made with the `d` flag on `text.slice(base)`. */
export const groupAt = (m: RegExpExecArray | RegExpMatchArray, g: number, base = 0) => base + m.indices![g]![0];
