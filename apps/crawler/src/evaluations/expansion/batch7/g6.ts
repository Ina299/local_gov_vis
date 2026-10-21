import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as date } from './g6-07213';
import { entries as utsunomiya } from './g6-09201';
import { entries as kumagaya } from './g6-11202';
import { entries as asaka } from './g6-11227';
import { entries as fujisawa } from './g6-14205';
import { entries as aikawa } from './g6-14401';
import { entries as toyoura } from './g6-01571';

/** 第7バッチ g6 担当分。常総市・新座市・小田原市は新規資料が既存構造化と全件同一、那珂市・上富良野町・浦安市・船橋市・新見市は事務事業単位の評価票がない（または列対応が確定できない）ため対象外。 */
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...date, ...utsunomiya, ...kumagaya, ...asaka, ...fujisawa, ...aikawa, ...toyoura,
};
