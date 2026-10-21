import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount } from './g1-util';

const HEADING = '令和 2年度 事務事業評価シート (令和 1年度分)';
const LIST_ID = '8398e18decae8ea3171f19a9';
const LIST_HEADING = '令和２年度（令和元年度分）事務事業評価 評価対象事業一覧表';
/** 1次評価 check-box vocabularies; 「普通」 is shared by 必要性 and 有効性 and is therefore not assigned. */
const CHOICES: [string, string[]][] = [
  ['必要性', ['必要不可欠', '高い', 'やや低い', '低い']],
  ['有効性', ['大変有効である', '有効である', 'あまり有効でない', '有効でない']],
  ['効率性', ['向上', 'やや向上', '変わらない', 'やや悪化', '悪化']],
  ['今後の方向性', ['充実', '継続', '縮小', '廃止・休止', '完了・終了']],
  ['改善の評価', ['改善できた', 'やや改善できた', '改善できなかった']],
];

/** 整理番号 → 事務事業名 from the evaluation-target list, page by page, only where both columns have equal length. */
function listNames(list: CachedInput): Map<string, { name: string }> {
  const out = new Map<string, { name: string }>();
  for (const m of list.text.matchAll(/\n整理番号\n((?:\d{6}-\d{2}-\d{2}\n)+)\n事務事業名\n/g)) {
    const nums = m[1].trimEnd().split('\n'), lines = list.text.slice(m.index! + m[0].length).split('\n');
    if (lines[nums.length] !== '' || lines[nums.length + 1] !== '課名') continue;
    nums.forEach((n, i) => out.set(n, { name: lines[i] }));
  }
  return out;
}

export function extractIruma(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '11225' || input.format !== 'pdf' || !input.text.startsWith(HEADING)) return [];
  const list = inputs.find(i => i.sourceId === LIST_ID && i.text.startsWith(LIST_HEADING));
  if (!list) return [];
  const t = input.text, nos = [...new Set([...t.matchAll(/\n(\d{6}-\d{2}-\d{2})\n/g)].map(m => m[1]))];
  const depts = [...t.matchAll(/^(\S+部) (\S+課)$/gm)];
  if (nos.length !== 1 || new Set(depts.map(d => d[0])).size !== 1) return [];
  const row = listNames(list).get(nos[0]);
  if (!row) return [];
  const nameAt = t.indexOf(`\n${row.name}\n`);
  if (nameAt < 0) return [];
  const p = project(input, nos[0], row.name, 2020, row.name, nameAt + 1);
  p.department = depts[0][0]; p.evaluatedFiscalYear = 2019;
  p.evidence.push(evidence(input, HEADING, 0), evidence(input, nos[0], t.indexOf(`\n${nos[0]}\n`) + 1), evidence(input, depts[0][0], depts[0].index!));
  const cost = t.match(/４ 事業費\n区\n\n分\n\n平成29年\n\n平成30年\n\n令和 1年\n\n令和 2年\n\n((?:[\d,]+ 千円\n\n){7})一般職・労務職/);
  if (cost) {
    const v = cost[1].trim().split(/ 千円\n*/).filter(Boolean);
    [2017, 2018, 2019, 2020].forEach((fy, i) => p.amounts.push(amount(input, 'budget', fy, v[i], '千円', cost[0], cost.index!)));
    [2017, 2018].forEach((fy, i) => p.amounts.push(amount(input, 'actual', fy, v[4 + i], '千円', cost[0], cost.index!)));
    p.warnings.push('事業費表は値が7個そろって行順（当初予算額: 平成29年〜令和2年、決算（見込）額: 平成29年〜令和元年）に出力された票だけ収録。令和元年度の決算（見込）額は見込の可能性があるため決算として収録していません。人件費・総事業費の行は列の欠けがあり未収録。');
  } else p.warnings.push('事業費表は空欄や段組み崩れで値と年度の対応を確定できないため金額を収録していません。');
  const s = t.indexOf('◆１次評価'), e = t.indexOf('◆２次評価');
  if (s >= 0 && e > s) {
    const checked = [...t.slice(s, e).matchAll(/■ ?([^\n■□]+)/g)].map(m => ({ value: m[1].trim(), start: s + m.index! }));
    for (const [label, options] of CHOICES) {
      const hits = checked.filter(c => options.includes(c.value));
      if (hits.length !== 1) continue;
      const end = t.indexOf('\n', hits[0].start), scale = label === '必要性' || label === '有効性' ? [...options.slice(0, 2), '普通', ...options.slice(2)] : options;
      p.ratings.push({ kind: 'self', label: `1次評価 ${label}`, value: hits[0].value, scale: scale.join(' / '), evidence: evidence(input, t.slice(hits[0].start, end < 0 ? t.length : end), hits[0].start) });
    }
  }
  p.warnings.push('名称は評価対象事業一覧表の整理番号で照合し、評価シート本文に同じ名称があることを確認。評価年度は表題の令和2年度、評価対象年度は令和元年度分。1次評価は■の選択肢を項目固有の語で判別し、両項目に共通する「普通」は割り当てていません。2次評価・成果指標は未構造化。');
  return [p];
}
