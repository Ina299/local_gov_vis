/**
 * 13107 墨田区: 令和８年度 事務事業評価シート（施策別PDF）。公開済みレコード（同じPDFの施策評価の事務事業一覧）の空欄の目的に、
 * 評価シートの「目的」欄を補う。欄の見出し「目 的」は本文の途中の行頭に印字されるため除く。本文は「主管課」の行の直後から
 * 句点で終わる行まで（途中の行はすべて全幅で折り返していること）で、その後に「対 象 者」欄が続く場合に限る。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

const SHEET = /令和８年度 事務事業評価シート No\. \d+\n施 策 [^\n]+\n事 業 名 ([^\n]+)\n主管課 ([^\n]+?) 電話番号（内線）[^\n]*\n/g;
const YEAR = '令和7年度に実施した各部の施策・事務事業について、内部評価を行いました。';
/** 本文1行は50字余り。 */
const WRAP = 45;

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13107' || input.format !== 'pdf') return [];
  // 評価対象年度は、評価結果の公開ページの冒頭の一文による（公開済みレコードと同じ根拠）。
  const page = inputs.find(i => i.text.includes(YEAR));
  if (!page) return [];
  const t = input.text;
  const heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const from = h.index! + h[0].length, lines: string[] = [];
    let pos = from;
    while (lines.length < 8) {
      const nl = t.indexOf('\n', pos);
      if (nl < 0) return;
      lines.push(t.slice(pos, nl)); pos = nl + 1;
      if (lines[lines.length - 1].endsWith('。')) break;
    }
    const raw = lines.join('\n'), last = lines.length - 1;
    if (!lines[last].endsWith('。') || lines.filter(l => l.startsWith('目 的 ')).length !== 1 || lines.slice(0, last).some(l => l.length < WRAP)) return;
    // 続く2行以内に「対 象 者」欄の見出しがあること（目的の本文がここで終わる）。
    const after = t.slice(pos).split('\n', 3);
    if (!after.slice(0, 3).some(l => /^対 象( 者)?( |$)/.test(l)) || after[0].length >= WRAP + 5) return;
    const value = lines.map(l => l.replace(/^目 的 /, '')).join('');
    const p = project(input, `narrative-${h.index}`, h[1].trim(), 2026, h[0].trimEnd(), h.index);
    p.id = stableId(input, `narrative-${h.index}`, 2026);
    p.projectCode = null; p.department = h[2].trim(); p.evaluatedFiscalYear = 2025;
    p.purpose = value;
    p.evidence.push(evidence(page, YEAR), evidence(input, raw, from));
    p.warnings.push('墨田区 令和８年度 事務事業評価シートの「目的」欄を収録。本文の行頭に重なった欄の見出し（目 的）とPDFの折り返しの改行を除いた。評価対象年度は評価結果の公開ページの「令和7年度に実施した」による。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '墨田区 令和８年度 事務事業評価シート（施策別PDF）の「目的」欄（主管課の行の直後から句点まで、対象者欄が続くもの）。',
};
