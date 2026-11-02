import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as kashima } from './m11-kashima';
import { entry as matsumae } from './m11-matsumae';
import { entry as seiro } from './m11-seiro';
import { entry as shinjo } from './m11-shinjo';
import { entry as taito } from './m11-taito';
import { entry as takahashi } from './m11-takahashi';
import { entry as tsuchiura } from './m11-tsuchiura';
import { entry as yashio } from './m11-yashio';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m11）。 */
export const entries: Record<string, Entry> = {
  // 取得済み資料は事務事業評価一覧（施策・事業名・課・評価結果のみ）、事業統合の一覧（事業内容・判断理由の列が行ごとに交互に折り返して混在）、
  // 施策・政策評価一覧、市民満足度調査で、事業ごとの目的欄を持つ評価シートがない。
  '12211': none('成田市: 補強なし（事務事業評価一覧には目的欄がなく、事業統合一覧の事業内容は列が交互に折り返して事業との対応が確定しない）。'),
  '11234': yashio,
  '13106': taito,
  '08203': tsuchiura,
  '06205': shinjo,
  // 施策評価の関連事務事業ごとの欄は取組結果・評価と評定・評価の理由だけで目的欄がなく、取組結果は右の「具体的な成果」の列と行ごとに交互に混在する。
  '13219': none('狛江市: 補強なし（事業評価の各事業に目的欄がなく、取組結果は具体的な成果の列と行が交互に混在して欄の範囲が確定しない）。'),
  '15307': seiro,
  // 施策評価シートの事務事業の行は事業名・担当課・事業費・貢献度・方針だけで、目的・概要は施策の主な取組ごとにしかない。
  '33204': none('玉野市: 補強なし（施策評価シートの事務事業欄は事業名・担当課・事業費・貢献度・方針のみで、事業ごとの目的欄がない）。'),
  // 事務事業評価シート（部別PDF）は目的・事業概要・事業成果などの列が行ごとに交互に折り返して混在する。
  '12228': none('四街道市: 補強なし（部別の評価シートは目的・事業概要・事業成果の列が行ごとに交互に混在し、欄の範囲が確定しない）。'),
  // 行政評価報告書は委員会の意見と施策・事務事業の評価一覧（事業名・実績額・評価記号）だけで、事業ごとの目的欄がない。
  '01469': none('美深町: 補強なし（行政評価報告書は事務事業の評価一覧と委員会の意見だけで、事業ごとの目的欄がない）。'),
  // 取得済み資料は事務事業評価結果の一覧ページ（事業名・総合評価のみ）で、リンク先の各事業の評価シートPDFは未取得。
  '24324': none('東員町: 補強なし（取得済み資料は評価結果の一覧ページだけで、各事業の評価シートは未取得）。'),
  '27383': none('千早赤阪村: 補強なし（取得済み資料は評価結果の一覧ページだけで、各事業の評価シートは未取得）。'),
  '33209': takahashi,
  '01331': matsumae,
  // 新規事業評価表・事業評価表は理想・現状・課題・原因・方向性などの欄が2〜3列に並び、抽出テキストで行ごとに交互に混在する。目的の欄はない。
  '45201': none('宮崎市: 補強なし（新規事業評価表は理想・現状・課題・方向性の欄が行ごとに交互に混在し、目的の欄もない）。'),
  '41207': kashima,
};
