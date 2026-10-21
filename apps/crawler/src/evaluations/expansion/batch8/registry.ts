import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Extractors for documents acquired in collection round 2 and later discovery (2026-10-21〜). */
export const batch8Extractors: Record<string, Entry> = {};
export const BATCH8_SINCE = '2026-10-21T06:00:00.000Z';
