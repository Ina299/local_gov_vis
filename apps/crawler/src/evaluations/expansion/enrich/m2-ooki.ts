/** 大木町 (40522): 主要な施策の成果（令和3〜5年度）の活動事業ごとの「内容」欄（事業評価の実施内容・成果の文）。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';
import { ookiEntries } from '../batch11/k0-ooki';

// 公開済みレコードは同じ冊子の冒頭の「事業一覧」の行（活動事業名・成果指標・事業費①・決算額②・①－②・課名）から
// 作られる（batch11/k0-ooki）。冊子後半の施策評価シートの「事業評価」の表では、①事業費・②決算額・①－②の3行の直後に
// 「内容」欄の文（実施した内容と成果）が空行まで続く（見出し「内容」は欄の中ほどの行頭に付く）。
// 評価の表の活動事業名は段組みで金額・内容の欄と離れて並び、近さでは対応が決まらないため、事業名は使わない。
// 代わりに①・②・①－②の3つの数値の組が事業一覧のちょうど1行と一致し、評価の表でもその組が1回だけ現れる場合に、
// その一覧の行の事業の内容とする。冊子に目的の欄はない。
const FY: Record<string, number> = {
  '1aaf0137fe585c080394c40f': 2021, // R3shuyounasisakunoseika.pdf
  '3b0fccf91fdfe2a14d81728e': 2022, // R4shuyounasisakunoseika.pdf
  '3fee4ac96aa2856d4c1b54fe': 2023, // R5syuyounasesakunoseika.pdf
};
const TRIPLE = /\n([\d,]+)\n([\d,]+)\n([▲△-]?[\d,]+)\n((?:[^\n]+\n)*?[^\n]+)\n\n/g;
const num = (s: string) => Number(s.replace(/,/g, '').replace(/^[▲△-]/, '-'));

function extract(input: CachedInput): ProjectEvaluation[] {
  const fy = FY[input.sourceId];
  if (input.municipalityCode !== '40522' || !fy || input.truncated) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  // 事業一覧の行（公開済みレコードと同じ抽出）を①・②・①－②の組で引く。
  const rows = new Map<string, ProjectEvaluation[]>();
  for (const r of ookiEntries['40522'].extract(input, [])) {
    // 決算額の根拠は「予算コード・①・②・①－②（・課名）」のセル。
    const cells = r.amounts[0]?.evidence.rawText.split(/\n+/).slice(1, 4).map(c => /^[▲△-]?[\d,]+/.exec(c)?.[0]);
    if (cells?.length === 3 && cells.every(Boolean)) rows.set(cells.join('|'), [...(rows.get(cells.join('|')) ?? []), r]);
  }
  const triples = [...t.matchAll(TRIPLE)].filter(m => num(m[1]) - num(m[2]) === num(m[3]));
  const seen = new Map<string, number>();
  for (const m of triples) { const k = `${m[1]}|${m[2]}|${m[3]}`; seen.set(k, (seen.get(k) ?? 0) + 1); }
  for (const m of triples) {
    const key = `${m[1]}|${m[2]}|${m[3]}`, row = rows.get(key);
    if (!row || row.length !== 1 || seen.get(key) !== 1) continue;
    const lines = m[4].split('\n');
    const labelled = lines.filter(l => l === '内容' || l.startsWith('内容 '));
    if (labelled.length > 1 || (!labelled.length && lines.length !== 2)) continue;
    const body = lines.flatMap(l => l === '内容' ? [] : [l.startsWith('内容 ') ? l.slice(3) : l]);
    const text = body.join('\n');
    if (!text.endsWith('。') || body.some(l => /^[\d,.]+$/.test(l))) continue;
    const name = row[0].projectName, from = m.index + 1;
    const p = project(input, `${name}:activities`, name, null, m[0].slice(1, -2), from);
    p.projectCode = null; p.evaluatedFiscalYear = fy; p.department = row[0].department;
    p.activities = text;
    p.evidence.push(row[0].evidence[0]);
    p.warnings.push('施策評価シートの事業評価の表の「内容」欄の原文（行頭の見出し「内容」だけを除き、改行も原文のまま）。事業との対応は、直前の①事業費・②決算額・①－②の組が事業一覧の行と一致することで確定。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '大木町 主要な施策の成果（令和3〜5年度）の事業評価の表から、活動事業ごとの「内容」欄（実施内容と成果の文）。直前の①事業費・②決算額・①－②の組が冒頭の事業一覧のちょうど1行と一致するもののみ。目的の欄はない様式。',
};
