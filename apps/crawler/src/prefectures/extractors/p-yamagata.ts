/**
 * 山形県「事業評価個票（事業実施：令和７年度）」（1事業1PDF、様式１）。
 * 事業名・部局・担当課名・開始/終了年度と、当初予算額の令和７年度の計（千円）を読む。
 * 当初予算額・財源内訳の表は段組みで値の並びが崩れるため、次の検算が通る場合だけ令和７年度の計を収録する:
 *   「計」欄の最初の値 T（令和７年度列）が抽出テキストに2回以上（当初予算額の計と財源内訳の計）現れ、かつ
 *   「一般財源」欄の最初の値 G について G＝T か、T−G が別の値として印字されている（特定財源との和が計に一致）。
 * 令和８年度以降の列は事業開始時の見込みの額なので収録しない。決算額は様式に無い。「事業評価個票の見方」は対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const N = String.raw`[0-9０-９]{1,3}(?:[,，][0-9０-９]{3})*`;
const HEAD = /^事業評価個票（事業実施：令和([０-９0-9]+)年度）\n事業名\n\n(?:（様式１）\n\n)?([^\n]+)\n/;
const reiwa = (s: string) => 2018 + num(s);

function extract(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const h = HEAD.exec(t);
  if (!h || t.startsWith('【')) return [];
  const fy = reiwa(h[1]);
  // 事業名の行に「開始/終了(予定)年度 令和７ / 令和９」が続けて出力される個票がある
  const name = h[2].replace(/ 開始\/終了\(予定\)年度 .*$/, '').trim();
  if (!/(?:事業費|事業)$/.test(name)) return [];
  const p = project(input, nfkc(name), name, null, h[0].trimEnd(), 0);
  p.evaluatedFiscalYear = fy;
  const dept = /\n部局・担当課名 ?([^\n]+)\n/.exec(t);
  if (dept && /(?:部|局|本部)/.test(dept[1]) && /(?:課|室)$/.test(dept[1])) {
    p.department = dept[1].trim();
    p.evidence.push(evidence(input, dept[0].trim(), dept.index + 1));
  } else p.warnings.push('部局・担当課名の欄が抽出テキストで確定しないため未収録。');

  const span = /開始\/終了\(予定\)年度(?:\n\n| )令和([０-９0-9元]+) \//.exec(t);
  const kei = new RegExp(String.raw`(?<=\n)計\n\n(${N})\n`, 'g');
  const tokens = [...t.matchAll(new RegExp(String.raw`(?<=\n)(${N})(?=\n)`, 'g'))].map(m => num(m[1]));
  const gen = new RegExp(String.raw`(?<=\n)一般財源\n\n(${N})\n`).exec(t);
  let recorded = false;
  if (span && reiwa(span[1] === '元' ? '1' : span[1]) <= fy && gen) {
    const g = num(gen[1]);
    for (const m of t.matchAll(kei)) {
      const v = num(m[1]);
      if (v <= 0 || tokens.filter(x => x === v).length < 2) continue;
      if (!(g === v || (g < v && tokens.includes(v - g)))) continue;
      p.amounts.push(amount(input, 'budget', fy, m[1], '千円', m[0].trimEnd(), m.index!));
      p.evidence.push(evidence(input, span[0], span.index), evidence(input, gen[0].trimEnd(), gen.index!));
      p.warnings.push(`当初予算額は「計」欄の最初の値（令和${h[1]}年度列）。財源内訳の計と同じ値が2回以上印字され、一般財源（${gen[1]}千円）と特定財源の和が一致することを確認。令和８年度以降の列（見込み）は未収録。`);
      recorded = true;
      break;
    }
  }
  if (!recorded) p.warnings.push('当初予算額・財源内訳の表の値の並びが抽出テキストで崩れており、計の値を検算で確定できないため金額は未収録。');
  p.warnings.push('事業評価個票（事業実施：令和７年度）。評価年月は様式に空欄のため評価年度は未設定。');
  return [p];
}

export const entries: Record<string, Entry> = {
  '06000': {
    scope: '事業評価個票（事業実施：令和７年度、1事業1PDF）の事業名・部局・担当課名・当初予算額の令和７年度計（財源内訳との検算が通るもののみ）。活動指標・成果指標、令和８年度以降の見込額、事業評価個票の見方は対象外。',
    extract,
  },
};
