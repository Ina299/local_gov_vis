import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as n0 } from './n0';
import { entries as n1 } from './n1';
import { entries as n2 } from './n2';
import { entries as n3 } from './n3';
import { entries as n4 } from './n4';
import { entries as n5 } from './n5';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

// Withheld: 飯島町 assigns budget/actual by column order, 宇都宮市 assigns progress to businesses by position.
const WITHHELD = new Set(['20384', '09201']);

function combine(groups: Record<string, Entry>[]): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const group of groups) for (const [code, entry] of Object.entries(group)) {
    if (WITHHELD.has(code)) continue;
    if (out[code]) throw new Error(`Duplicate enrichment extractor for ${code}`);
    out[code] = entry;
  }
  return out;
}

/**
 * Sheet extractors used only to enrich already-published records (never in append batches). Each set is
 * effective for enrichment runs generated at or after its `since`, so earlier enrichment batches replay unchanged.
 */
export const enrichmentExtractors: { since: string; extractors: Record<string, Entry> }[] = [
  { since: '2026-10-26T00:00:00.000Z', extractors: combine([n0, n1, n2, n3, n4, n5]) },
];
