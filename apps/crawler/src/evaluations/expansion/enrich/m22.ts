import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as noboribetsu } from './m22-noboribetsu';
import { entry as tanabe } from './m22-tanabe';
import { entry as kanoya } from './m22-kanoya';
import { entry as neba } from './m22-neba';
import { entry as inagi } from './m22-inagi';
import { entry as nikko } from './m22-nikko';
import { entry as akune } from './m22-akune';
import { entry as minamiizu } from './m22-minamiizu';
import { entry as kamikawa } from './m22-kamikawa';
import { entry as daigo } from './m22-daigo';
import { entry as ogawara } from './m22-ogawara';
import { entry as rikubetsu } from './m22-rikubetsu';
import { entry as mori } from './m22-mori';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m22）。 */
export const entries: Record<string, Entry> = {
  '01230': noboribetsu,
  '30206': tanabe,
  // 実施計画事業調書（令和７年度決算）に目的の欄がない。事業概要は（全体）（今年度）の2欄が抽出テキストで見出しから離れて並び、
  // どちらの欄の文章か本文で確定しない。総括（自己点検）は成果・課題・今後の取組をまとめた欄で、成果だけを切り出せない。
  '27218': none('大東市: 補強なし（実施計画事業調書に目的欄がなく、事業概要は全体・今年度の2欄の対応が確定しない）。'),
  '46203': kanoya,
  // まち・ひと・しごと創生総合戦略事業評価シート（R6）は、事業の目的と事業の概要の2欄の文が抽出テキストで同じ行に混ざって並ぶ。
  '40448': none('東峰村: 補強なし（総合戦略事業評価シートの目的・概要の2欄が抽出テキストで行ごとに混ざり、欄ごとに分けられない）。'),
  '20410': neba,
  '13225': inagi,
  '09206': nikko,
  '46206': akune,
  '22304': minamiizu,
  // 市民参加型事業評価 事業別評価結果（2024年度）の「事業の概要」と「トピックス」は見出しが続けて並び、後に続く1行と箇条の
  // どちらがどの欄か抽出テキストで確定しない。目的の欄はなく、評価コメントは評価人の意見で事業の成果ではない。
  '13209': none('町田市: 補強なし（事業別評価結果に目的欄がなく、事業の概要とトピックスの2欄の対応が確定しない）。'),
  '11383': kamikawa,
  '08364': daigo,
  '04321': ogawara,
  // 総合戦略 実績評価シート（平成29年度分）の「事業の概要・目的」欄は、個別事業ごとのシートでも親事業の同じ文（交付金事業全体の
  // 概要）が載り、公開済みレコードの単位（個別事業）の目的ではない。推進交付金のシートは事業名の次の行が副題か欄の内容か確定しない。
  '07464': none('泉崎村: 補強なし（事業の概要・目的欄は親事業の共通の文で、公開済みレコードの個別事業の目的として対応づけられない）。'),
  '01648': rikubetsu,
  // 電源立地地域対策交付金 事業評価個表（平成30年度）に目的の欄はなく、交付金事業の概要・定性的な成果は公開済みレコードに収録済み。
  // 令和元年度の保育所運営事業は町のお知らせページの一覧の1行だけで、事業の文章がない。
  '01462': none('南富良野町: 補強なし（事業評価個表に目的欄がなく、事業内容・成果は収録済み。令和元年度分は一覧の1行のみ）。'),
  // 平成19年度 事務事業評価表（19-g-01.pdf）は「内容と目的」「現状と結果」「課題と改善」「住民意見」の見出しが先に並び、
  // 欄の文が見出しから離れて続くため、どこまでが内容と目的の欄か確定しない。
  '11381': none('美里町: 補強なし（集落排水処理場日常点検清掃委託の評価表は欄の見出しと文が離れて並び、内容と目的の欄の範囲が確定しない）。'),
  '01345': mori,
  // 電源立地地域対策交付金 事業評価個表（令和6年度）に目的の欄はなく、交付金事業の概要・定性的な成果は公開済みレコードに収録済み。
  '01334': none('木古内町: 補強なし（事業評価個表に目的欄がなく、事業内容・成果は収録済み）。'),
  // 平成29年度 事務事業評価結果一覧は横長の一覧表で、事務事業の概要・評価の根拠・意見の列の文が抽出テキストで行ごとに混ざる。
  '46219': none('いちき串木野市: 補強なし（事務事業評価結果一覧は列の文が行ごとに混ざり、事業の概要を列として取り出せない。目的の列はない）。'),
};
