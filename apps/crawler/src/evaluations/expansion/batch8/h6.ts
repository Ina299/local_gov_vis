import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as a } from './h6-a';
import { entries as b } from './h6-b';
import { entries as c } from './h6-c';

/**
 * 第8バッチ h6 担当分。対象外: 22344 小山町（社会資本総合整備計画の事後評価＝計画単位と道路事業の再評価のみ）、
 * 07543 富岡町（復興計画の施策単位の評価）、01393 黒松内町（国交省の個別公共事業評価書）、01638 中札内村（政策・施策評価）、
 * 02425 風間浦村（公表案内ページのみ）、26210 八幡市（主要施策の成果報告書）、29386 御杖村（総合計画・総合戦略の効果検証）、
 * 35212 柳井市（行政改革大綱の実績報告）、40402 鞍手町（広報誌の段組みで年度・列の対応が確定できない）、
 * 46452 湧水町と 06323 朝日町の交付金実施報告（列の対応が確定できない）、22429 川根本町（事業ごとの取組状況の文章のみで評価票の様式ではない）。
 */
export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  ...a, ...b, ...c,
};
