import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

// 掲載ページの記録（verification.evidenceSourceId）がない資料は、同じページに並んでいても照合しない（2026-11-06 の方針）。
const NO_PAGE = '資料の掲載ページの記録がなく（evidenceSourceId なし）、同じページの資料として照合できない。';

/** 年度の記載がない公開済みレコードを、同じ公式ページに掲載された別の資料から作った事業票で補う（2026-11、グループ p1）。 */
export const entries: Record<string, Entry> = {
  '07368': none('南会津町 令和3年度行政評価結果（施策マネジメントシート、年度の記載なし）: 同じページの他の資料は別の施策のシートで、事業ごとの目的・概要・成果は各事業が載る自分の施策シート内にしかない（そのシート内の欄は列混在）。'
    + '他のシートに事業名が出るのは本文中の言及だけ（集落応援交付金事業・英語が話せる人材育成事業）。同じページの 45_gyouseihyouka.pdf は「令和2年度作成」の別の回で使わない。'),
  '42201': none(`長崎市 事務事業事前評価結果（令和6年度当初予算）: ${NO_PAGE}`),
  '14218': none(`綾瀬市 総合計画外部評価結果（令和5・7・8年度）: ${NO_PAGE}`),
  '06403': none(`飯豊町 第1期 総合戦略（評価シート一覧）: ${NO_PAGE}同じ第1期の事業別レビューシートに意図の欄はある。`),
  '01395': none(`ニセコ町 平成24年度事業別点検評価調書（事業実績書）: ${NO_PAGE}`),
};
