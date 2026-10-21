/** Batch-8 group h0: project-level evaluation extractors for documents acquired in the second collection run. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { eduSmallEntries } from './h0-edu-small';
import { kaiyoKihokuEntries } from './h0-kaiyo-kihoku';
import { noboribetsuMatsubaraEntries } from './h0-noboribetsu-matsubara';
import { okinawaKainanEntries } from './h0-okinawa-kainan';
import { tamanaEntries } from './h0-tamana';

// Not included (no project-level evaluation sheets among the new documents):
// 01458 東川町, 01646 本別町, 04406 利府町（実施計画）, 06403 飯豊町（総合戦略プロジェクト）, 13110 目黒区（行革計画）,
// 21208 瑞浪市（リンクページのみ）, 23563 豊根村（公共交通協議会）, 32207 江津市・41205 伊万里市（主要施策の成果説明書）,
// 38488 鬼北町（基本施策単位の判定）, 43403 大津町（基本事業評価）.
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...noboribetsuMatsubaraEntries,
  ...okinawaKainanEntries,
  ...kaiyoKihokuEntries,
  ...eduSmallEntries,
  ...tamanaEntries,
};
