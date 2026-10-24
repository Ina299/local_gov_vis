import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { aizumiEntries } from './m1-aizumi';
import { kaminokawaEntries } from './m1-kaminokawa';
import { mizunamiEntries } from './m1-mizunami';
import { nakajimaEntries } from './m1-nakajima';
import { sakaiEntries } from './m1-sakai';
import { shooEntries } from './m1-shoo';
import { smallEntries } from './m1-small';
import { tonoEntries } from './m1-tono';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...sakaiEntries,
  ...tonoEntries,
  ...kaminokawaEntries,
  ...mizunamiEntries,
  ...aizumiEntries,
  ...nakajimaEntries,
  ...shooEntries,
  ...smallEntries,
};
