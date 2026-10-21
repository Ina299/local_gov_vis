import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { atsugi } from './g4-atsugi';
import { hamura } from './g4-hamura';
import { musashino } from './g4-musashino';
import { chikusei, kamakura } from './g4-small';
import { toda } from './g4-toda';
import { yashio } from './g4-yashio';
import { yokohama } from './g4-yokohama';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '14100': { extract: yokohama, scope: '令和8年度事業評価書（様式1、令和7年度事業）の各評価書を1事業として事業名・所管課・事業概要・事業決算額（6・7年度、差引で検算）を構造化。細事業の分析・事業量・客観的指標・目次・区局別の評価結果ページは対象外。' },
  '11224': { extract: toda, scope: '2024年度（令和6年度）行政評価の≪事後評価シート≫を1事務事業として事業名・番号・担当課・令和5年度執行額/令和6年度予算額/人件費/総コスト（財源内訳と合計で検算）・目標達成状況・評価結果4項目・方向性を構造化。施策評価シート・指標表・計画額は対象外。' },
  '13203': { extract: musashino, scope: '事務事業評価シート（評価対象年度令和7年度、R8_10〜13）を1事業として事業名・事業No.・所管課・支出額計（令和5・6年度決算、収入内訳で検算）・必要性/有効性/効率性・施策への貢献状況・今後の方向性を構造化。事業費/人件費行・指標表・業務一覧は対象外。' },
  '14212': { extract: atsugi, scope: '令和6・7年度事務事業評価結果報告書の結果一覧の各行を1事業として事業名・部等・課等・適合率・一次評価・適正率・見直し判定を構造化。二次評価・見直し区分・拡大/廃止事業の個別表・集計表・評価シート一覧ページは対象外。' },
  '13227': { extract: hamura, scope: '令和7年度の新規事務事業評価結果一覧（事業名・所管課・A〜C評価）と内部評価（事後評価）結果概要一覧（計画事業名・進捗状況・妥当性/効率性/達成度）の行を構造化。中間評価一覧・事後評価シート・外部評価委員会資料・会議録・評価コメントは対象外。' },
  '14204': { extract: kamakura, scope: '令和6年度行政評価シート【個表】（総務-03法制事務・総務-04公平委員会事務）の事業名・事業コード・令和5年度事業概要・総合評価の選択を構造化。事業費/人件費・最小事業評価・視点別評価・指標は列崩れのため対象外。' },
  '08227': { extract: chikusei, scope: '行政評価に係る外部評価結果の評価対象事業（重点プロジェクト6事業）ごとに進捗状況・来年度の方向性の外部評価委員の評価件数を構造化。各事業の説明資料（スライド）・外部評価の案内ページ・委員コメントは対象外。' },
  '11234': { extract: yashio, scope: '事務事業評価シート（R6年度実施事業の事後評価）を1事業として事業名・担当課・人件費/総事業費（人件費率で検算）・事業費（一致時のみ）・必要性/目標達成度/総合評価/方向性を構造化し、シート未収録の事業は令和7年度行政評価一覧表の事業名・担当課のみ収録。指標表・財源内訳・施策評価・外部評価ページは対象外。' },
};
