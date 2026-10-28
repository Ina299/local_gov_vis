import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 丸亀市 平成19年度 事務事業評価結果一覧（3392.pdf）
// 公開済みレコードは施策評価結果一覧（3391.pdf）の事業名と方向性だけで、所管課がない。この一覧の行から所管課と２次評価を補う。
// 金額（計画事業費・18年度決算額）は単位が本文に明記されず検算もできないため収録しない。
const SOURCE = 'a5eebc167980906e5d018b5d';
const TITLE = '平成19年度 事務事業評価結果一覧（平成18年度事業、平成19年度新規事業）';
// 1行に「番号 事業名 取組内容 計画事業費 18年度決算額 (方向) 所管課 ２次評価」がそろう行だけ。事業名が折り返された行は一致しない。
const ROW = /(?:^|\n)(?:\S+ )?(\d{1,3}) (\S+?)(?:＜H19新規＞)? .*? (?:[\d,]+|-) (?:[\d,]+|-) (?:(?:継続|拡大|縮小|休止|廃止|完了) )?(\S+) (妥当|再検討)(?= |\n)/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37202' || input.sourceId !== SOURCE || input.truncated) return [];
  const t = input.text, titleAt = t.indexOf(TITLE);
  if (titleAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(ROW)) {
    const start = m.index! + (m[0].startsWith('\n') ? 1 : 0), raw = m[0].replace(/^\n/, '');
    const [, no, name, department, opinion] = m;
    if (!/(課|室|局|館|所|センター)$/.test(department)) continue;
    const p = project(input, `補強:${no}`, name, 2007, raw, start);
    p.projectCode = no;
    p.department = department;
    p.evidence.push(evidence(input, TITLE, titleAt));
    p.ratings.push({ kind: 'self', label: '２次評価（1次評価による事業の方向性について）', value: opinion, scale: '妥当／再検討', evidence: evidence(input, raw, start) });
    p.warnings.push('平成19年度 事務事業評価結果一覧の行から所管課と２次評価（1次評価による事業の方向性についての意見）を補強。番号・事業名・取組内容・金額2列・所管課・２次評価が1行にそろう行のみ。金額は単位が本文に明記されないため未収録。');
    out.push(p);
  }
  return out;
}

export const marugame = {
  extract,
  scope: '丸亀市 平成19年度 事務事業評価結果一覧（平成18年度事業、平成19年度新規事業）の所管課と２次評価。1行に列がそろう行のみ。公開済みレコード（施策評価結果一覧の事業）の補強用。',
};
