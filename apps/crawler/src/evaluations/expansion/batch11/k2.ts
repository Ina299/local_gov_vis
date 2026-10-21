import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as dengen } from './k2-dengen';
import { entries as misc } from './k2-misc';
import { entries as plans } from './k2-plans';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...dengen, ...misc, ...plans,
};
