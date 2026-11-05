import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { pageEntry as chikusei } from './m29-chikusei';
import { entry as hanyu } from './p0-hanyu';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 年度の記載がない公開済みレコードを、同じ公式ページに掲載された別の資料から作った事業票で補う（2026-11、グループ p0）。 */
export const entries: Record<string, Entry> = {
  '08227': chikusei,
  '11216': hanyu,
  '13108': none('江東区 令和6年度行政評価の事務事業評価結果（03_jimujigyouhyouka.pdf、施策別の一覧。年度の記載なし）: 同じページ（r6gyouseihyouka.html）の他の資料は施策評価シート（施策の目標・指標・取組方針で、事業ごとの目的・内容の欄はない）、'
    + '「新たな取り組み等（令和７年度当初予算）」（事業名・事業内容は令和7年度予算で新たに行う取組の予定で、事業そのものの目的・実績ではなく、列も混在）、「事業の見直し（令和７年度当初予算）」（見直し内容は予定）と目次・参考資料だけで、事業ごとの目的・事業内容・成果の欄はない。'),
};
