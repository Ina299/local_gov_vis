/**
 * 39204 南国市: 事務事業実績・評価報告書（令和２〜５年度決算）の事務事業評価表。公開済みレコードと同じ抽出（batch8/h3-nankoku）で
 * 事業名・所管・年度を確定した表ごとに、空欄の目的（「事業の目的」）、事業内容（「●事業の概要」）、成果（「●事業の成果」）を補う。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { entries as published } from '../batch8/h3-nankoku';
import { block, blockEvidence, type Block } from './m3-narrative';

const HEAD = /令和([０-９\d]+)年度決算 事務事業評価表\n１．事業名等\n/g;
const STOP = /^(●.*|[１-９]．.*|３．事業の評価・今後の方向性)$/;
/** 「１．事業名等」欄の見出し語（目的の文章に混ざっていれば採らない）。 */
const LABELS = /^(事 業 名|所管課・係|作成者|基本目標|施策の項目|第[４５]次南国市総合計画での位置づけ)/;

/**
 * 「１．事業名等」欄で句点で終わる段落は「事業の目的」だけ（他は事業名・所管・作成者・総合計画の項目）。
 * 段落内の「事業の目的」の見出し（単独行または行頭）と総合計画の見出し行を除いた残りを目的とする。
 * 句点で終わる段落が1つだけで、「事業の目的」の見出しが欄内に1回だけの場合に限る。
 */
function purposeOf(text: string, start: number, sec: string, exclude: string[]): Block | null {
  if ((sec.match(/事業の目的/g) ?? []).length !== 1) return null;
  const found: Block[] = [];
  let pos = 0;
  for (const para of sec.split('\n\n')) {
    const lines = para.split('\n').filter(l => l.trim() && !/^第[４５]次南国市総合計画での位置づけ$/.test(l.trim()) && l.trim() !== '事業の目的')
      .map(l => l.replace(/^事業の目的 /, '').trim());
    const value = lines.join('');
    if (value.endsWith('。')) {
      if (lines.some(l => LABELS.test(l) || exclude.includes(l) || l.includes('事業の目的'))) return null;
      found.push({ value, raw: para, at: start + pos });
    }
    pos += para.length + 2;
  }
  return found.length === 1 ? found[0] : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '39204' || input.truncated) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const heads = [...text.matchAll(HEAD)].map(m => m.index!);
  for (const r of published['39204'].extract(input, [input])) {
    const pos = r.evidence[1]?.cell?.match(/^extracted-text:chars:(\d+)-/);
    const start = pos ? Number(pos[1]) : -1, k = heads.indexOf(start);
    if (k < 0) continue;
    const seg = text.slice(start, heads[k + 1] ?? text.length);
    const s2 = seg.indexOf('２．事業の概要・成果');
    if (s2 < 0) continue;
    // 作成者は所管課・係の次の行。
    const dept = r.department ?? '', author = new RegExp(`\\n${dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n([^\\n]+)\\n`).exec(seg)?.[1] ?? '';
    const purpose = purposeOf(text, start, seg.slice(0, s2), [r.projectName, dept, author].filter(Boolean));
    const one = (label: string) => { const ms = [...seg.matchAll(new RegExp(`\\n${label}\\n`, 'g'))]; return ms.length === 1 ? ms[0] : null; };
    const am = one('●事業の概要'), om = one('●事業の成果');
    const activities = am ? block(text, start + am.index! + am[0].length, STOP, { next: STOP, minWrap: 44 }) : null;
    const outcomes = om ? block(text, start + om.index! + om[0].length, STOP, { next: STOP, minWrap: 44 }) : null;
    if (!purpose && !activities && !outcomes) continue;
    const p = project(input, `narrative-${start}`, r.projectName, null, r.evidence[0].rawText, Number(r.evidence[0].cell!.match(/(\d+)-/)![1]));
    p.id = stableId(input, `narrative-${start}`, null);
    p.projectCode = null; p.department = r.department; p.evaluatedFiscalYear = r.evaluatedFiscalYear;
    p.evidence.push(evidence(input, text.slice(start, start + r.evidence[1].rawText.length), start));
    if (purpose) { p.purpose = purpose.value; p.evidence.push(blockEvidence(input, purpose)); }
    if (activities) { p.activities = activities.value; p.evidence.push(blockEvidence(input, activities)); }
    if (outcomes) { p.outcomes = outcomes.value; p.evidence.push(blockEvidence(input, outcomes)); }
    p.warnings.push('南国市 事務事業評価表の文章欄から、目的（「事業の目的」）、事業内容（「●事業の概要」）、成果（「●事業の成果」）を原文のまま収録。'
      + '目的は「１．事業名等」欄で句点で終わる唯一の段落から見出し語を除いたもの。概要・成果は空行・次の見出し・表の数値が現れた所で打ち切り、PDFの折り返しの改行だけを除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '南国市 事務事業実績・評価報告書（令和２〜５年度決算）の事務事業評価表の文章欄: 事業の目的、●事業の概要、●事業の成果（表や数値の混ざるものは除く）。',
};
