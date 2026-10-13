import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';
const sources: Record<string, number> = { f230b9d42eb612c415d09e07: 2026, '03d43f23f7f0a5c0cfcb5ae9': 2025, '989f7ba56e996fd2af9e3a34': 2024 };
const excluded = new Set(['「第２次熊本市特別支援教育推進計画」', '授業づくり支援訪問、授業力向上支援員派遣研修', '一般管理経費、主催講座開催経費']);
export function extractKumamoto(input: CachedInput): ProjectEvaluation[] {
  const year = sources[input.sourceId];
  if (input.municipalityCode !== '43100' || input.format !== 'pdf' || !year || !input.text.includes('事務事業点検評価報告書')) return [];
  const cover = input.text.match(/^[\s\S]+?《令和[５６７]年度[^\n]+事業分》/);
  if (!cover) return [];
  const headings = [...input.text.matchAll(/^([^\n]+)\n▶ 前年度の主な実績/gm)].map(m => {
    let start = m.index!; let heading = m[1];
    if (/^【[^】]+】$/.test(heading)) {
      const preceding = input.text.lastIndexOf('\n', start - 2) + 1;
      heading = input.text.slice(preceding, start).trim() + heading; start = preceding;
    }
    const dept = heading.match(/【([^】]+)】$/)?.[1];
    const name = heading.replace(/^【再掲】/, '').replace(/【[^】]+】$/, '').trim();
    return { start, name, dept, content: m.index! + m[1].length + 1 };
  });
  const records = new Map<string, ProjectEvaluation>();
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]; if (input.truncated && i === headings.length - 1) continue;
    let end = headings[i + 1]?.start ?? input.text.length;
    const tail = input.text.slice(h.content, end);
    const boundary = tail.search(/^(?:○主な|○前計画期間|施策の方向性|学識経験者の評価及び意見)/m);
    if (boundary >= 0) end = h.content + boundary;
    const raw = input.text.slice(h.start, end).trimEnd();
    const activityStart = raw.indexOf('▶ 前年度の主な実績');
    const issueStart = raw.indexOf('▶ 現状と課題');
    const futureStart = raw.indexOf('▶ 今後の方向性');
    if (!h.name || excluded.has(h.name) || issueStart < activityStart || futureStart < issueStart) continue;
    const existing = records.get(h.name);
    if (existing) {
      existing.evidence.push(evidence(input, raw, h.start));
      existing.warnings.push('同年度の同名事業の別施策への再掲・別側面の記述を原文根拠に統合しています。');
      continue;
    }
    const p = project(input, h.name, h.name, year, raw, h.start);
    p.evaluatedFiscalYear = year - 1; p.department = h.dept ?? null;
    p.activities = raw.slice(activityStart, issueStart).trim();
    p.evidence.push(evidence(input, cover[0], 0), evidence(input, p.activities, h.start + activityStart));
    p.warnings.push('施策全体の評価ではなく、明示された個別事業・取組の前年度実績を部分構造化。施策共通指標や学識経験者の施策評価を個別事業へ配賦していません。課題・今後の方向性は原文で保持し、数値指標・費用・独立した成果区分の推測はしていません。');
    if (year === 2026) p.warnings.push('冒頭の制度趣旨には令和6年度との記述が残っていますが、表紙は令和7年度事業分、各実績本文にも令和7年度の明記があります。対象年度は表紙に従い2025年度とし、この原文内の不整合を保持しています。');
    records.set(h.name, p);
  }
  return [...records.values()];
}
