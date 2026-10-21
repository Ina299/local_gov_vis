import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { extractAdachi } from './g1-adachi';
import { extractChuo } from './g1-chuo';
import { extractIruma } from './g1-iruma';
import { extractKoshigaya } from './g1-koshigaya';
import { extractFukushima, extractSakai } from './g1-small';
import { extractYoshikawa } from './g1-yoshikawa';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '11222': { extract: extractKoshigaya, scope: '平成30年度実施事業の事務事業評価表（事後評価）の各票から事業名・所管・事業番号・総合評価と、検算が一致した資源投入量（決算・当初予算・人件費・総コスト）を構造化。活動・成果指標、評価項目の○印、見方資料は対象外。' },
  '11225': { extract: extractIruma, scope: '令和2年度（令和元年度分）事務事業評価シート（一般用）の各票から、評価対象事業一覧表の整理番号で照合した事業名・所管・1次評価の選択結果と、値がそろう票の当初予算・決算額を構造化。公共事業用・見方資料・一覧ページ単体・2次評価・成果指標は対象外。' },
  '13102': { extract: extractChuo, scope: '令和5年度（令和4年度分）主要な施策の成果・行政評価の基本政策別冊子から、目次の事業名・掲載頁で特定した事業別行政評価シートの事業名・部課名と、検算が一致した行政コスト計算書の人件費を構造化。既存の主要な施策の成果一覧にある事業、合本PDF、関連データ・総括本文は対象外。' },
  '13121': { extract: extractAdachi, scope: '令和8年度（令和7年度事業実施分）事務事業評価調書の分冊1〜3から、調書見出しの事務事業番号・名称・記入所属と総合評価(課長評価)の今後の方針を構造化。指標・投入資源の表、施策評価調書、概要一覧は対象外。' },
  '11243': { extract: extractYoshikawa, scope: '令和7年度事務事業評価シートのうち議会事務局・工事検査課等・都市建設部の3冊から、事務事業名・No.・所管部署と、検算が一致した事業費（決算・予算）を構造化。既存の詳細票・結果報告書で構造化済みの事業、指標・評価点は対象外。' },
  '08546': { extract: extractSakai, scope: '平成25年度行政評価（事務事業評価）一覧の各行から事業名・担当課・総合評価（1〜4）を構造化。区分・財源・年度不明の事業費、折返しで行対応が確定しない今後の方向性、平成24年度ページと結果報告の説明文は対象外。' },
  '01332': { extract: extractFukushima, scope: '令和7年度（令和6年度決算）事務事業評価結果表の評価点集表から、整理番号・担当課・事務事業名・必要性等の点数と各段階の評価（A〜D）を検算の上で構造化。個別評価シートの事業費・指標、行政評価実施要綱は対象外。' },
};
