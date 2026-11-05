import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as iide } from './p2-iide';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 掲載ページを保存したページの本文で確かめて記録した資料どうしの照合（data/evaluations/source-pages.json、2026-11-07 以降、グループ p2）。 */
export const entries: Record<string, Entry> = {
  '06403': iide,
};
