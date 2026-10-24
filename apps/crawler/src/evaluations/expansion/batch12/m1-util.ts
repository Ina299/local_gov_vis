import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

export type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

export const KANJI_DIGITS = '０１２３４５６７８９';
/** Full- or half-width digits to a number. */
export const toNumber = (s: string) => Number(s.normalize('NFKC').replace(/[,\s]/g, ''));
/** 令和/平成 + year number to the western year. */
export const era = (name: string, year: string | number) => (name === '令和' ? 2018 : 1988) + (typeof year === 'number' ? year : (year.normalize('NFKC') === '元' ? 1 : toNumber(year)));

export function segments(text: string, re: RegExp): { at: number; text: string }[] {
  const s = [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))].map(m => m.index!);
  return s.map((at, k) => ({ at, text: text.slice(at, s[k + 1] ?? text.length) }));
}

/** Same name and period twice among the given records: values cannot be told apart, so every copy is dropped. */
export function uniqueBy(records: ProjectEvaluation[], key: (p: ProjectEvaluation) => string = p => `${p.projectName.normalize('NFKC').replace(/\s/g, '')}|${p.evaluationYear}|${p.evaluatedFiscalYear}`): ProjectEvaluation[] {
  const count = new Map<string, number>();
  for (const p of records) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
  return records.filter(p => count.get(key(p)) === 1);
}

/** Run `one` on every document of the municipality, drop records whose name+period repeats anywhere, return those owned by `input`. */
const cache = new WeakMap<CachedInput[], Map<Function, Map<string, ProjectEvaluation[]>>>();
export function acrossMunicipality(input: CachedInput, inputs: CachedInput[], one: (i: CachedInput, all: CachedInput[]) => ProjectEvaluation[], key?: (p: ProjectEvaluation) => string): ProjectEvaluation[] {
  let byFn = cache.get(inputs);
  if (!byFn) cache.set(inputs, byFn = new Map());
  let byOwner = byFn.get(one);
  if (!byOwner) {
    byOwner = new Map();
    const all = inputs.flatMap(i => one(i, inputs).map(p => ({ p, owner: i.sourceId })));
    const kept = new Set(uniqueBy(all.map(x => x.p), key));
    for (const { p, owner } of all) if (kept.has(p)) byOwner.set(owner, [...(byOwner.get(owner) ?? []), p]);
    byFn.set(one, byOwner);
  }
  return byOwner.get(input.sourceId) ?? [];
}
