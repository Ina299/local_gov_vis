/** Batch-7 group g0: project-level evaluation extractors for newly acquired documents. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { hanyuEntries } from './g0-hanyu';
import { kanumaKitaibarakiEntries } from './g0-kanuma-kitaibaraki';
import { kotoHinoEntries } from './g0-koto-hino';
import { machidaShichinoheEntries } from './g0-machida-shichinohe';
import { ofunatoEntries } from './g0-ofunato';
import { shimokawaNagayoEntries } from './g0-shimokawa-nagayo';

// Not included (no project-level sheets among the new documents, or every row collides with existing records):
// 02402 七戸町, 13101 千代田区, 13212 日野市, 13222 東久留米市, 10521 板倉町, 13117 北区.
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...ofunatoEntries,
  ...kotoHinoEntries,
  ...hanyuEntries,
  ...kanumaKitaibarakiEntries,
  ...machidaShichinoheEntries,
  ...shimokawaNagayoEntries,
};
