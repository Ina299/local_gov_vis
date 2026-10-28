/**
 * 10207 館林市: 総合戦略関連事業の実施計画書・事業評価調書（令和３〜６年度）。公開済みは同年度の事業評価一覧の行
 * （基本目的Ⅰ〜Ⅳは金額なし）なので、同じ事業の調書から当該年度予算額・決算額と評価欄を補強する。
 */
import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { amount, num } from '../batch9/i1-util';

/** sourceId → 令和N年度（資料２／３ 総合戦略関連事業評価一覧表・事業評価調書）。 */
const DOCS: Record<string, number> = { '1749d81c6dd37294a5f9aa32': 3, '6c17467057485fe1e95c0046': 4, '385b1b82ef14dc4f5f1176e5': 5, ade636c277ee9dbb39e01ff4: 6 };

const SCALE_INDICATOR = '指標評価（一覧・調書の表記のまま。Ａ〜Ｄ、―は指標なし等）';
const SCALE_NEED = '高（政策の推進において不可欠な事業である）／中（政策の推進に寄与している事業である）／低（目的をある程度達成し、実施の有無について検討の余地がある）';
const SCALE_EFFECT = '高（成果が高水準にある）／中（適切な成果が得られている）／低（成果が低水準にある）';
const SCALE_EFFICIENCY = '高（費用対効果が高水準にある）／中（適切な費用対効果が得られている）／低（費用対効果が低水準にある）';
const SCALE_DIRECTION = '継続／拡大／改善／代替／統合／縮小／休止／廃止（一部廃止）';
const WIDE = '０１２３４５６７８９';
const N = '[\\d,]+';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '10207' || input.truncated) return [];
  const reiwa = DOCS[input.sourceId];
  if (!reiwa) return [];
  const t = input.text, r = `令和${WIDE[reiwa]}`, year = 2018 + reiwa;
  const plan = `【${r}年度事業】実施計画書`, check = `【${r}年度事業】事業評価調書`;
  const starts = [...t.matchAll(new RegExp(plan, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  // 冒頭の一覧表（同じ資料の整理番号・款項目・事業名の並び）。
  const list = t.slice(0, starts[0] ?? 0).normalize('NFKC');
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length);
    const no = sheet.match(/^【[^】]+】実施計画書\n整理番号\n\n(\d{1,3})\n/)?.[1];
    const ci = sheet.indexOf(check);
    if (!no || ci < 0 || sheet.indexOf(check, ci + 1) >= 0) return;
    const head = sheet.slice(0, sheet.indexOf('【総合計画との関連】'));
    if (head.length <= 0) return;
    // 事業名: 款・項・目の直後の1行（次が空行）。複数行に折り返した名前は確定できないため対象外。
    // 企業会計の事業は款・項・目の代わりに「〇〇事業会計」が印字される。
    const names = [...head.matchAll(/\n\n([０-９\d]{1,2}・[０-９\d]{1,2}・[０-９\d]{1,2}|[^\n]+事業会計)\n\n([^\n]+)\n\n/g)];
    if (names.length !== 1 || /千円|予算|担当|事業名|総合戦略|重要事業|^[^\n]{0,1}$/.test(names[0][2])) return;
    const name = names[0][2];
    // 事業名は冒頭の一覧表に1行として載っているものだけ。分野欄のある様式（令和３年度）は款・項・目の直後が分野名になる
    // 段組み崩れがあるため、一覧表で「款項目＋事業名」が隣接するもの（企業会計は事業名の行）に限る。
    const listed = /事業会計$/.test(names[0][1]) || !head.includes('\n分野\n') ? list.includes(`\n${name}\n`.normalize('NFKC'))
      : list.includes(`\n${names[0][1]}\n\n${name}\n`.normalize('NFKC'));
    if (!listed) return;
    const ni = names[0].index! + names[0][0].indexOf(`\n${name}\n`) + 1;
    const p = project(input, no, name, null, name, s + ni);
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, sheet.match(/^【[^】]+】実施計画書\n整理番号\n\n\d{1,3}/)![0], s));
    p.evidence.push(evidence(input, check, s + ci));
    const planPart = sheet.slice(0, ci), ev = sheet.slice(ci), evStart = s + ci;

    // 予算額: 調書の当該年度予算額が、実施計画書の事業費（当該年度列）と財源5行の当該年度列の合計に一致する場合のみ。
    const budget = ev.match(new RegExp(`${r}年度予算額\\n\\n(${N}) ?千円`));
    const fin = planPart.match(new RegExp(`\\n(${N})\\n\\n${N}\\n\\n${N}\\n\\n国庫\\n\\n(${N})\\n\\n${N}\\n\\n${N}\\n\\n県費\\n\\n(${N})\\n\\n${N}\\n\\n${N}\\n\\n市債\\n\\n(${N})\\n\\n${N}\\n\\n${N}\\n\\nその他\\n\\n(${N})\\n\\n${N}\\n\\n${N}\\n\\n一般財源\\n\\n(${N})\\n`));
    const budgetOk = !!budget && !!fin && num(fin[1]) === num(budget[1]) && [2, 3, 4, 5, 6].reduce((n, i) => n + num(fin[i]), 0) === num(fin[1]);
    if (budget && budgetOk) {
      p.amounts.push(amount(input, 'budget', year, budget[1], '千円', budget[0], evStart + budget.index!));
      // 決算額: 実施計画書の見出しに「決算額（R当該年度）」があり、同じ値が印字されている場合のみ（令和４年度版）。
      const actual = ev.match(new RegExp(`${r}年度決算額\\n\\n(${N}) ?千円`));
      if (actual && head.includes(`決算額（R${reiwa}）`) && new RegExp(`(?:^|\\n)${actual[1]} ?千円\\n`).test(head))
        p.amounts.push(amount(input, 'actual', year, actual[1], '千円', actual[0], evStart + actual.index!));
    }

    const ratings: EvaluationRating[] = [];
    const ind = ev.match(/指標評価\n\n([Ａ-ＤA-D]|―|－|-)\n/);
    if (ind) ratings.push({ kind: 'self', label: '指標評価', value: ind[1], scale: SCALE_INDICATOR, evidence: evidence(input, ind[0].trimEnd(), evStart + ind.index!) });
    const seg = (from: RegExp, to: RegExp, label: string, scale: string) => {
      const a = ev.search(from); if (a < 0) return;
      const rest = ev.slice(a), b = rest.slice(1).search(to); if (b < 0) return;
      const part = rest.slice(0, b + 1), marks = [...part.matchAll(/■ ?(高|中|低)/g)];
      if (marks.length !== 1 || [...part.matchAll(/□ ?(高|中|低)/g)].length !== 2) return;
      ratings.push({ kind: 'self', label, value: marks[0][1], scale, evidence: evidence(input, marks[0][0], evStart + a + marks[0].index!) });
    };
    seg(/事業の\n必要性/, /事業の\n有効性/, '事業の必要性', SCALE_NEED);
    seg(/事業の\n有効性/, /事業の\n効率性/, '事業の有効性', SCALE_EFFECT);
    seg(/事業の\n効率性/, /評価根拠|課題\n/, '事業の効率性', SCALE_EFFICIENCY);
    const dir = ev.match(/([■□]) 継続\n\n([■□]) 拡大\n\n([■□]) 改善\n\n([■□]) 代替\n\n([■□]) 統合\n\n([■□]) 縮小\n\n([■□]) 休止\n\n([■□]) 廃止 （([■□]) 一部廃止）/);
    if (dir) {
      const labels = ['継続', '拡大', '改善', '代替', '統合', '縮小', '休止', '廃止'];
      const on = labels.filter((_, i) => dir[i + 1] === '■');
      if (on.length === 1) ratings.push({ kind: 'self', label: '今後の方向性', value: dir[9] === '■' ? `${on[0]}・一部廃止` : on[0], scale: SCALE_DIRECTION, evidence: evidence(input, dir[0], evStart + dir.index!) });
    }
    p.ratings.push(...ratings);
    if (!p.amounts.length && !p.ratings.length) return;
    p.warnings.push(`館林市 令和${reiwa}年度 総合戦略関連事業の実施計画書・事業評価調書。評価対象年度は見出し【${r}年度事業】による。評価年度（実施年）は資料に明示がないため未設定。`);
    p.warnings.push('予算額は調書の当該年度予算額が実施計画書の事業費（当該年度列）および財源内訳の合計と一致する場合のみ採用。決算額は実施計画書の見出しに同年度の決算額として同じ値が印字されている場合のみ採用。関連する指標の表は列の対応を確定できないため未収録。必要性・有効性・効率性・今後の方向性はチェック（■）が1つだけの場合のみ採用。担当部署は係名まで混在するため未設定。');
    // 再掲で同じ事業の調書が2回載る場合も両方返す（補強側で値が同一のときだけ1件として採用される）。
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '令和３〜６年度 総合戦略関連事業の実施計画書・事業評価調書（当該年度予算額＝実施計画書の事業費・財源合計と一致するもの、令和４年度版は見出しの決算額と一致する決算額、指標評価、必要性・有効性・効率性、今後の方向性）。関連する指標の表、担当部署、冒頭の一覧表（一覧の再掲）は対象外。',
};
