/** Batch-9 group i2: project-level evaluation extractors for documents acquired in the third collection run (web discovery). */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { extractKunitachi, extractOhtawara } from './i2-a';
import { extractAomori, extractAyase, extractHidaka, extractOgi, extractTagajo } from './i2-b';
import { extractNasu } from './i2-nasu';

// Not included (no project-level evaluation rows among the new documents):
// 02202 弘前市（総合計画の施策評価・プロジェクト評価。計画事業の評価・金額は段組みで対応不明）, 07212 南相馬市（サマーレビュー: 政策・施策のKGI/KPI評価）,
// 08235 つくばみらい市（施策評価）, 32386 飯南町（総合振興計画の施策実施状況・評価委員会答申）, 11342 嵐山町（総合振興計画の施策別検証。事務事業は決算額のみ）.
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '09210': { extract: extractOhtawara, scope: '令和6年度事務事業評価シート（大田原市事務事業評価兼実施計画シート）の各票から事務事業名・部課名と、ラベル直後に値が読める評価表からの評価・担当課評価・部内評価会議の最終評価を構造化。年度は票に評価対象年度の明記がないため未設定。コスト計算（単位未記載）、活動・成果指標、評価点数は対象外。' },
  '13215': { extract: extractKunitachi, scope: '令和6年度 事務事業マネジメントシート（13事業）から事務事業名・主管課と、✔印が判別できる評価結果（必要性・有効性・効率性・公平性）、令和8年度予算編成に向けた事業の方向性・予算の規模を構造化。施策マネジメントシート、各指標等の推移・事務事業コストの推移（列崩れ）は対象外。' },
  '09407': { extract: extractNasu, scope: '令和4〜7年度 事務事業評価一覧表から事業名・担当課・翌年度の方向性と決算額を構造化。R4・R5版（一覧表）は件数が一致するページの行のみで、最新年度の決算額（円）を収録。R6・R7版（票）は件数が一致するページのみで、支出済額は検算と前年版との照合が一致した場合のみ。評価・改善点等の本文、過年度の決算額列、予算額内訳は対象外。' },
  '02201': { extract: extractAomori, scope: '令和5〜8年度 青森市教育委員会事務の点検及び評価報告書（主要な施策の成果・事務点検資料）の目次から主要事業名・担当課名を構造化。決算額・成果の説明・今後の方向性の本文（段組みで事業との対応が不確定）、令和4年度版（施策単位の評価）は対象外。' },
  '11242': { extract: extractHidaka, scope: '日高市 行政評価書のうち施策評価に「令和６年度の主な成果と課題」と明記された2分冊（施策1〜13・14〜26）の事務事業評価表から、事務事業名・担当課と行内に現れた評価ランク（Ａ〜Ｃ）を構造化。年度表記のない他年度の分冊、経費（年度表記なし）、施策評価、評価すべき事項・改善すべき事項の本文は対象外。' },
  '41208': { extract: extractOgi, scope: '第２次小城市総合計画後期基本計画 実施計画進捗管理シート（令和4〜6年度）から予算番号・事務事業名・担当課を構造化。取組実績・今後の方向性の本文（2列が混在して抽出）は対象外。' },
  '04209': { extract: extractTagajo, scope: '令和５年度主要な施策の成果に関する報告書＜その３＞の事務事業一覧から事務事業名・担当・款項目を構造化（評価表本体は画像のため本文なし）。決算額（行との対応が不確定）、事業状況・上位貢献の評価、令和6・7年度版（本文抽出不可）は対象外。' },
  '14218': { extract: extractAyase, scope: '総合計画外部評価結果（戦略プロジェクトの総合計画進行管理シート）から、実施計画事業名と主管課一次評価の達成状況（A〜D）が隣接して読める組を構造化。プロジェクト単位のSTEP進捗・二次評価・外部評価、実施計画効果検証一覧（段組み崩れ）は対象外。年度は資料に明記がないため未設定。' },
};
