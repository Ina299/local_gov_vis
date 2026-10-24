import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { rusutsuEntries } from './m6-f2-rusutsu';
import { tatebayashiEntries } from './m6-f2-tatebayashi';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...tatebayashiEntries,
  ...rusutsuEntries,
};
