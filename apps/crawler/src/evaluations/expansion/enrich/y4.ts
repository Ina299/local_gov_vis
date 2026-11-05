import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as katsuura } from './y4-katsuura';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 年度の記載がない公開済みレコードの目的・事業内容・成果の補強（同じ資料から作った事業票に限り突き合わせる。2026-11、グループ y4）。 */
export const entries: Record<string, Entry> = {
  // 調書に目的欄はなく、「全体事業内容」を事業内容として補う（年度なし・同じPDFの事業票どうしで照合）。
  '12218': katsuura,
};
