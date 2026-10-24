import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, eraYear, num, rating } from '../batch8/h6-util';
import { type Entry, groupAt, municipal } from './m5-util';

/* ---------- 11225 入間市 令和2年度 事務事業評価シート（令和1年度分）〔一般・公共事業用〕 ---------- */

const TITLE = /^令和 ?([0-9０-９]+)年度 事務事業評価シート(〔公共事業用〕)? \(令和 ?([0-9０-９元]+)年度分\)\n/;
const NAME = [/\n事務事業名\n\n([^\n]+)\n\n総 合 計 画\n/d, /\n事務事業名\n総 合 計 画\n基 本 計 画\n\n([^\n]+)\n施策の大網/d];
const SCALE: Record<string, string> = {
  必要性: '必要不可欠／高い／普通／やや低い／低い', 有効性: '大変有効である／有効である／普通／あまり有効でない／有効でない',
  効率性: '向上／やや向上／変わらない／やや悪化／悪化', 今後の方向性: '充実／継続／縮小／廃止・休止／完了・終了',
  改善の評価: '改善できた／やや改善できた／改善できなかった', 取り組みに対する評価: '対応できた／やや対応できた／対応できなかった',
};
/** 選択肢が連続して並ぶチェック欄（■ がちょうど1つのときだけ採用）。 */
const GROUPS: [string, RegExp][] = [
  ['効率性', /[□■] 向上\n[□■] やや向上\n[□■] 変わらない\n[□■] やや悪化\n[□■] 悪化\n/g],
  ['今後の方向性', /[□■] 充実\n[□■] 継続\n[□■] 縮小\n[□■] 廃止・休止\n[□■] 完了・終了\n/g],
  ['改善の評価', /[□■] 改善できた\n[□■] やや改善できた\n[□■] 改善できなかった\n/g],
  ['取り組みに対する評価', /[□■] 対応できた\n[□■] やや対応できた\n[□■] 対応できなかった\n/g],
];

function sheet(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const ey = eraYear('令和', title[1]), fy = eraYear('令和', title[3]);
  const nm = NAME.map(r => r.exec(t)).find(Boolean);
  const code = /\n整理番号\n\n(\d{6}-\d{2}-\d{2})\n/d.exec(t);
  if (!nm || !code || ey === null || fy === null) return [];
  const name = nm[1].trim();
  const p = project(input, code[1], name, ey, name, groupAt(nm, 1));
  p.evaluatedFiscalYear = fy;
  p.evidence.push(evidence(input, title[0].trimEnd(), 0), evidence(input, code[1], groupAt(code, 1)));
  const dept = /\n担当部課\n\n([^\n]+)\n\n電話番号\n/d.exec(t);
  if (dept) { p.department = dept[1].trim(); p.evidence.push(evidence(input, dept[1], groupAt(dept, 1))); }

  // 1次評価のチェック欄。必要性・有効性は選択肢が交互に並ぶため、「普通」は直前の選択肢で帰属を決める。
  const first = t.indexOf('◆１次評価'), second = t.indexOf('◆２次評価');
  const notes: string[] = [];
  if (first > 0) {
    for (const [label, re] of GROUPS) {
      const found = [...t.matchAll(re)].filter(m => m.index! > first);
      // 2次評価の方向性欄は「完了・終了」を持たないため、5択の欄は1次評価のもの。
      const one = found.length === 1 && (found[0][0].match(/■/g) ?? []).length === 1 ? found[0] : null;
      if (!one) continue;
      const v = /■ ([^\n]+)\n/.exec(one[0])!;
      p.ratings.push(rating(input, 'self', `1次評価 ${label}`, v[1], SCALE[label], v[0].trimEnd(), one.index! + v.index));
    }
    const block = t.slice(first, second > first ? second : t.length);
    const pick = (opts: string[], normalAfter: RegExp) => {
      const hits = opts.flatMap(o => [...block.matchAll(new RegExp(`■ ${o}\\n`, 'g'))].map(m => ({ v: o, i: m.index! })));
      const n = normalAfter.exec(block);
      if (n && n[1] === '■') hits.push({ v: '普通', i: n.index! + n[0].lastIndexOf('■ 普通') });
      return hits.length === 1 ? hits[0] : null;
    };
    const normals = [...block.matchAll(/■ 普通\n/g)].length;
    const nec = pick(['必要不可欠', '高い', 'やや低い', '低い'], /[□■] 高い\n([□■]) 普通\n/);
    const eff = pick(['大変有効である', '有効である', 'あまり有効でない', '有効でない'], /[□■] 有効である\n([□■]) 普通\n/);
    // ■ 普通 が二つの欄のどちらにも帰属できない並びは採用しない。
    const owned = [nec, eff].filter(h => h?.v === '普通').length;
    if (normals === owned) {
      for (const [label, h] of [['必要性', nec], ['有効性', eff]] as const) if (h)
        p.ratings.push(rating(input, 'self', `1次評価 ${label}`, h.v, SCALE[label], `■ ${h.v}`, first + h.i));
    } else notes.push('必要性・有効性の「普通」の帰属が並びから確定できないため未収録。');
  }

  // 事業費: ③＝①＋② が成り立つ列だけ。① は ③−② と一致する並びが本文にある場合のみ。
  const cost = /\n②\n\n([\d,]+) 千円\n\n([\d,]+) 千円\n\n([\d,]+) 千円\n\n③＝①＋②\n\n([\d,]+) 千円\n\n([\d,]+) 千円\n\n([\d,]+) 千円\n/d.exec(t);
  const head = /\n４ 事業費\n区\n\n分\n\n平成29年\n\n平成30年\n\n(?:平成31年|令和 1年)\n\n令和 2年\n/.exec(t);
  let costNote = '事業費表の列の並びが確認できないため金額は未収録。';
  if (cost && head && fy === 2019) {
    const pers = [1, 2, 3].map(g => cost[g]), total = [4, 5, 6].map(g => cost[g]);
    const direct = total.map((x, k) => num(x) - num(pers[k]));
    const seq = direct.map(v => `${v.toLocaleString('en-US')} 千円`).join('\n\n');
    const at = t.lastIndexOf(`\n${seq}\n`, cost.index);
    if (at > head.index && direct.every(v => v >= 0)) {
      // 決算（見込）額の欄のため、評価対象年度（令和元年度）の値は見込の可能性があり未収録。平成29・30年度のみ。
      [2017, 2018].forEach((year, k) => {
        const d = direct[k].toLocaleString('en-US');
        const off = at + 1 + direct.slice(0, k).map(v => `${v.toLocaleString('en-US')} 千円\n\n`).join('').length;
        p.amounts.push(amount(input, 'actual', year, d, '千円', `${d} 千円`, off));
        p.amounts.push(amount(input, 'personnel', year, pers[k], '千円', `${pers[k]} 千円`, groupAt(cost, k + 1)));
        p.amounts.push(amount(input, 'fullCost', year, total[k], '千円', `${total[k]} 千円`, groupAt(cost, k + 4)));
      });
      costNote = '事業費は ③＝①＋② が成立する平成29・30年度の決算額（①）・人件費（②）・総事業費（③）のみ記録。評価対象年度（令和元年度）は「決算（見込）額」の欄で見込の可能性があるため、令和2年度当初予算額は列の対応が確定できないため未収録。';
    }
  }
  p.warnings.push(`入間市 令和2年度事務事業評価シート${title[2] ?? ''}（令和元年度分）。整理番号を projectCode に記録。1次評価（担当課）のチェック欄は ■ が一つに定まる欄のみ記録し、2次評価（企画課）は未収録。`,
    `${costNote}活動・成果指標は表の列が崩れているため未収録。${notes.join('')}`);
  return [p];
}

export const entries: Record<string, Entry> = {
  '11225': { extract: municipal('11225', sheet), scope: '入間市 令和2年度事務事業評価シート（令和元年度分、一般・公共事業用）の事務事業名・整理番号・担当部課・1次評価のチェック欄（必要性・有効性・効率性・今後の方向性・改善／取り組みの評価）と、③＝①＋②が成立する平成29・30年度の決算額・人件費・総事業費。評価シートの見方（記入例）・評価対象事業一覧表・指標・2次評価・既存と重複する事業は対象外。' },
};
