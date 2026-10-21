import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as entriesA } from './h7-a';
import { entries as entriesB } from './h7-b';
import { entries as entriesC } from './h7-c';
import { entries as entriesD } from './h7-d';
import { entries as entriesE } from './h7-e';

/** Batch 8 group h7. 27213泉佐野市（施策評価の外部評価のみ）・23203一宮市（案内ページのみ）ほか事務事業票のない自治体は未登録。 */
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...entriesA,
  ...entriesB,
  ...entriesC,
  ...entriesD,
  ...entriesE,
};
