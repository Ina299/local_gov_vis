/** Batch-12 (m3) extractors: documents acquired in collection round 5 (links harvested from saved evaluation pages, 2026-10-24). */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { atsumaEntries } from './m3-atsuma';
import { dengenEntries } from './m3-dengen';
import { hanamakiEntries } from './m3-hanamaki';
import { higashiosakaEntries } from './m3-higashiosaka';
import { izumizakiEntries } from './m3-izumizaki';
import { kosakaEntries } from './m3-kosaka';
import { nagasakiEntries } from './m3-nagasaki';
import { seraEntries } from './m3-sera';
import { shimizuEntries } from './m3-shimizu';
import { shinagawaEntries } from './m3-shinagawa';
import { takamatsuEntries } from './m3-takamatsu';
import { yurihamaEntries } from './m3-yurihama';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...hanamakiEntries,
  ...shinagawaEntries,
  ...yurihamaEntries,
  ...atsumaEntries,
  ...seraEntries,
  ...dengenEntries,
  ...nagasakiEntries,
  ...izumizakiEntries,
  ...kosakaEntries,
  ...shimizuEntries,
  ...higashiosakaEntries,
  ...takamatsuEntries,
};
