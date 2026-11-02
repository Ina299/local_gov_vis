import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as abashiri } from './m9-abashiri';
import { entry as akishima } from './m9-akishima';
import { entry as hanamaki } from './m9-hanamaki';
import { entry as kamogawa } from './m9-kamogawa';
import { entry as miyoshi } from './m9-miyoshi';
import { entry as sakado } from './m9-sakado';
import { entry as shimanto } from './m9-shimanto';
import { entry as yokoze } from './m9-yokoze';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m9）。 */
export const entries: Record<string, Entry> = {
  // 令和4・5年度の事務事業評価一覧表は「事業概要」「評価・改善点等」だけで目的の欄がなく、事業概要も表の行との対応が
  // ページ内の並び順でしか決まらない。令和6・7年度は1ページに3事業の様式で、欄の本文が事業をまたいで並ぶ。
  '09407': none('那須町: 補強なし（事務事業評価一覧表に目的の欄がなく、事業概要も事業との対応が並び順でしか決まらない）。'),
  '12223': kamogawa,
  // 取得済みは行政評価結果表（事業名と2次評価の一覧）と掲載ページだけで、課別の事務事業評価シートは未取得。
  '36489': none('東みよし町: 補強なし（取得済みは評価結果の一覧表のみで、目的の欄を持つ事務事業評価シートは未取得）。'),
  // 公開済みレコード（令和7年度 事務事業評価結果）は評価年・対象年度を持たず、年度を条件とする突き合わせに当たらない。
  '11229': none('和光市: 補強なし（公開済みレコードに評価年・対象年度がなく、年度で突き合わせられない）。'),
  '03205': hanamaki,
  '11239': sakado,
  // 第6次総合計画 施策別評価結果は施策単位の評価シートで、構成事業は事業名・進捗度・今後の方向性の一覧のみ。
  '14382': none('箱根町: 補強なし（施策別評価シートの構成事業は事業名・進捗度・方向性の一覧で、事業ごとの目的の記載がない）。'),
  // 事務事業評価の結果一覧は事業目的・事業内容・指標の列が1行ずつ交互に混ざって抽出されている。
  '20430': none('大桑村: 補強なし（結果一覧の事業目的・事業内容の列が行ごとに混ざり、欄の区切りが確定しない）。'),
  '39412': shimanto,
  // 取得済みは評価対象事業と結果の一覧表・シートの見方・施策評価のみで、事務事業評価シート本体は未取得。
  '08226': none('那珂市: 補強なし（取得済みは事務事業評価の対象事業・結果一覧表のみで、目的の欄を持つ評価シートは未取得）。'),
  '34209': miyoshi,
  // 公開済みレコード（令和6年度 事務事業評価）は評価年・対象年度を持たず、年度を条件とする突き合わせに当たらない。
  '09210': none('大田原市: 補強なし（公開済みレコードに評価年・対象年度がなく、年度で突き合わせられない）。'),
  '01211': abashiri,
  // 公開済みレコードは市民による行政評価の結果概要（事業名と評価の集計）から作られ、目的等を記載した
  // 「主要な施策の成果に関する調書」は未取得。
  '43202': none('八代市: 補強なし（取得済みは市民による行政評価の結果概要・質問回答のみで、事業の目的を記載した調書は未取得）。'),
  '13207': akishima,
  '11361': yokoze,
};
