import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as akashi } from './m0-akashi';
import { entry as fujisawa } from './m0-fujisawa';
import { entry as ichihara } from './m0-ichihara';
import { entry as kamiamakusa } from './m0-kamiamakusa';
import { entry as sakai } from './m0-sakai';
import { entry as tomakomai } from './m0-tomakomai';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m0）。 */
export const entries: Record<string, Entry> = {
  '01213': tomakomai,
  '12219': ichihara,
  '14205': fujisawa,
  '27140': sakai,
  '28203': akashi,
  // 公開済みレコードの大半は内部評価報告書・事務事業評価結果一覧の行（予算事業名・担当課・評価のみ）。取得済み資料で事業ごとの目的・内容の欄を
  // 持つのは平成20・21年度の評価結果一覧（事業概要・活動内容の列が事業名・指標の列と行ごとに混ざる）と外部評価報告書の＜事業の概要＞だけで、
  // 後者（平成25〜28年度の予算事業）は公開済みレコードに事業内容として収録済み（平成30年度以降は施策の取組単位で予算事業と一致しない）。
  '37202': none('丸亀市: 補強なし（目的の欄を持つ資料がない。事業概要の列は他の列と行ごとに混ざり、外部評価の事業の概要は収録済み）。'),
  '43212': kamiamakusa,
  // 公開済みレコードは施策・事務事業評価表の「施策を構成する事務事業」の表の行。事業内容の列は事業名・担当課・金額の列と
  // 行ごとに混ざって出力され（事業名の行の前後に内容の断片が分かれる）、目的の欄はない。施策単位の「目指すこと」は事業の目的ではない。
  '01224': none('千歳市: 補強なし（事務事業は施策評価表の表の行で、事業内容の列が他の列と行ごとに混ざる。事業ごとの目的の欄はない）。'),
  // 行政評価結果（平成28〜30年度）・行政評価（令和6年度）・実施計画は、施策・基本事業・事務事業の列が1行に並ぶ表で、
  // 成果と課題・総合評価の文章が複数の列にまたがって行ごとに混ざる。事務事業ごとの目的・内容の欄はない。
  '03202': none('宮古市: 補強なし（評価結果・実施計画は複数列の文章が行ごとに混ざる表で、事務事業ごとの目的・内容の欄がない）。'),
  // 公開済みレコードは事務事業評価（令和6年度実施事業分）の Excel 版から作られ、「事業概要と成果」欄の全文がすでに事業内容にある。
  // 欄内に「○目的：」の見出しがあるのは2事業だけで、どちらも目的は公開済み。取得済みのPDF版は4事業が1ページに横並びで、本文と事業名の対応が並び順でしか決まらない。
  '14206': none('小田原市: 補強なし（事業概要と成果の全文は公開済みの事業内容にあり、目的の見出しがある2事業は目的も公開済み。PDF版は事業との対応が並び順のみ）。'),
};
