import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { extractKitsuki, extractKoga, extractMaibara, extractOga } from './h1-lists';
import { extractMatsumae, extractNishimeya, extractTakamatsu } from './h1-sheets';

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '05206': { extract: extractOga, scope: '令和５年度（４年度実施事業）行政評価結果一覧（一次評価）の一般会計・企業会計の各行から、事業名・所管課・評価区分・総合点・5項目の評点を検算の上で構造化。庁内・外部評価対象5事業の二次評価・外部評価、評価シートの決算額・成果指標は対象外。' },
  '40223': { extract: extractKoga, scope: '平成24年度行政評価（平成23年度事務事業評価）最終評価結果報告書の最終評価対象事業一覧から、事業名・担当部課・必要性・効率性・成果・方向性（規模・経費）を構造化。各部の基本事業管理表の本文、市民満足度調査は対象外。' },
  '25214': { extract: extractMaibara, scope: '令和６年度実施事業の教育委員会点検評価報告書の対象事業の評価一覧（30事業）から事務事業名・主管課・総合評価と、各事業票の事業コスト（決算の事業費・人件費・計）を検算の上で構造化。予算額・財源内訳、取組ごとの評価、学校等の評価は対象外。' },
  '44210': { extract: extractKitsuki, scope: '令和６年度施策評価及び事務事業評価並びに補助金評価報告書の事務事業評価コメント一覧（外部評価5事業）から事業名と見直しの方針を構造化。施策評価コメント、総合コメント本文、補助金評価は対象外。' },
  '37201': { extract: extractTakamatsu, scope: '令和7年度（6年度決算分）高松市事務事業評価表の各票から事務事業名・課名・評価ランク・今後の方向性と、検算が一致したコストの推移（R4〜R6決算の事業費・人件費・トータルコスト、R7予算の事業費）を構造化。活動・成果指標、評価項目別の点数は対象外。' },
  '01331': { extract: extractMatsumae, scope: '令和７年度（令和６年度対象）教育委員会の事務・事業の点検及び評価シートから、目次と一致した事務事業番号・事務事業名・担当課と、節別合計が一致した令和６年度予算額を構造化。自己評価・外部評価の点数（選択印が判別不能）、決算額の推移、コメントは対象外。' },
  '02343': { extract: extractNishimeya, scope: '電源立地地域対策交付金の事業評価個表（令和7年度、1事業）から事業名・担当課室・活動指標の見込と実績を構造化。成果指標（実績未記載）、金額（総括表と契約金額の関係が未確定）は対象外。' },
};
