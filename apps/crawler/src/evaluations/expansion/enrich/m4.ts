import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entry as osaki } from './m4-osaki';
import { entry as ashibetsu } from './m4-ashibetsu';
import { entry as ofunato } from './m4-ofunato';
import { entry as kawaguchi } from './m4-kawaguchi';
import { entry as niiza } from './m4-niiza';
import { entry as biei } from './m4-biei';
import { entry as hita } from './m4-hita';
import { entry as bungoono } from './m4-bungoono';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const none = (scope: string): Entry => ({ extract: () => [], scope });

/** 既存レコードの目的・事業内容・成果の補強用の評価シート抽出（2026-11、グループ m4）。 */
export const entries: Record<string, Entry> = {
  '04215': osaki,
  '01216': ashibetsu,
  '03203': ofunato,
  '11203': kawaguchi,
  // 公開済みレコード（令和7年度 事務事業評価一覧）は評価年度・対象年度とも未設定で、補強の照合（同じ年度）ができない。
  // 一覧の「事業内容」は事業名・担当課・方向性と同じ行に段組みで並び、折り返した行が前後の事業と混ざる。
  '35206': none('防府市: 補強なし（公開済みレコードに年度がなく照合できない。一覧表の事業内容も段組みで前後の行と混ざる）。'),
  '11230': niiza,
  '01459': biei,
  '44204': hita,
  // 公開済みレコードは施策評価シートの「施策内の事務事業一覧」の行（事業名・所管課・事業費・方向性・評価）で、事業ごとの目的・内容の欄がない。
  // 「主要事務事業の実施結果」は数事業だけで、本文と方向性の列が行ごとに混ざり、事業との対応が並び順でしか決まらない。
  '29206': none('桜井市: 補強なし（事務事業一覧の行に目的・内容の欄がなく、主要事務事業の実施結果は列が混ざり事業との対応が確定しない）。'),
  '44212': bungoono,
};
