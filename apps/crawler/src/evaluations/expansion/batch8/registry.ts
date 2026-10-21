import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as h0 } from './h0';
import { entries as h1 } from './h1';
import { entries as h2 } from './h2';
import { entries as h3 } from './h3';
import { entries as h4 } from './h4';
import { entries as h5 } from './h5';
import { entries as h6 } from './h6';
import { entries as h7 } from './h7';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Extractors for documents acquired in collection round 2 (2026-10-21). */
export const batch8Extractors: Record<string, Entry> = {};
for (const group of [h0, h1, h2, h3, h4, h5, h6, h7] as Record<string, Entry>[]) {
  for (const [code, entry] of Object.entries(group)) {
    if (batch8Extractors[code]) throw new Error(`Duplicate batch-8 extractor for ${code}`);
    batch8Extractors[code] = entry;
  }
}
export const BATCH8_SINCE = '2026-10-21T06:00:00.000Z';
