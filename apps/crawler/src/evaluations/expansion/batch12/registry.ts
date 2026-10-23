import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Extractors for documents acquired in collection round 5 (links harvested from saved evaluation pages, 2026-10-24). */
export const batch12Extractors: Record<string, Entry> = {};
export const BATCH12_SINCE = '2026-10-24T00:00:00.000Z';
