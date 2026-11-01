import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as koshigaya } from './m3-koshigaya';
import { entry as minato } from './m3-minato';
import { entry as nankoku } from './m3-nankoku';
import { entry as shinagawa } from './m3-shinagawa';
import { entry as sumida } from './m3-sumida';
import { entry as tatebayashi } from './m3-tatebayashi';
import { entry as yoshikawa } from './m3-yoshikawa';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m3）。 */
export const entries: Record<string, Entry> = {
  '13109': shinagawa,
  '39204': nankoku,
  '10207': tatebayashi,
  '13107': sumida,
  '13103': minato,
  '11222': koshigaya,
  '11243': yoshikawa,
  // 公開済みレコードはすべて評価年度・評価対象年度が未設定（資料に年度の明記がない）で、補強の照合（同じ既知の年度）ができない。
  '13108': none('江東区: 補強なし（公開済みレコードに年度がなく、同じ年度の評価シートとして照合できない）。'),
  // 公開用シートは「事業の概要」と「今後の取組方針」、「成果・取組み」と「評価」が同じ行に並んで出力され、欄の区切りが本文で確定しない。
  // 保存テキストも12万字で切れており、総括表以外は冒頭の一部の票しかない。
  '10209': none('藤岡市: 補強なし（公表用シートは2つの欄が同じ行に混在して出力され、目的・概要・成果の区切りが確定しない）。'),
  // 教育委員会の点検・評価報告書。事業ごとの文章は内部評価の所見（実施内容・成果・今後の方針が混在）だけで、目的・事業内容・成果の欄がない。
  '38213': none('四国中央市: 補強なし（点検・評価報告書の事業ごとの文章は内部評価の所見のみで、目的・事業内容・成果の欄がない）。'),
};
