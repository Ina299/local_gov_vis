import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Extractors for documents acquired in collection round 3 (web discovery) (2026-10-21〜). */
export const batch9Extractors: Record<string, Entry> = {};
export const BATCH9_SINCE = '2026-10-21T12:00:00.000Z';
