import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { kawaguchiEntries } from './m2-kawaguchi';
import { komoroEntries } from './m2-komoro';
import { memuroEntries } from './m2-memuro';
import { minamikyushuEntries } from './m2-minamikyushu';
import { musashimurayamaEntries } from './m2-musashimurayama';
import { setagayaEntries } from './m2-setagaya';
import { smallEntries } from './m2-small';
import { yubariEntries } from './m2-yubari';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...setagayaEntries,
  ...musashimurayamaEntries,
  ...memuroEntries,
  ...minamikyushuEntries,
  ...komoroEntries,
  ...smallEntries,
  ...kawaguchiEntries,
  ...yubariEntries,
};
