import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as g0 } from './g0';
import { entries as g1 } from './g1';
import { entries as g2 } from './g2';
import { entries as g3 } from './g3';
import { entries as g4 } from './g4';
import { entries as g5 } from './g5';
import { entries as g6 } from './g6';
import { entries as g7 } from './g7';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

// Rows aligned only by listing order; withheld rather than published on an inference.
const WITHHELD = new Set(['01571']);
// Amount-to-year (07214) or amount-to-project (06209) binding was partly inferred; keep names, ratings and quotes only.
const AMOUNTS_WITHHELD: Record<string, string> = {
  '07214': '平成20/21年度の金額ブロックの対応が一部推定のため、金額は公開対象から除外。',
  '06209': '金額と事業の対応が掲載順に依存するため、金額は公開対象から除外。',
};
function withoutAmounts(entry: Entry, note: string): Entry {
  return { scope: entry.scope, extract: (input, inputs) => entry.extract(input, inputs).map(p => p.amounts.length ? { ...p, amounts: [], warnings: [...p.warnings, note] } : p) };
}

/**
 * Extractors for documents first acquired by the 2026-10-21 source-collection run.
 * They apply only to extraction runs generated at or after `since`, so earlier
 * published batches keep reproducing byte-for-byte.
 */
export const batch7Extractors: Record<string, Entry> = {};
for (const group of [g0, g1, g2, g3, g4, g5, g6, g7] as Record<string, Entry>[]) {
  for (const [code, entry] of Object.entries(group)) {
    if (batch7Extractors[code]) throw new Error(`Duplicate batch-7 extractor for ${code}`);
    if (WITHHELD.has(code)) continue;
    batch7Extractors[code] = AMOUNTS_WITHHELD[code] ? withoutAmounts(entry, AMOUNTS_WITHHELD[code]) : entry;
  }
}
export const BATCH7_SINCE = '2026-10-21T00:00:00.000Z';
