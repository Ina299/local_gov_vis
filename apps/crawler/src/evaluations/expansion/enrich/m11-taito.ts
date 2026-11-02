/**
 * 13106 台東区: 令和元年度 事務事業評価シート（PDFdata/NNN.pdf、評価対象はH30年度）。公開済みレコード（区の事務事業評価一覧）の
 * 空欄の目的・事業内容を補う。事業名の特定は n0-taito と同じく、一覧表の行（事業名・所管部・所管課）がシートの行としてそろって
 * 現れるものがちょうど1つの場合に限る。
 * - 目的: 欄の見出し「事業目的」の直後から「事業内容\n[H30年度]」の見出しまでがちょうど1段落のとき、その段落。
 * - 事業内容: 「事業内容\n[H30年度]」の直後の段落。
 * 事業内容の本文が見出しの前に割れて出るシート（見出しの後が空、または事業目的との間に段落が2つ以上）は、
 * どの段落がどちらの欄か確定しないため、目的・事業内容とも採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { nfkc } from '../batch9/i1-util';
import { block, blockEvidence } from './m3-narrative';

const LIST_SOURCE = 'f6042ad2f86315f4e34339a4'; // 令和元年度 事務事業評価結果（HTML一覧）。事業名の特定にだけ使う。
const TITLE = '令和元年度 事務事業評価シート';
const PURPOSE = '\n事業目的\n\n', ACTIVITIES = '\n事業内容\n[H30年度]\n\n';
/** 本文1行は60字弱。 */
const WRAP = 50;

function listRows(inputs: CachedInput[]): { bu: string; ka: string; name: string }[] {
  const list = inputs.find(i => i.sourceId === LIST_SOURCE && i.municipalityCode === '13106');
  if (!list || !list.text.startsWith('令和元年度 事務事業評価結果')) return [];
  return [...list.text.matchAll(/^(\d+)\n([^\n]*(?:部|委員会|事務局))\n([^\n]+)\n([^\n]+)\n/gm)].map(m => ({ bu: m[2], ka: m[3], name: m[4] }));
}

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13106' || input.format !== 'pdf' || !/\/jimujigyo01\/PDFdata\/\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text;
  if (!t.startsWith(TITLE) || input.truncated) return [];
  const i = t.indexOf(PURPOSE), j = t.indexOf(ACTIVITIES);
  if (i < 0 || j < i || t.indexOf(PURPOSE, i + 1) >= 0 || t.indexOf(ACTIVITIES, j + 1) >= 0) return [];
  const purpose = block(t, i + PURPOSE.length, /^$/, { minWrap: WRAP });
  const activities = block(t, j + ACTIVITIES.length, /^(委託の有無|補助金の有無)$/, { minWrap: WRAP });
  // 目的の段落の直後が事業内容の見出し（間に別の段落がない）であること
  if (!purpose || purpose.at + purpose.raw.length + 1 !== j || !activities) return [];

  const lineSet = new Map<string, { start: number; s: string }>();
  for (const m of t.matchAll(/^[^\n]+$/gm)) { const k = nfkc(m[0]); if (!lineSet.has(k)) lineSet.set(k, { start: m.index!, s: m[0] }); }
  const hits = listRows(inputs).filter(r => lineSet.has(nfkc(r.name)) && lineSet.has(nfkc(r.bu)) && lineSet.has(nfkc(r.ka)));
  if (hits.length !== 1) return [];
  const name = lineSet.get(nfkc(hits[0].name))!, bu = lineSet.get(nfkc(hits[0].bu))!, ka = lineSet.get(nfkc(hits[0].ka))!;
  const p = project(input, `narrative:${nfkc(name.s)}`, name.s.trim(), 2019, name.s, name.start);
  p.projectCode = null; p.id = stableId(input, `narrative-sheet:${nfkc(name.s)}`, 2019);
  p.evaluatedFiscalYear = 2018; p.department = `${bu.s.trim()} ${ka.s.trim()}`;
  p.evidence.push(evidence(input, TITLE, 0), evidence(input, bu.s, bu.start), evidence(input, ka.s, ka.start));
  p.purpose = purpose.value; p.activities = activities.value;
  p.evidence.push(evidence(input, PURPOSE.trim(), i + 1), blockEvidence(input, purpose), evidence(input, ACTIVITIES.trim(), j + 1), blockEvidence(input, activities));
  p.warnings.push('台東区 令和元年度 事務事業評価シート（評価対象はH30年度）の「事業目的」欄と「事業内容［H30年度］」欄を収録。PDFの折り返しの改行を除いた。'
    + '事業名は区の事務事業評価一覧表の行（事業名・所管部・所管課）がシートの行としてそろって現れるものに限り特定。');
  return [p];
}

export const entry = {
  extract,
  scope: '台東区 令和元年度 事務事業評価シート（PDFdata/NNN.pdf）の「事業目的」欄と「事業内容［H30年度］」欄（両欄の見出しの直後にそれぞれ1段落あるもの）。',
};
