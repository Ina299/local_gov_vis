import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as chofu } from './m5-chofu';
import { entries as edu } from './m5-edu';
import { entries as fujisawa } from './m5-fujisawa';
import { entries as iruma } from './m5-iruma';
import { entries as kita } from './m5-kita';
import { entries as niiza } from './m5-niiza';
import { entries as sousei } from './m5-sousei';

/** 第12バッチ m5 担当: 第5回取得（batch11）で新規取得した資料の事務事業単位の評価。 */
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...iruma, ...fujisawa, ...niiza, ...chofu, ...kita, ...edu, ...sousei,
};
