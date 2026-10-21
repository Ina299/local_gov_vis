import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as a } from './h5-a';
import { entries as b } from './h5-b';
import { entries as c } from './h5-c';
import { entries as d } from './h5-d';
import { entries as e } from './h5-e';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...a, ...b, ...c, ...d, ...e,
};
