import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as adachi } from './m5-adachi';
import { entry as fuji } from './m5-fuji';
import { entry as ishioka } from './m5-ishioka';
import { entry as kawagoe } from './m5-kawagoe';
import { entry as kokubunji } from './m5-kokubunji';
import { entry as kurashiki } from './m5-kurashiki';
import { entry as musashimurayama } from './m5-musashimurayama';
import { entry as tondabayashi } from './m5-tondabayashi';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m5）。 */
export const entries: Record<string, Entry> = {
  // 公開済みレコードは対象事業一覧表・改善事業一覧表の行。「実施目的」の列がある一覧（令和元・2年度の対象事業概要一覧表、
  // 令和3〜7年度の改善事業一覧表）は実施目的・具体的な方法・評価コメントの列の行が交互に並び、列の境が決まらない。
  '10204': none('伊勢崎市: 補強なし（目的の列がある一覧表は、実施目的・具体的方法・評価コメントの列の行が交互に並び、列の境が決まらない）。'),
  '11201': kawagoe,
  '27214': tondabayashi,
  '13121': adachi,
  '08205': ishioka,
  '33202': kurashiki,
  // 公開済みレコードは行政評価結果報告書の「該当する事務事業とその評価・今後の対応」表の行で、目的の欄がない（評価の理由・今後の対応のみ）。
  '10210': none('富岡市: 補強なし（行政評価結果報告書の事務事業の表は今後の方向性・評価の理由・今後の対応だけで、目的・事業内容の欄がない）。'),
  '22210': fuji,
  '13214': kokubunji,
  '13223': musashimurayama,
};
