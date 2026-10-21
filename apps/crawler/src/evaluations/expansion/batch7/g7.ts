import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as entriesA } from './g7-a';
import { entries as entriesB } from './g7-b';
import { extractMinamiaizuBatch7 } from './g7-minamiaizu';
import { extractMinato } from './g7-minato';
import { extractNakano } from './g7-nakano';
import { extractOamishirasato } from './g7-oamishirasato';
import { extractOgawara } from './g7-ogawara';
import { extractWako } from './g7-wako';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...entriesA,
  ...entriesB,
  '13103': { extract: extractMinato, scope: '平成29年度港区事務事業評価シート（所管課別PDF）の事業名・所属・事業費の状況（算術整合した行の当初予算額・決算額）・一次評価3項目。評価結果一覧・三次評価対象一覧・指標・総合評価は対象外' },
  '12239': { extract: extractOamishirasato, scope: '令和7年度実施計画事業に係る事務事業評価の2次評価一覧（事業名・担当課・1次評価・2次評価の方向性区分）。評価表本体（画像PDFで本文なし）・意見への回答・事務事業一覧の再掲は対象外' },
  '11229': { extract: extractWako, scope: '和光市事務事業評価表（目標像別PDF）の事業名・予算事業コード・課室名・事業費（予算額・決算額、不用額/執行率で整合確認した表のみ）・指標（列が連続する行のみ）。評価項目①〜⑩・今後の方向性・案内ページは対象外' },
  '13114': { extract: extractNakano, scope: '主要施策の成果に掲載の令和6年度事業の行政評価（内部評価票）の事業名・所管・事業のコスト（事業費・人件費・支出、C＝A＋Bが成立する表のみ）・指標（列が連続する行のみ）・事業の方向。外部評価報告書・ヒアリング記録・決算概要は対象外' },
  '07368': { extract: extractMinamiaizuBatch7, scope: '施策マネジメントシート（基本目標2〜5）の「施策を構成する事務事業」欄のうち事業名と担当係が連続するブロックのみ（事業名・担当係の部分レコード）。事業別の目的〜対策・事業費・施策全体の評価は列混在のため対象外' },
  '04321': { extract: extractOgawara, scope: '大規模事業評価の自己評価調書4件（事業名・所管課のみの部分レコード）。計画段階の事業費試算・記述式の評価結果・委員会資料・要求水準書・答申・会議録は対象外' },
};
