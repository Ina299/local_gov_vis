import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';

/**
 * Records published before the current extraction run, supplied by the runner. Extractors that exclude
 * already-published businesses must use this instead of reading the live public files, which include
 * their own earlier output once imported and would make a replay drop everything.
 */
let provider: ((code: string) => ProjectEvaluation[]) | null = null;
export function setPriorRecords(next: ((code: string) => ProjectEvaluation[]) | null): void { provider = next; }
export function priorRecords(code: string): ProjectEvaluation[] {
  if (!provider) throw new Error('Prior published records are not available for this run');
  return provider(code);
}
