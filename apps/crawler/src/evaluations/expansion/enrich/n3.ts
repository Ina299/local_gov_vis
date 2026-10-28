/** Enrichment sheet extractors (n3): 芦別市・川越市・遠野市・足立区・箱根町. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { extractAshibetsuSheets } from './n3-ashibetsu';
import { extractKawagoeSheets } from './n3-kawagoe';
import { extractAdachiPolicyTables } from './n3-adachi';
import { extractHakoneStrategy } from './n3-hakone';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

export const entries: Record<string, Entry> = {
  '01216': { extract: extractAshibetsuSheets, scope: '主要事務事業実施の状況及び事務事業評価結果（一般会計）各款の個票（令和4〜6年度決算）の決算額（円）表から、当年度・前年度の決算額。財源内訳の合計と増減で検算できる表のみ。事務事業名は同年度の目次と一致する見出し行に限る。特別会計の個票（千円・列崩れ）と令和3年度決算の個票（年度表記なし）は対象外。' },
  '11201': { extract: extractKawagoeSheets, scope: '令和6年度事務事業評価シート（二次評価）8事業の令和4・5年度決算額（人件費・事業費・総事業費）と二次評価（効率性・達成度・総合評価・今後の方向性）、令和7年度事務事業整理表の総合評価・今後の方向性（同年度の事務事業評価一覧と総事業費が一致する行のみ）。' },
  '13121': { extract: extractAdachiPolicyTables, scope: '令和8年度個別施策評価調書（令和7年度事業実施分）の「施策の手段として位置付けられる事務事業の評価結果」表から、令和7年度の人件費・総事業費（千円）、課長評価、施策への貢献度。表の合計行が施策の投入コスト表（単位:千円）の令和7年度と一致し、列合計と各行の事業費＋人件費＝総事業費が成り立つ表・行のみ。事業費は決算・予算の別がないため対象外。' },
  '14382': { extract: extractHakoneStrategy, scope: '第2期まち・ひと・しごと創生総合戦略 令和6年度施策別評価結果の施策別事業別の評価シートから、事業別の進捗度（A〜D）。金額の記載はない。' },
};
