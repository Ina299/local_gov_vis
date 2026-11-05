import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as kanuma } from './y0-kanuma';
import { entry as wako } from './y0-wako';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 年度の記載がない公開済みレコードの目的・事業内容・成果の補強（同じ資料から作った事業票に限り突き合わせる。2026-11、グループ y0）。 */
export const entries: Record<string, Entry> = {
  // 公開済みレコードの元資料（r7hyoukap141-161.pdf）は事務事業評価結果一覧表（番号・事業名・担当局課・評価結果・廃止理由）だけで、
  // 事業ごとの目的・内容の欄がない。
  '46201': none('鹿児島市: 補強なし（元資料は評価結果の一覧表で、目的・事業内容の欄がない）。'),
  '11229': wako,
  '09205': kanuma,
  // 元資料（2-3sihyou1〜3.pdf）は事業別の指標の目標値・実績値の表だけで、目的・事業内容の欄がない（成果は公開済み）。
  '34211': none('大竹市: 補強なし（元資料は事業別の指標達成状況の表で、目的・事業内容の欄がない）。'),
  // 元資料（6078.html）は事務事業事前評価結果の一覧表（番号・部局・所属・事業名・方向性）だけ。
  '42201': none('長崎市: 補強なし（年度のない公開済みレコードの元資料は事前評価結果の一覧表で、目的・事業内容の欄がない）。'),
  // 元資料（r5・r7・r8gaibuhyouka.pdf）の総合計画進行管理シートは STEP ごとの内容がプロジェクト単位で、実施計画事業ごとの目的欄がない。
  '14218': none('綾瀬市: 補強なし（進行管理シートの内容欄はプロジェクトのSTEP単位で、実施計画事業ごとの目的・内容がない）。'),
  // 元資料（1-20241002092620.pdf、後期基本計画評価報告書）の「取組内容・成果」欄は、取組項目名の列と行単位で交互に混ざり、
  // 本文の範囲が確定しない。目的の欄もない。
  '14217': none('南足柄市: 補強なし（年度のない公開済みレコードの元資料は取組内容・成果の欄が取組項目名の列と混ざり、目的の欄もない）。'),
};
