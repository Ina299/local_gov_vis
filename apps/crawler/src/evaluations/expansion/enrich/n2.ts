import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as hanamaki } from './n2-hanamaki';
import { entry as tatebayashi } from './n2-tatebayashi';
import { entry as utsunomiya } from './n2-utsunomiya';
import { entry as iijima } from './n2-iijima';
import { entry as hidaka } from './n2-hidaka';
import { entry as joso } from './n2-joso';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 既存レコードの補強用の評価シート抽出（花巻市・館林市・宇都宮市・飯島町・日高市・常総市）。 */
export const entries: Record<string, Entry> = {
  '03205': hanamaki,
  '10207': tatebayashi,
  '09201': utsunomiya,
  '20384': iijima,
  '11242': hidaka,
  '08211': joso,
};
