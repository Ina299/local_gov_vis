/** Batch-9 (i0) extractors for Iwate: 滝沢市 事業実績報告書. 盛岡市 is not structured (see report). */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { BASE_WARNING, dedupe, digits, type Entry } from '../batch8/h3-util';

const TAKIZAWA_REPORTS = new Set(['338d3fc592b4a0bf28acdbce', '8a8802e89798e8a251042e77']);
const LABEL = '事業の意図やねらい（成果や効果）の達成状況';
const NOT_NAME = new Set(['事', '業', '名', '主', '体', LABEL]);
const DEPT = /事\n\n業\n\n主\n\n(?:体\n\n)?(\S+)\n【(?:滝沢市主体|協働事業|他団体事業主体)】/g;
const flat = (s: string) => s.replace(/\n/g, '');

/**
 * 事業実績報告書: one business per 【事業意図・ねらい】 block. The name is the paragraph just before the block
 * (wrapped names sharing a line with the block are skipped); 担当課 is the single 事業主体 found before the next block.
 */
function takizawa(input: CachedInput): ProjectEvaluation[] {
  if (!TAKIZAWA_REPORTS.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const anchors = [...t.matchAll(/【事業意図・ねらい】/g)].map(m => m.index!);
  anchors.forEach((at, i) => {
    let before = t.slice(Math.max(0, at - 300), at);
    if (!before.endsWith('\n')) return;
    before = before.replace(/\n+$/, '');
    if (before.endsWith(LABEL)) before = before.slice(0, -LABEL.length).replace(/\n+$/, '');
    const paras = before.split('\n\n');
    let lines = paras[paras.length - 1].split('\n');
    if (lines.length === 2 && lines[1] === '（重点事業）') lines = lines.slice(0, 1);
    const name = lines[0];
    if (lines.length !== 1 || name.length < 3 || NOT_NAME.has(name) || name.includes('【') || !paras.slice(-4, -1).includes('業')) return;
    const nameAt = t.lastIndexOf(name, at);
    const seg = t.slice(at, anchors[i + 1] ?? t.length);
    const block = seg.split('\n\n')[0];
    const ach = block.indexOf('【達成状況】');
    const years = [...new Set([...seg.matchAll(/令和(\d)年度の事業概要（実績）/g)].map(m => m[1]))];
    if (ach < 0 || years.length !== 1) return;
    const depts = [...new Set([...seg.matchAll(DEPT)].map(m => m[1]))];
    const p = project(input, name, name, null, name, nameAt);
    p.projectCode = null;
    p.department = depts.length === 1 ? depts[0] : null;
    p.evaluatedFiscalYear = 2018 + digits(years[0]);
    p.purpose = flat(block.slice('【事業意図・ねらい】'.length, ach));
    p.outcomes = flat(block.slice(ach + '【達成状況】'.length));
    p.evidence.push(evidence(input, block, at));
    p.warnings = [BASE_WARNING, '事業実績報告書の事業ごとの「事業の意図やねらい（成果や効果）の達成状況」を収録。事業単位の評価区分は様式に無い。決算額・活動指標の表は別ページで段組みが崩れ事業との対応を確定できないため未収録。担当課は同じ事業欄内に事業主体が1つだけ現れる場合のみ記録。'];
    out.push(p);
  });
  return dedupe(out);
}

export const entries: Record<string, Entry> = {
  '03216': { extract: input => takizawa(input),
    scope: '令和6・7年度事業実績報告書の事業ごとの事業名・担当課・事業の意図と達成状況（文章）を部分構造化。決算額・活動指標（段組み崩れ）、政策・施策・市長方針評価は対象外。' },
};
