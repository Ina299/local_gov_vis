import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Extractors for documents acquired in collection round 4 (re-discovery, 2026-10-21). */
export const batch11Extractors: Record<string, Entry> = {};
export const BATCH11_SINCE = '2026-10-21T18:00:00.000Z';
