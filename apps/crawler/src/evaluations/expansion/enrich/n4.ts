import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { marugame } from './n4-marugame';
import { musashimurayama } from './n4-musashimurayama';
import { sayama } from './n4-sayama';
import { shunan } from './n4-shunan';

/** 既存レコードの補強用の評価シート抽出（担当 n4）。最上町・南会津町は補強できる資料がないため対象外。 */
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '11215': sayama,
  '13223': musashimurayama,
  '35215': shunan,
  '37202': marugame,
};
