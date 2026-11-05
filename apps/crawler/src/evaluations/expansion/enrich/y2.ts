import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as awashimaura } from './y2-awashimaura';
import { entry as higashimatsuyama } from './y2-higashimatsuyama';
import { entry as hofu } from './y2-hofu';
import { entry as ichihara } from './y2-ichihara';
import { entry as nihonmatsu } from './y2-nihonmatsu';
import { entry as zao } from './y2-zao';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 年度の記載がない公開済みレコードの目的・事業内容・成果の補強（同じ資料から作った事業票に限り突き合わせる。2026-11、グループ y2）。 */
export const entries: Record<string, Entry> = {
  '35206': hofu,
  '11212': higashimatsuyama,
  '07210': nihonmatsu,
  '15586': awashimaura,
  '12219': ichihara,
  '04301': zao,
  '15222': none('上越市: 補強なし（年度なしの公開済みレコードの元資料「事務事業評価の結果について」の評価結果一覧は、事業概要の列に課等名の列が同じ行で混ざり、番号も前後の行にずれるため、事業ごとの欄の対応が確定しない）。'),
};
