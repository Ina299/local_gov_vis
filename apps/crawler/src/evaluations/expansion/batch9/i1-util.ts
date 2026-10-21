import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence } from '../shared';

export type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

export const nfkc = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
/** Full-width digits and commas are accepted; the raw string is kept as printed. */
export const num = (raw: string) => Number(nfkc(raw).replace(/[,，]/g, ''));

export function amount(input: CachedInput, kind: EvaluationAmount['kind'], fiscalYear: number, rawValue: string, rawUnit: '円' | '千円', raw: string, start: number): EvaluationAmount {
  return { kind, fiscalYear, amountYen: num(rawValue) * (rawUnit === '千円' ? 1000 : 1), rawValue, rawUnit, evidence: evidence(input, raw, start) };
}

/** Exact substring at a known offset of the sheet (start = absolute offset of the sheet). */
export const at = (input: CachedInput, sheetStart: number, m: RegExpMatchArray | RegExpExecArray, group = 0) => {
  const raw = m[group]!, off = sheetStart + m.index! + (group ? m[0].indexOf(raw) : 0);
  return evidence(input, raw, off);
};

/** Split a document into sheets starting at each occurrence of a heading. */
export function sheets(text: string, heading: string | RegExp): { start: number; text: string }[] {
  const re = typeof heading === 'string' ? new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : new RegExp(heading.source, heading.flags.includes('g') ? heading.flags : heading.flags + 'g');
  const starts = [...text.matchAll(re)].map(m => m.index!);
  return starts.map((s, i) => ({ start: s, text: text.slice(s, starts[i + 1] ?? text.length) }));
}

function content(p: ProjectEvaluation): string {
  return JSON.stringify({ n: nfkc(p.projectName), d: p.department, y: [p.evaluationYear, p.evaluatedFiscalYear], a: p.amounts.map(({ evidence: _e, ...a }) => a),
    i: p.indicators.map(({ evidence: _e, ...i }) => i), r: p.ratings.map(({ evidence: _e, ...r }) => r) });
}
const MERGED = '同じ評価年度の再掲（同一資料内または同じ取得分の別資料）を値の一致を確認して1件に統合。';

/** Reprints of the same business and period: merge evidence when values agree, drop every copy when they disagree. */
export function mergeReprints(records: ProjectEvaluation[], key: (p: ProjectEvaluation) => string): ProjectEvaluation[] {
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  for (const p of records) {
    const k = key(p), old = out.get(k);
    if (!old) { out.set(k, p); continue; }
    if (content(old) !== content(p)) { conflicts.add(k); continue; }
    // Evidence stays within the owning document; a reprint in another document is only noted.
    const same = p.evidence.filter(e => e.sourceUrl === old.evidence[0].sourceUrl);
    old.evidence.push(...same);
    if (!old.warnings.includes(MERGED)) old.warnings.push(MERGED);
    for (const e of p.evidence.filter(e => e.sourceUrl !== old.evidence[0].sourceUrl).slice(0, 1)) {
      const note = `同一内容の再掲あり: ${e.sourceUrl}`;
      if (!old.warnings.includes(note)) old.warnings.push(note);
    }
  }
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

/**
 * Same business printed in several documents of one acquisition: extract every eligible document, merge agreeing copies
 * into the copy from the first document (by source ID) and drop disagreeing ones. Returns only the records owned by `input`.
 */
export function acrossDocuments(input: CachedInput, inputs: CachedInput[], one: (i: CachedInput) => ProjectEvaluation[], key: (p: ProjectEvaluation) => string): ProjectEvaluation[] {
  if (!one(input).length) return [];
  const all = [...inputs].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).flatMap(i => one(i).map(p => ({ p, owner: i.sourceId })));
  const owners = new Map<ProjectEvaluation, string>(all.map(x => [x.p, x.owner]));
  return mergeReprints(all.map(x => x.p), key).filter(p => owners.get(p) === input.sourceId);
}
