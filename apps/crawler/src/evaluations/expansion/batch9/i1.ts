import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { kawaguchiEntries } from './i1-kawaguchi';
import { moreEntries } from './i1-more';
import { smallEntries } from './i1-small';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...kawaguchiEntries,
  ...smallEntries,
  ...moreEntries,
};
