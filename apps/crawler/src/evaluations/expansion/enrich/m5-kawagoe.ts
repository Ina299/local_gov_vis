import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 川越市（令和6年度 事務事業評価シート（二次評価）8事業）
// 公開済みレコード（令和6年度の公表ページの8事業）の目的・事業の内容。欄の左のラベル「事業目的(対象をどのようにしたいのか)」
// 「事業の内容(事業目的を達成するために、具体的にどのようなことを行っているのか、また、行ってきたのか)」が改行ごとに
// 行頭に付くか単独の行になるため、決まったラベルの断片だけを外す。事務事業評価一覧・整理表（約990事業）は事業目的・
// 対象・事業内容の列の行が交互に並び、列の境が決まらないため使わない。
const SHEETS = new Set(['863bd49fa1e51250d2f933a9', '49150cdbe775d03fe68860d3', '7331a522d98dd317da5af5ee', '77c5eb7ffcef101b8e7a4337',
  '81557f636b85bc525fab0180', '02e5a75c8a837e6a62b4a61c', '1a6a2ff87ce306e7c7755a6e', 'b948e359fb3ca7ba28a7a67e']);
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
const LABEL = /^(?:事業の内容|\(事業目的を達成す|るために、具体的に|どのようなことを行っ|ているのか、また、|行ってきたのか\))(?: |$)/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11201' || !SHEETS.has(input.sourceId)) return [];
  const t = input.text;
  const head = t.match(/^令和６年度\n\n事務事業評価シート（二次評価）\n※令和5年度に実施した事業を評価しています\n/);
  const nameM = t.match(/\n課名\n\n１\n\n((?:[^\n]+\n)*?[^\n]+)\n(?:０|\n予 算 事 業 名)/);
  const m = /\n事業目的\n([^\n]+)\n\(対象をどのよう(?: ([^\n]+))?\nにしたいのか\)\n([\s\S]*?)\n\n?事業実施の成果\n/.exec(t);
  if (!head || !nameM || !m) return [];
  const purpose = m[1] + (m[2] ?? '');
  if (!purpose.endsWith('。')) return [];
  const name = nameM[1].replaceAll('\n', '');
  const p = project(input, `${name}:narrative`, name, 2024, nameM[1], nameM.index! + nameM[0].indexOf(nameM[1]));
  p.evaluatedFiscalYear = 2023;
  p.purpose = purpose;
  // 事業の内容: ラベルの断片を外した行。前の行が全幅で折り返していない場合に、箇条書き（・【１ など）の行頭の前だけ改行を残す。
  const lines = m[3].split('\n').map(l => { while (LABEL.test(l)) l = l.replace(LABEL, ''); return l.trim(); }).filter(Boolean);
  const full = Math.max(...lines.map(width));
  if (lines.length && /[。）)]$/.test(lines.at(-1)!))
    p.activities = lines.reduce((s, l, i) => s + (i && /^(?:[・※【（(]|[０-９\d]+ )/.test(l) && width(lines[i - 1]) < full * 0.9 ? '\n' : '') + l, '');
  p.evidence.push(evidence(input, m[0].slice(1, m[0].lastIndexOf('\n事業実施の成果')).replace(/\n$/, ''), m.index! + 1));
  p.warnings.push('事務事業評価シート（二次評価）の「事業目的」「事業の内容」欄。欄の左のラベルの断片（行頭・単独の行）を除いた。');
  return [p];
}

export const entry = {
  extract,
  scope: '川越市 令和6年度 事務事業評価シート（二次評価）8事業: 事業目的・事業の内容（目的・事業内容）。一覧・整理表は列が交互に並ぶため対象外。',
};
