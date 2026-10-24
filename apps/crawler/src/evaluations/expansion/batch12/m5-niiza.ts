import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, num, rating } from '../batch8/h6-util';
import { type Entry, groupAt, municipal } from './m5-util';

/* ---------- 11230 新座市 第５次総合計画実施計画 事務事業評価シート（対象：令和６年度実施事業） ---------- */

const SHEET = '第５次新座市総合計画実施計画 事務事業評価シート\n（対象：令和６年度実施事業）\n';
const CHECK: [string, string, RegExp][] = [
  ['事業の実施状況', 'Ａ：計画以上に実施／Ｂ：計画どおりに実施／Ｃ：計画どおりに実施できず', /^[ＡＢＣ]$/],
  ['事業の必要性【市民ニーズ】', 'Ａ：高まっている／Ｂ：変わらない／Ｃ：薄れている', /^[ＡＢＣ]$/],
  ['事業の効率性【見直す余地】', 'Ａ：余地はない／Ｂ：余地はある', /^[ＡＢ]$/],
  ['施策への貢献度', 'Ａ：貢献している／Ｂ：やや貢献している／Ｃ：貢献の度合いが低い', /^[ＡＢＣ]$/],
];
const DIRECTION = 'Ⅰ：事業規模拡大／Ⅱ：改善しながら継続／Ⅲ：現状のまま継続／Ⅳ：事業規模縮小／Ⅴ：事業廃止／Ⅵ：事業終了';

function niiza(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(SHEET)) return [];
  const starts = [...t.matchAll(new RegExp(SHEET, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const sheet = t.slice(s, starts[i + 1] ?? t.length);
    const n = /\n事業\n\n([^\n]+)\n\n所属\n\n([^\n]+)\n/d.exec(sheet);
    if (!n) return;
    const name = n[1].trim();
    const p = project(input, name, name, null, n[1], groupAt(n, 1, s));
    p.projectCode = null; p.evaluatedFiscalYear = 2024; p.department = n[2].trim();
    p.evidence.push(evidence(input, SHEET.trimEnd(), s), evidence(input, n[2], groupAt(n, 2, s)));
    const notes: string[] = [];

    // 予算・決算（円）: 令和５・６年度の2列（列見出し「令和５年度」はシート末尾に分かれて抽出され、令和６・７年度の見出しは右側の空欄列のもの）。「財源内訳」から「執行率」までの数値が 予算現額・財源内訳（一般財源・特定財源等）・支出済額・不用額 の順に
    // 各2列並び、予算現額＝一般財源＋特定財源等、予算現額＝支出済額＋不用額 が両列で成り立ち、支出済額・不用額の値がそれぞれの見出しより後にある場合だけ。
    const from = sheet.indexOf('\n財源内訳\n'), to = sheet.indexOf('\n執行率（％）\n');
    const block = from > 0 && to > from ? sheet.slice(from, to) : '';
    const nums = [...block.matchAll(/\n([\d,]+)(?=\n)/g)].map(m => ({ raw: m[1], rel: m.index! + 1, at: s + from + m.index! + 1 }));
    const v = nums.map(x => num(x.raw));
    if (nums.length === 10 && v[0] === v[2] + v[4] && v[1] === v[3] + v[5] && v[0] === v[6] + v[8] && v[1] === v[7] + v[9]
      && block.indexOf('支出済額（円）') < nums[6].rel && block.indexOf('不用額（円）') < nums[8].rel && block.indexOf('支出済額（円）') > nums[5].rel) {
      ([[0, 6, 2023], [1, 7, 2024]] as const).forEach(([bud, act, year]) => p.amounts.push(
        amount(input, 'budget', year, nums[bud].raw, '円', nums[bud].raw, nums[bud].at), amount(input, 'actual', year, nums[act].raw, '円', nums[act].raw, nums[act].at)));
      notes.push('予算・決算は令和５・６年度の予算現額（予算）・支出済額（決算）を記録（財源内訳の合計と支出済額＋不用額が予算現額に一致する表のみ）。2列は左から令和５年度・令和６年度（「令和５年度」の列見出しと予算現額の行見出しはシート末尾に分かれて抽出される）。');
    } else notes.push('予算・決算の表は列の対応が確定できないため未収録。');

    // 事業評価（Check）: シート末尾に4項目の記号が項目順に並ぶ場合だけ（効率性はＡ・Ｂの2区分）。
    const tail = /\n\n([ＡＢＣ])\n([ＡＢＣ])\n([ＡＢＣ])\n([ＡＢＣ])\n*$/d.exec(sheet);
    if (tail && CHECK.every(([, , ok], k) => ok.test(tail[k + 1]))) {
      CHECK.forEach(([label, scale], k) => p.ratings.push(rating(input, 'self', label, tail[k + 1], scale, tail[k + 1], groupAt(tail, k + 1, s))));
    } else notes.push('事業評価（Check）の記号は項目との対応が確定できないため未収録。');
    const dir = /\n\n(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ)\n\nⅠ：事業規模拡大\n/d.exec(sheet);
    if (dir) p.ratings.push(rating(input, 'self', '今後の方向性', dir[1], DIRECTION, dir[1], groupAt(dir, 1, s)));
    p.warnings.push('新座市 第５次総合計画実施計画 事務事業評価シート（対象：令和６年度実施事業）。評価実施年度は令和７年度の内部評価だが、シートには明示がないため未設定。',
      `${notes.join('')}事業評価の4項目はシート末尾に項目順（実施状況・必要性・効率性・施策への貢献度）で並ぶ記号として記録。活動指標・成果指標は単位・年度の列が崩れているため未収録。`);
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '11230': { extract: municipal('11230', niiza), scope: '新座市 第５次総合計画実施計画 事務事業評価シート（対象：令和６年度実施事業、施策別ファイルと一括版）の事業名・所属・検算できる令和５・６年度の予算現額/支出済額・事業評価4項目・今後の方向性。指標・施策評価シート・内部評価報告書・外部評価対応方針・行財政改革実施計画は対象外。' },
};
