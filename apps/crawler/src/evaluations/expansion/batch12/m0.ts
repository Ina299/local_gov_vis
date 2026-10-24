import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { bEntries } from './m0-b';
import { cEntries } from './m0-c';
import { dEntries } from './m0-d';
import { eEntries } from './m0-e';
import { sakaiEntries } from './m0-sakai';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...sakaiEntries,
  ...bEntries,
  ...cEntries,
  ...dEntries,
  ...eEntries,
};
