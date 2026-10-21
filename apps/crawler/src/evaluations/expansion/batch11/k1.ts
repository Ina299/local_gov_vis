import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as eduEntries } from './k1-edu';
import { entries as grantEntries } from './k1-grant';
import { entries as iijimaEntries } from './k1-iijima';
import { entries as kanagawaEntries } from './k1-kanagawa';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...iijimaEntries,
  ...kanagawaEntries,
  ...eduEntries,
  ...grantEntries,
};
