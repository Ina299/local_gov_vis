import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as i0 } from './i0';
import { entries as i1 } from './i1';
import { entries as i2 } from './i2';
import { entries as i3 } from './i3';
import { entries as i4 } from './i4';
import { entries as i5 } from './i5';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Extractors for documents acquired in collection round 3 (web discovery, 2026-10-21). */
export const batch9Extractors: Record<string, Entry> = {};
for (const group of [i0, i1, i2, i3, i4, i5] as Record<string, Entry>[]) {
  for (const [code, entry] of Object.entries(group)) {
    if (batch9Extractors[code]) throw new Error(`Duplicate batch-9 extractor for ${code}`);
    batch9Extractors[code] = entry;
  }
}
export const BATCH9_SINCE = '2026-10-21T12:00:00.000Z';
