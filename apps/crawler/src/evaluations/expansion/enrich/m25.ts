import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as eniwa } from './m25-eniwa';
import { entry as ishikawa } from './m25-ishikawa';
import { entry as kumakogen } from './m25-kumakogen';
import { entry as makkari } from './m25-makkari';
import { entry as masuda } from './m25-masuda';
import { entry as nishimeya } from './m25-nishimeya';
import { entry as nishiwaki } from './m25-nishiwaki';
import { entry as nosegawa } from './m25-nosegawa';
import { entry as ono } from './m25-ono';
import { entry as sumita } from './m25-sumita';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m25）。 */
export const entries: Record<string, Entry> = {
  '38386': kumakogen,
  '07501': ishikawa,
  // 事業実施評価調書は事業名・KPI・実績額・評価・有識者意見の列が行ごとに混在し、目的の欄もない。
  '33622': none('勝央町: 補強なし（総合戦略の事業実施評価調書は列が行ごとに混在し、目的の欄がない）。'),
  '32204': masuda,
  '01396': makkari,
  // 電源立地地域対策交付金の事業評価個表は目的の欄がなく、概要・定性的な成果の欄には隣の欄の見出し（「標及び成果実績」など）が
  // 本文の行に入り込む。山村活性化対策の評価結果は総評のみ。
  '01343': none('鹿部町: 補強なし（交付金の事業評価個表に目的の欄がなく、概要・成果の欄は隣の欄の見出しが本文の行に混在する）。'),
  // 点検評価報告書は外部評価委員の事業ごとの所見（「…を評価します」）だけで、目的・内容の欄がない。
  '07521': none('三春町: 補強なし（取得済み資料は教育委員会点検評価の外部委員の所見のみで、目的の欄がない）。'),
  // 事務事業評価シートの「目的」欄は縦書きの見出し（目／的）が離れた位置に出て、本文が指標・予算科目の表の値と行ごとに混在する。
  '01233': none('伊達市（北海道）: 補強なし（事務事業評価シートの目的欄の本文が指標・予算科目の表と行ごとに混在し、欄の範囲が確定しない）。'),
  '28218': ono,
  // 取得済み資料は外部評価の結果（事業名・委員の評価人数）を並べたウェブページだけで、事業ごとの目的・内容の欄がない。
  '15205': none('柏崎市: 補強なし（取得済み資料は外部評価結果の一覧ページで、事業ごとの目的・内容の欄がない）。'),
  '03441': sumita,
  // 外部評価委員会報告書は事業ごとの総括コメント（委員会の指摘）と評価結果だけで、目的・内容の欄がない。
  '07208': none('喜多方市: 補強なし（外部評価委員会報告書は事業ごとの総括コメントと評価結果のみで、目的・内容の欄がない）。'),
  // 政策分析報告書は分野別計画（政策）ごとの取り組み状況の文章で、公開済みレコードの事業はその文中に名前が出るだけ。
  '23201': none('豊橋市: 補強なし（政策分析報告書は政策単位の文章で、事業ごとの目的の欄がない）。'),
  // 総合戦略の効果検証表は事業名・事業内容・KPI・事業費・評価の列が行ごとに混在する。
  '08223': none('潮来市: 補強なし（総合戦略の効果検証表は事業内容・KPI・事業費の列が行ごとに混在し、目的の欄もない）。'),
  '28213': nishiwaki,
  '29447': nosegawa,
  '01231': eniwa,
  // 事業の休止・廃止の一覧（理由の列が事業名・所管の列と行ごとに混在）で、目的の欄がない。
  '14301': none('葉山町: 補強なし（取得済み資料は事業の休止・廃止の一覧で、目的の欄がなく理由の列も他の列と混在する）。'),
  // 地域公共交通確保維持改善事業の事業評価は事業概要・目標・効果などの列が行ごとに混在する。
  '38207': none('大洲市: 補強なし（地域公共交通の事業評価表は事業概要・目標・効果の列が行ごとに混在する）。'),
  '02343': nishimeya,
};
