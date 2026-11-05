import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as hirono } from './y3-hirono';
import { entry as ohtawara } from './y3-ohtawara';
import { entry as ota } from './y3-ota';
import { entry as sanuki } from './y3-sanuki';
import { entry as yaita } from './y3-yaita';
import { entry as yamada } from './y3-yamada';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 年度の記載がない公開済みレコードの目的・事業内容・成果の補強（同じ資料から作った事業票に限り突き合わせる。2026-11、グループ y3）。 */
export const entries: Record<string, Entry> = {
  // 年度なしの公開済みレコード（439件）はすべて資料６「事務事業評価（総点検）評価結果一覧表」の行。一覧表は事業費・評価点・
  // チェック欄だけで、目的・事業内容・成果の欄がない（各課の評価シートは別の資料のため、同じ資料に限る突き合わせの対象外）。
  '11216': none('羽生市: 年度なしの補強なし（公開済みレコードの元資料は評価結果一覧表で、目的・事業内容・成果の欄がない）。'),
  '09210': ohtawara,
  '03482': yamada,
  '37206': sanuki,
  '09211': yaita,
  // 第1期総合戦略の外部検証（委員評価）は、プロジェクト名・評価区分・委員ごとの点数の一覧で、文章の欄がない。
  '06403': none('飯豊町: 年度なしの補強なし（公開済みレコードの元資料は外部検証の点数一覧で、目的・事業内容・成果の欄がない）。'),
  '03507': hirono,
  // 平成24年度 事業実績の票は「事業目的・目標」欄が縦書きの見出し（事／業／目／的）の行と予算科目・財源の列が交互に出力され、
  // 見出しのない行がどちらの列か本文から決まらない。欄がまとまって出力される票は年度なしの公開済みレコードのうち1件だけ。
  '01395': none('ニセコ町: 年度なしの補強なし（事業目的・目標の欄がほかの列と交互に出力され、行の帰属が本文で確定しない）。'),
  '10205': ota,
};
