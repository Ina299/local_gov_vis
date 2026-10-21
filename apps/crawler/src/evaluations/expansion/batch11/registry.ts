import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as k0 } from './k0';
import { entries as k1 } from './k1';
import { entries as k2 } from './k2';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Extractors for documents acquired in collection round 4 (re-discovery, 2026-10-21). */
export const batch11Extractors: Record<string, Entry> = {};
for (const group of [k0, k1, k2] as Record<string, Entry>[]) {
  for (const [code, entry] of Object.entries(group)) {
    if (batch11Extractors[code]) throw new Error(`Duplicate batch-11 extractor for ${code}`);
    batch11Extractors[code] = entry;
  }
}
export const BATCH11_SINCE = '2026-10-21T18:00:00.000Z';
