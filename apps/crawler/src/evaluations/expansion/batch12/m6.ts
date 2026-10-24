import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as f1 } from './m6-f1';
import { entries as f2 } from './m6-f2';
import { entries as f3 } from './m6-f3';
import { entries as f4 } from './m6-f4';
import { entries as f5 } from './m6-f5';
import { entries as small } from './m6-small';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...f1,
  ...f2,
  ...f3,
  ...f4,
  ...f5,
  ...small,
};
