import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as kokubunji } from './y1-kokubunji';
import { entry as kushimoto } from './y1-kushimoto';
import { entry as yasugi } from './y1-yasugi';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 年度の記載がない公開済みレコードの目的・事業内容・成果の補強（同じ資料から作った事業票に限り突き合わせる。2026-11、グループ y1）。 */
export const entries: Record<string, Entry> = {
  // 公開済みレコード（626件）は令和6年度行政評価結果の「施策別事務事業評価結果一覧」の行で、事業名・予算額・改善方向・
  // 改善の視点の○印だけの一覧。事業ごとの目的・内容・成果の欄がない。
  '13108': none('江東区: 補強なし（公開済みレコードの元資料は施策別事務事業評価結果一覧で、事業ごとの目的・内容・成果の欄がない）。'),
  // 施策マネジメントシートの「施策を構成する事務事業」表。目的・概要・成果等の文は抽出テキスト上で事業名・ラベルと離れて
  // 並び（ある事業の行の後に別の事業の目的が出る等）、どの事業の欄か本文で確定しない。
  '07368': none('南会津町: 補強なし（施策マネジメントシートの事務事業表で、目的・概要・成果の文と事業の対応が抽出テキスト上で確定しない）。'),
  '30428': kushimoto,
  '13214': kokubunji,
  '32206': yasugi,
  // 市政だより掲載の事務事業評価結果一覧。事業名・外部評価・最終評価と「今後の市の方針」の文だけで、目的・内容・成果の欄がない。
  '43215': none('天草市: 補強なし（公開済みレコードの元資料は市政だよりの評価結果一覧で、目的・内容・成果の欄がない。今後の市の方針のみ）。'),
};
