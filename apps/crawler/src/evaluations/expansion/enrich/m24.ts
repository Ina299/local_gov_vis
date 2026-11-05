import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as asahikawa } from './m24-asahikawa';
import { entry as hitachiomiya } from './m24-hitachiomiya';
import { entry as kakuda } from './m24-kakuda';
import { entry as kitahiroshima } from './m24-kitahiroshima';
import { entry as kunitachi } from './m24-kunitachi';
import { entry as minamishimabara } from './m24-minamishimabara';
import { entry as nishiizu } from './m24-nishiizu';
import { entry as taketomi } from './m24-taketomi';
import { entry as tara } from './m24-tara';
import { entry as yamanashi } from './m24-yamanashi';
import { entry as yaotsu } from './m24-yaotsu';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m24）。 */
export const entries: Record<string, Entry> = {
  '34369': kitahiroshima,
  '04208': kakuda,
  // 沖縄防衛局の調整交付金事業の事後評価書は「補助事業の成果の目標」（成果目標）と、見出しの語が本文の行に混在する成果欄だけで、目的欄がない。
  '47301': none('国頭村: 補強なし（防衛局交付金の事業評価書に目的欄がなく、「成果の目標」は成果目標、成果及び評価の欄は見出しの語が本文の行に混在する）。'),
  '19205': yamanashi,
  '13215': kunitachi,
  '41441': tara,
  '08225': hitachiomiya,
  // 点検・評価報告書の本文は施策の総括と事業名の一覧だけで、巻末の「Ｒ７事務事業点検評価シート」は取得済みの資料に含まれない。
  '01228': none('深川市: 補強なし（取得済みの点検・評価報告書は事業名の一覧と総括だけで、目的欄のある巻末の点検評価シートが含まれない）。'),
  // 議会の常任委員会による「決算に係る事務事業に対する提言」の一覧（事業名・今後の方向性・提言）で、事業の目的・内容の欄がない。
  '34208': none('府中市（広島県）: 補強なし（議会の事務事業に対する提言の一覧で、目的・内容の欄がない）。'),
  '01204': asahikawa,
  // 行政評価推進委員会の外部評価報告書は事業ごとの評価（A〜D）・総評・提案だけで、目的・内容の欄がない。
  '07461': none('西郷村: 補強なし（外部評価報告書は事業ごとの評価・総評・提案だけで、目的・内容の欄がない）。'),
  '21505': yaotsu,
  // 試行の事業評価調書は事業の目的・対象・投入資源・必要性の評価などの欄が抽出テキスト上で行ごとに混在し、欄の本文が確定しない。
  '09208': none('小山市: 補強なし（行政評価（試行）の事業評価調書は目的・対象などの欄が他の欄と行ごとに混在する）。'),
  // 行財政改革推進協議会の会議録（HTML）で、事業ごとには協議会の評価と意見だけが書かれ、目的・内容の欄がない。
  '03402': none('平泉町: 補強なし（行財政改革推進協議会の会議録で、事業ごとの目的・内容の欄がない）。'),
  '42214': minamishimabara,
  '22306': nishiizu,
  // 農山漁村振興交付金の評価シートは第三者の評価（A〜C）と評価理由・助言のコメントだけで、事業の目的・内容の欄がない。
  '01398': none('喜茂別町: 補強なし（農山漁村振興交付金の評価シートは第三者の評価とコメントだけで、目的・内容の欄がない）。'),
  // 教育委員会の点検・評価報告書の各取組は実施状況の箇条だけで（成果として収録済み）、目的の欄がない。
  '11348': none('鳩山町: 補強なし（点検・評価報告書の各取組は実施状況の記述だけで目的欄がなく、その記述は成果として収録済み）。'),
  '47381': taketomi,
  // 地域公共交通確保維持改善事業の事業評価は1行の表で、事業概要・評価の列が行ごとに混在する。目的の欄はない。
  '01461': none('中富良野町: 補強なし（地域公共交通の事業評価表は事業概要・評価の列が行ごとに混在し、目的の欄がない）。'),
};
