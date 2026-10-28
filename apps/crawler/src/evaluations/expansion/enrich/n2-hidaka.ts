import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';

// ---------------------------------------------------------------- 日高市（補強対象なし）
// 公開済みレコード（令和6年度対象）は「令和7年度 行政評価書」の施策別PDF（1kara13.pdf / 7-14-26.pdf）に載る
// 事務事業の一覧表（事務事業名・担当課・経費・評価ランク）から作られており、同じ年度の事業別の評価シートは公開されていない。
// 取得済みの他の行政評価書（1-14.pdf / sisaku14-26.pdf、04_R8sesaku1_13_02.pdf / 05_R8sesaku14_26_2.pdf）も同じ形式の一覧表で、
// 対象年度が異なる（令和5年度・令和7年度対象）ため、公開済みレコードとは突き合わない。よって抽出しない。
export const entry = {
  extract: (_input: CachedInput, _all: CachedInput[]): ProjectEvaluation[] => [],
  scope: '日高市: 補強に使える事業別の評価シートなし（公開済みの元資料は一覧表、他年度版は対象年度が異なる）。',
};
