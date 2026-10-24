/** Batch-12 (m3) extractor for 27227 東大阪市: 教育委員会 点検及び評価票（令和６年度、1事業1枚）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { nfkc, type Entry } from '../batch9/i1-util';

const SOURCES = new Set(['78b0a634b31aad81d72d0935']);
const YEAR = '前年度（令和６年度）の実績について、点検及び評価をしました。';
const DEPT_LINE = /^[^\s]+(?:室|課|センター)$/;

function higashiosaka(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27227' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, yearAt = t.indexOf(YEAR);
  if (yearAt < 0 || !t.startsWith('令和６年度\n教育に関する事務の管理及び執行の状況の\n点検及び評価票')) return [];
  // Table of contents: （No. N）事業名 — used to confirm the sheet's name segment.
  const toc = new Map([...t.slice(0, yearAt).matchAll(/（No\. ([０-９]+)）([^\n]+)/g)].map(m => [Number(nfkc(m[1])), nfkc(m[2])]));
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/\nNo\.\n\n(\d+)\n\n重点方針\n\n([\s\S]*?)\n\n事業概要\n/g)) {
    const no = Number(m[1]), head = m[2], headAt = m.index! + m[0].indexOf(head);
    // Segments of the sheet header: the 重点方針 text, the labels 事業名／関係所属, the department lines and the business name.
    const segs: { s: string; at: number }[] = [];
    let pos = 0;
    for (const s of head.split('\n\n')) { segs.push({ s, at: headAt + pos }); pos += s.length + 2; }
    const policyCandidates = segs.filter(x => !['事業名', '関係所属'].includes(x.s) && !x.s.split('\n').every(l => DEPT_LINE.test(l)));
    const depts = segs.filter(x => x.s.split('\n').every(l => DEPT_LINE.test(l)));
    // The 重点方針 text is the segment printed in the 目次 heading list (重点方針①…). The remaining one is the business name.
    const policies = policyCandidates.filter(x => t.slice(0, yearAt).includes(`${x.s} ・`) || t.slice(0, yearAt).includes(`${x.s}・`));
    const names = policyCandidates.filter(x => !policies.includes(x));
    if (policies.length !== 1 || names.length !== 1 || depts.length > 1) continue;
    const nameSeg = names[0], name = nameSeg.s.split('\n').join('');
    const tocName = toc.get(no);
    if (!tocName) continue;
    const p = project(input, `No.${no}`, name, null, nameSeg.s, nameSeg.at);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, t.slice(m.index! + 1, headAt).trimEnd(), m.index! + 1), evidence(input, YEAR, yearAt));
    // A department block counts only when the label 関係所属 is printed in the same header (the layout varies by sheet).
    if (depts.length === 1 && segs.some(x => x.s === '関係所属')) {
      p.department = depts[0].s.split('\n').join('・');
      p.evidence.push(evidence(input, depts[0].s, depts[0].at));
      if (depts[0].s.includes('\n')) p.warnings.push('関係所属が複数課室のため「・」で連結して担当課欄に収録。');
    }
    p.warnings.push(`令和６年度 東大阪市教育委員会「教育に関する事務の管理及び執行の状況の点検及び評価票」No.${no}。成果指標・決算額（千円）は表の列（令和５年度実績値（参考）／令和６年度…）と抽出テキストの数値の並びの対応が確定できず、指標達成状況評価・事業総括の記号も枠との対応が確定できないため未収録（事業名・関係所属・評価対象年度のみの部分構造化）。`);
    if (nfkc(tocName) !== nfkc(name)) p.warnings.push(`目次の表記は「${tocName}」。事業名は評価票本体の表記で収録。`);
    out.push(p);
  }
  return out;
}

export const higashiosakaEntries: Record<string, Entry> = {
  '27227': {
    extract: input => higashiosaka(input),
    scope: '東大阪市教育委員会 令和６年度「点検及び評価票」（1事業1枚、27事業）の事業名・関係所属（ラベルと同じ見出し内に出力されるもののみ）・評価対象年度（令和６年度実績）。成果指標・決算額・指標達成状況評価・事業総括は列と値の対応が抽出テキストで確定できないため対象外。',
  },
};
