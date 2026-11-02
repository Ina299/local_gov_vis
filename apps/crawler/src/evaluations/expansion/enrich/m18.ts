import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as kuji } from './m18-kuji';
import { entry as minami } from './m18-minami';
import { entry as tsurugi } from './m18-tsurugi';
import { entry as kaiyo } from './m18-kaiyo';
import { entry as yufu } from './m18-yufu';
import { entry as awashimaura } from './m18-awashimaura';
import { entry as fukushima } from './m18-fukushima';
import { entry as uruma } from './m18-uruma';
import { entry as setagaya } from './m18-setagaya';
import { entry as higashiosaka } from './m18-higashiosaka';
import { entry as saikai } from './m18-saikai';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m18）。 */
export const entries: Record<string, Entry> = {
  '03207': kuji,
  '36387': minami,
  // 公開済みレコードは令和4年度実績の行政評価シート（第2次総合振興計画事業管理シート）の事業。目的の欄はなく、「事業内容」欄の文は
  // 事業開始年度・事業見直し年度の欄の語と1行ずつ交互に並ぶ。外部評価報告書（2事業）は評価の意見だけで目的の欄がない。
  '11214': none('春日部市: 補強なし（行政評価シートは目的の欄がなく、事業内容欄の文が事業開始年度・見直し年度の欄と交互に並ぶ。外部評価報告書は意見だけ）。'),
  '36468': tsurugi,
  '36388': kaiyo,
  // 公開済みレコードは令和7年度施策評価シートの「主要事業の状況」の事業。目的の欄はなく、取組内容の文は指標表（指標名・区分・単位・目標・実績）の
  // 列と同じ行に並ぶ。
  '08208': none('龍ケ崎市: 補強なし（施策評価シートの主要事業は取組内容と指標だけで目的の欄がなく、取組内容の文が指標表の列と同じ行に並ぶ）。'),
  '44213': yufu,
  // 公開済みレコードは事務事業マネジメントシート（平成27〜令和7年度版）の事業。手段・対象・意図・結果の欄の見出しが内容から離れてまとめて並び、
  // 内容の順序も見出しと一致しない（結果の文が意図の文より先に出るシートがある）。平成29・30年度版は字形の欠落で見出しの語が読めない。
  '01637': none('芽室町: 補強なし（事務事業マネジメントシートの手段・意図などの見出しが内容から離れてまとめて並び、内容の順序も一致しないため欄の境が決まらない）。'),
  '15586': awashimaura,
  '01332': fukushima,
  // 公開済みレコードは第1次政策実行計画事業（令和6年度）の事業概要及び自己評価シートの事業（事業概要・事業効果は収録済み）。
  // 目的の欄はなく、「現状（課題・ニーズ）」欄の文は縦書きの見出し「事業の概要」の字と同じ行に並ぶ。
  '12233': none('富里市: 補強なし（事業概要及び自己評価シートは目的の欄がなく、事業概要・事業効果は公開済み。現状（課題・ニーズ）欄は縦書き見出しの字が行頭に混ざる）。'),
  '47213': uruma,
  // 公開済みレコードは令和4年度教育委員会事務事業点検評価報告書の一覧表の行。事業内容・考察・実績の列の文が同じ行に並び、目的の欄もない。
  '02303': none('今別町: 補強なし（点検評価報告書は一覧表で目的の欄がなく、考察・実績の列の文が同じ行に並ぶ）。'),
  '13112': setagaya,
  '27227': higashiosaka,
  '42212': saikai,
  // 公開済みレコードは施策評価シートの個別評価（事業名・事業評価・予算額・決算額）の行。事業ごとの欄は事業評価の文だけで目的の欄がなく、
  // 評価の文も事業CD・事業名・担当課の欄と交互に並ぶ。
  '14362': none('大井町: 補強なし（施策評価シートの個別評価は事業評価の文だけで目的の欄がなく、文が事業CD・事業名・担当課の欄と交互に並ぶ）。'),
};
