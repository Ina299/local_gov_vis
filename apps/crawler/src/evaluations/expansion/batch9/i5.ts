import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as a } from './i5-a';
import { entries as b } from './i5-b';
import { entries as c } from './i5-c';
import { entries as d } from './i5-d';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...a, ...b, ...c, ...d,
};
