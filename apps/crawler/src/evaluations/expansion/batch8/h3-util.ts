/** Shared helpers for the batch-8 (h3) extractors. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

export type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

export const BASE_WARNING = '保存済み抽出テキストから部分構造化。PDF原本との再照合は未実施。表の空欄・列位置を推測して補完していません。原典ページ番号は未復元のため抽出テキスト内の文字位置を記録。';
export const MERGE_NOTE = '同一年度・同一事業の再掲（値一致）を1件に統合し、再掲箇所を根拠に追加。';

/** Full-width digits to ASCII; 元 counts as 1. */
export const digits = (s: string) => Number(s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)).replace(/^元$/, '1'));
export const reiwa = (s: string) => 2018 + digits(s);
export const heisei = (s: string) => 1988 + digits(s);
export const toNum = (s: string) => Number(s.replace(/[,，]/g, ''));
export const norm = (s: string | null) => s?.normalize('NFKC').replace(/\s/g, '') ?? '';

/** Each start offset of `re` (global) in `text`, paired with the end of its segment (next match or `end`). */
export function segments(text: string, re: RegExp, end = text.length): { m: RegExpExecArray; start: number; end: number }[] {
  const ms = [...text.matchAll(re)] as RegExpExecArray[];
  return ms.map((m, i) => ({ m, start: m.index!, end: i + 1 < ms.length ? ms[i + 1].index! : end }));
}

/**
 * Same name/department/period within the given records is one business: identical structured values merge (evidence appended),
 * differing values drop every copy.
 */
export function dedupe(records: ProjectEvaluation[]): ProjectEvaluation[] {
  const key = (p: ProjectEvaluation) => JSON.stringify([norm(p.projectName), norm(p.department), p.evaluationYear, p.evaluatedFiscalYear]);
  const sig = (p: ProjectEvaluation) => JSON.stringify([p.projectCode, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]),
    p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual, i.unit]), p.ratings.map(r => [r.label, r.value])]);
  const out = new Map<string, ProjectEvaluation>(), bad = new Set<string>();
  for (const p of records) {
    const k = key(p), old = out.get(k);
    if (!old) { out.set(k, p); continue; }
    if (sig(old) !== sig(p)) { bad.add(k); continue; }
    old.evidence.push(...p.evidence);
    if (!old.warnings.includes(MERGE_NOTE)) old.warnings.push(MERGE_NOTE);
  }
  return [...out].filter(([k]) => !bad.has(k)).map(([, p]) => p);
}

/** Runs a per-document extractor over every document once, dedupes across documents, and returns this input's share. */
export function acrossInputs(raw: (input: CachedInput) => ProjectEvaluation[]): (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[] {
  const memo = new WeakMap<CachedInput[], ProjectEvaluation[]>();
  return (input, inputs) => {
    let all = memo.get(inputs);
    if (!all) { all = dedupe(inputs.flatMap(i => raw(i))); memo.set(inputs, all); }
    return all.filter(p => p.evidence[0].sourceUrl === input.sourceUrl && p.evidence[0].sha256 === input.sourceSha256);
  };
}
