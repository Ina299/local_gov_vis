import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as kanda } from './m2-kanda';
import { entry as niihama } from './m2-niihama';
import { entry as nishinomiya } from './m2-nishinomiya';
import { entry as ooki } from './m2-ooki';
import { entry as saitama } from './m2-saitama';
import { entry as shimotsuma } from './m2-shimotsuma';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m2）。 */
export const entries: Record<string, Entry> = {
  // 令和8年度事業評価書（様式1）には目的の欄がなく、事業概要（公開済みの事業内容）と事業決算額・細事業の分析だけ。
  // 細事業の事業実績は選択肢の段組みで、成果として読める文章の欄もない。
  '14100': none('横浜市: 補強なし（事業評価書に目的・成果の欄がなく、事業概要は公開済み）。'),
  '11100': saitama,
  '28204': nishinomiya,
  // 公開済みレコードの大半（令和7年度評価結果一覧表）は手段・意図・評価コメントの列が同じ行に交互に並び、欄の対応が確定しない。
  // 1事業1枚の事務事業評価表（20件）は意図・成果・手段の欄の行頭に縦書きの見出しの文字（「事 意 図」など）が混ざる。
  '35215': none('周南市: 補強なし（一覧表は手段・意図の列が行内で交互に混ざり、評価表は意図の欄の行頭に見出しの文字が混ざる）。'),
  '40621': kanda,
  '08210': shimotsuma,
  '38205': niihama,
  // 公開済みレコードは施策評価シートの「事務事業の検討」の表の行。事業概要・コメントの列が事業費の数値と同じ行に交互に並び、
  // 欄の対応が確定しない。事務事業ごとの評価シートは取得していない。
  '11224': none('戸田市: 補強なし（施策評価シートの事務事業の表は概要・コメントの列が数値と行内で混ざり、欄の対応が確定しない）。'),
  '40522': ooki,
};
