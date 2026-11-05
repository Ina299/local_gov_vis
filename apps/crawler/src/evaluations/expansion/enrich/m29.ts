import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as hashikami } from './m29-hashikami';
import { entry as okushiri } from './m29-okushiri';
import { entry as sai } from './m29-sai';
import { entry as nerima } from './m29-nerima';
import { entry as aikawa } from './m29-aikawa';
import { entry as chikusei } from './m29-chikusei';
import { entry as taku } from './m29-taku';
import { entry as shintomi } from './m29-shintomi';
import { entry as mibu } from './m29-mibu';
import { entry as iheya } from './m29-iheya';
import { entry as toshima } from './m29-toshima';
import { entry as wajima } from './m29-wajima';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m29）。 */
export const entries: Record<string, Entry> = {
  '02446': hashikami,
  '01367': okushiri,
  // 事業仕分けの結果ページ（事業名と判定結果の一覧）だけで、事業ごとの目的・内容の欄がない。
  '12205': none('館山市: 補強なし（取得済みは事業仕分けの評価結果一覧のHTMLだけで、目的・事業内容の欄がない）。'),
  '02426': sai,
  // リアルタイム事務事業評価調書は多段組みで、「事業の目的」「主な取組み」の欄に他の欄の番号つき行が混ざって出力され、欄との対応が本文で確定しない。
  '13220': none('東大和市: 補強なし（リアルタイム事務事業評価調書は段組みが崩れ、事業の目的・主な取組みの欄に他の欄の行が混ざる）。'),
  '13120': nerima,
  // 公開済みレコードは点検評価報告書の各項目の「取組内容」に並ぶ個別事業。目標・実行内容は項目全体の記述で、個別事業の目的の欄はない。
  '18201': none('福井市: 補強なし（教育委員会点検評価報告書の目標・実行内容は施策項目単位で、個別事業ごとの目的の欄がない）。'),
  '14401': aikawa,
  '08227': chikusei,
  '41204': taku,
  // 公開済みレコードは点検・評価報告書の観点別評価の表の事業名。事業ごとの目的・内容の欄はなく、外部評価委員の意見と事務局説明だけ。
  '46204': none('枕崎市: 補強なし（教育委員会活動の点検・評価報告書は観点別評価と外部評価委員の意見・事務局説明だけで、目的・事業内容の欄がない）。'),
  '45402': shintomi,
  // 総合戦略の基本目標ごとの公表資料（施策・事業名の列挙、数値目標・KPI、村のコメント）で、事業ごとの目的・内容の欄がない。
  '16321': none('舟橋村: 補強なし（行政評価公表資料は総合戦略の基本目標単位で、事業ごとの目的・事業内容の欄がない）。'),
  '09361': mibu,
  // 総合戦略の施策パッケージの表で、「事業概要・取組内容」欄に事業区分の列（継続・R4-R8 等）が行の途中に混ざって出力されるため取らない。
  '02361': none('藤崎町: 補強なし（施策パッケージの事業概要・取組内容の欄に事業区分の列が混ざり、欄の本文が確定しない）。'),
  '47359': iheya,
  // デジタル田園都市国家構想推進交付金の事業実施報告書は推進体制・導入サービス・KPIごとの記述で、事業の目的・内容の欄がない。
  '33681': none('吉備中央町: 補強なし（デジタル実装タイプの事業実施報告書は推進体制・KPIごとの記述だけで、目的・事業内容の欄がない）。'),
  '46304': toshima,
  // 公開済みレコードの事業内容・成果は同じページの「事業概要」「評価」で既に埋まっている。事業概要は国の補助事業の目的の説明で、町の事業の目的の欄はない。
  '17461': none('穴水町: 補強なし（中間評価結果のページに目的の欄はなく、事業概要・評価は公開済みレコードに収録済み）。'),
  '17204': wajima,
};
