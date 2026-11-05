import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as n0 } from './n0';
import { entries as n1 } from './n1';
import { entries as n2 } from './n2';
import { entries as n3 } from './n3';
import { entries as n4 } from './n4';
import { entries as n5 } from './n5';
import { entries as m0 } from './m0';
import { entries as m1 } from './m1';
import { entries as m2 } from './m2';
import { entries as m3 } from './m3';
import { entries as m4 } from './m4';
import { entries as m5 } from './m5';
import { entries as m6 } from './m6';
import { entries as m7 } from './m7';
import { entries as m8 } from './m8';
import { entries as m9 } from './m9';
import { entries as m10 } from './m10';
import { entries as m11 } from './m11';
import { entries as m12 } from './m12';
import { entries as m13 } from './m13';
import { entries as m14 } from './m14';
import { entries as m15 } from './m15';
import { entries as m16 } from './m16';
import { entries as m17 } from './m17';
import { entries as m18 } from './m18';
import { entries as m19 } from './m19';
import { entries as m20 } from './m20';
import { entries as m21 } from './m21';
import { entries as y0 } from './y0';
import { entries as y1 } from './y1';
import { entries as y2 } from './y2';
import { entries as y3 } from './y3';
import { entries as y4 } from './y4';
import { entries as m22 } from './m22';
import { entries as m23 } from './m23';
import { entries as m24 } from './m24';
import { entries as m25 } from './m25';
import { entries as m26 } from './m26';
import { entries as m27 } from './m27';
import { entries as m28 } from './m28';
import { entries as m29 } from './m29';
import { entries as p0 } from './p0';
import { entries as p1 } from './p1';
import { entries as p2 } from './p2';

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
  // 目的・事業内容・成果の補強（空欄だけを埋める。enrichment.ts の narratives）
  { since: '2026-11-01T00:00:00.000Z', extractors: combine([m0, m1, m2, m3, m4, m5]) },
  { since: '2026-11-02T00:00:00.000Z', extractors: combine([m6, m7, m8, m9, m10, m11, m12, m13]) },
  { since: '2026-11-03T00:00:00.000Z', extractors: combine([m14, m15, m16, m17, m18, m19, m20, m21]) },
  // 年度の記載がない公開済みレコードを、同じ資料から作った事業票で補う（enrichment.ts の yearlessSameDocument）
  { since: '2026-11-04T00:00:00.000Z', extractors: combine([y0, y1, y2, y3, y4]) },
  { since: '2026-11-05T00:00:00.000Z', extractors: combine([m22, m23, m24, m25, m26, m27, m28, m29]) },
  // 年度の記載がない公開済みレコードを、同じページに掲載された資料から作った事業票で補う（enrichment.ts の samePage）
  { since: '2026-11-06T00:00:00.000Z', extractors: combine([p0, p1]) },
  { since: '2026-11-07T00:00:00.000Z', extractors: combine([p2]) },
];
