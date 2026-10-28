import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as minato } from './n5-minato';
import { entry as yugawara } from './n5-yugawara';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの補強用の評価シート抽出（港区・湯河原町・滝沢市・橿原市・壱岐市）。 */
export const entries: Record<string, Entry> = {
  '13103': minato,
  '14384': yugawara,
  // 公開済みレコード（令和6・7年度事業実績報告書）の決算額・指標の表は見開きの右ページにあり、事業名を持たない。
  // 段組みが崩れて表の区切りも不明瞭で、左ページの事業との対応は並び順の推測になるため抽出しない。
  // 実行計画書（令和6〜8年度）も同じ様式で、計画額は決算でもない。
  '03216': none('滝沢市: 補強なし（事業実績報告書・実行計画書の金額・指標表は事業名を持たない別ページで、事業との対応が本文で確定しない）。'),
  // 公開済みレコードは平成29年度実施事業の行政評価結果一覧表の事務事業行。取得済みの事務事業評価表（5c34c4cbf1a7f00f31b19e59.pdf、35事業）は
  // すべて一覧表で列が崩れて公開対象外になった政策10（信頼される行政を進めるまち）の事業で、同名の公開済みレコードがない。
  '29205': none('橿原市: 補強なし（取得済みの事務事業評価表35事業は、いずれも公開済みレコードのない事業）。'),
  // 個別事業評価調書は公開済みレコードの元資料そのもの。事業費の推移表に単位の記載がなく、指標は名称と数値の列が分かれて
  // 対応が並び順でしか決まらず、1次評価の各項目判定・2次評価も列が崩れているため、追加できる値がない。
  '42210': none('壱岐市: 補強なし（事業費は単位の記載なし、指標・各項目判定は列の対応が本文で確定しない）。'),
};
