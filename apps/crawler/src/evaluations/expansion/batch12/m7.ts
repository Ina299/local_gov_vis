import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as a } from './m7-a';
import { entries as b } from './m7-b';
import { entries as c } from './m7-c';
import { entries as d } from './m7-d';
import { entries as e } from './m7-e';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...a,
  ...b,
  ...c,
  ...d,
  ...e,
};
