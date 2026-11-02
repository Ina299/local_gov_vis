import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as himeji } from './m20-himeji';
import { entry as iizuka } from './m20-iizuka';
import { entry as iwanai } from './m20-iwanai';
import { entry as kiyokawa } from './m20-kiyokawa';
import { entry as koga } from './m20-koga';
import { entry as minamata } from './m20-minamata';
import { entry as nakano } from './m20-nakano';
import { entry as shimokawa } from './m20-shimokawa';
import { entry as tobe } from './m20-tobe';
import { entry as tsubame } from './m20-tsubame';
import { entry as yaita } from './m20-yaita';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m20）。 */
export const entries: Record<string, Entry> = {
  // 令和７年度施策及び事務事業評価結果は施策・事業名・所管課・評価・方向性の一覧表と集計だけで、目的・内容の欄がない。
  '46208': none('出水市: 補強なし（評価結果は事業名・所管課・評価・方向性の一覧表で、目的・事業内容の欄がない）。'),
  '09211': yaita,
  '08204': koga,
  '28201': himeji,
  // 令和２年度事務事業評価シート（事業ごとの個票）は「対象」「目的」の見出しと本文が段組みで離れて出力され、版ごとに並びが違う。
  // 見出しの直後に本文が続く版（6件）も、他の版で本文が見出しから離れて出る以上、隣接だけでは目的欄と確定できない。決算額・評価は n2-joso.ts で補強済み。
  '08211': none('常総市: 補強なし（評価シートの対象・目的の本文が見出しと離れて出力され、欄との対応が決まらない）。'),
  // 平成30年度 大学との連携に係る施策の報告書の個票は「事業の概要」「大学提携の目的・効果」の見出しが本文の途中の行に入り、
  // 2つの欄の境目が本文で決まらない（句点で区切れない版がある）。
  '14211': none('秦野市: 補強なし（個票の事業の概要と大学提携の目的・効果の本文が続けて出力され、欄の境目が決まらない）。'),
  '14402': kiyokawa,
  '15213': tsubame,
  // 公開済みレコード（第２次総合計画 中期基本計画 実施計画）は年度を持たず、補強の突き合わせができない。
  '37206': none('さぬき市: 補強なし（公開済みレコードに年度がなく突き合わせできない）。'),
  '13114': nakano,
  '43205': minamata,
  '40205': iizuka,
  '01468': shimokawa,
  '38402': tobe,
  // 令和６年度教育委員会点検・評価報告書は複数の事業の表で、事業名・事業内容・課題・学識経験者の知見の列が行ごとに混ざり、
  // 事業内容の本文がどの事業の行かが並び順でしか決まらない。目的欄はない。
  '06212': none('尾花沢市: 補強なし（点検・評価の表で事業内容の列が他の列・他の事業の行と混ざり、事業との対応が決まらない）。'),
  '01402': iwanai,
};
