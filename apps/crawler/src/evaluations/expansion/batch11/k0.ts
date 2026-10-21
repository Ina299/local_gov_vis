import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { eduEntries } from './k0-edu';
import { ichiharaEntries } from './k0-ichihara';
import { miscEntries } from './k0-misc';
import { ookiEntries } from './k0-ooki';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...ichiharaEntries,
  ...ookiEntries,
  ...eduEntries,
  ...miscEntries,
};
