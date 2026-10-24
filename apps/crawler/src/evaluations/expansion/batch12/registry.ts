import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as m0 } from './m0';
import { entries as m1 } from './m1';
import { entries as m2 } from './m2';
import { entries as m3 } from './m3';
import { entries as m4 } from './m4';
import { entries as m5 } from './m5';
import { entries as m6 } from './m6';
import { entries as m7 } from './m7';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

// 新座市: the amount table prints 令和６・７年度, but the extractor assigned FY2023/2024 from execution rates; withheld.
const AMOUNTS_WITHHELD: Record<string, string> = {
  '11230': '金額表の列見出し（令和６・７年度）と、執行率等から推定した年度（令和5・6年度）が食い違うため、金額は公開対象から除外。',
};
function withoutAmounts(entry: Entry, note: string): Entry {
  return { scope: entry.scope, extract: (input, inputs) => entry.extract(input, inputs).map(p => p.amounts.length ? { ...p, amounts: [], warnings: [...p.warnings, note] } : p) };
}

/** Extractors for documents acquired in collection round 5 (links harvested from saved evaluation pages, 2026-10-24). */
export const batch12Extractors: Record<string, Entry> = {};
for (const group of [m0, m1, m2, m3, m4, m5, m6, m7] as Record<string, Entry>[]) {
  for (const [code, entry] of Object.entries(group)) {
    if (batch12Extractors[code]) throw new Error(`Duplicate batch-12 extractor for ${code}`);
    batch12Extractors[code] = AMOUNTS_WITHHELD[code] ? withoutAmounts(entry, AMOUNTS_WITHHELD[code]) : entry;
  }
}
export const BATCH12_SINCE = '2026-10-24T00:00:00.000Z';
