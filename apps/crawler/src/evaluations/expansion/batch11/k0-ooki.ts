import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, num, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- 大木町（主要な施策の成果 冒頭の「令和N年度事業一覧」）
// 列: NO／「主要な施策の成果」該当ページ／活動事業／評価指標／目標値／成果値／事業評価／予算コード／事業費(最大時)①／決算額②／①－②／課名
const RATINGS = new Set(['〇', '△', '×', '□']);
const ERA = '０１２３４５６７８９';

/** Text blocks separated by blank lines, with absolute offsets. */
function cells(text: string): { start: number; end: number; s: string }[] {
  return [...text.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ start: m.index!, end: m.index! + m[0].length, s: m[0] }));
}

function extractOoki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40522') return [];
  const title = /令和([３４５])年度事業一覧/.exec(input.text.slice(0, 2000));
  if (!title) return [];
  const era = ERA.indexOf(title[1]), fy = 2018 + era;
  const head = new RegExp(`R${era}事業費\\n\\n?決算額②\\n\\(最大時\\)①`).exec(input.text);
  if (!head) return [];
  // 凡例（文書冒頭から「↓「主要な施策の成果」該当ページ」まで、表題を除く）を評価区分の原文定義として保持する。
  const legendEnd = input.text.indexOf('↓「主要な施策の成果」該当ページ');
  if (legendEnd < 0) return [];
  const scale = input.text.slice(0, legendEnd).replace(title[0], '').trim().replace(/\n+/g, '／');
  const c = cells(input.text), S = (i: number) => c[i]?.s ?? '';
  const isInt = (s: string) => /^\d+$/.test(s);
  const isNum = (s: string) => /^\d{1,3}(?:,\d{3})*$/.test(s);
  const out: ProjectEvaluation[] = [];
  for (let i = 6; i < c.length - 4; i++) {
    if (!/^\d\d-\d\d-\d\d$/.test(S(i)) || !RATINGS.has(S(i - 1))) continue;
    const m3 = /^(\d{1,3}(?:,\d{3})*)(?: (\S+(?:課|局|室)))?$/.exec(S(i + 3));
    if (!isNum(S(i + 1)) || !isNum(S(i + 2)) || !m3) continue;
    if (num(S(i + 1)) - num(S(i + 2)) !== num(m3[1])) continue; // 列ずれ検出: ①－②の検算が合う行のみ
    const r = i - 1;
    // 活動事業セル（NO・ページ・事業名）は 3 形式。どれにも当てはまらない行は列対応が確定しないため除外。
    let name: string | null = null, nameAt = r - 4;
    const a = /^(\d+) (\d+) (\S[^\n]*)$/.exec(S(r - 4)), b = /^(\d+) (\S[^\n]*)$/.exec(S(r - 4));
    if (a) name = a[3];
    else if (b && isInt(S(r - 5))) { name = b[2]; nameAt = r - 5; }
    else if (!S(r - 4).includes('\n') && !/^[\d,]+$/.test(S(r - 4)) && isInt(S(r - 5)) && isInt(S(r - 6))) { name = S(r - 4); nameAt = r - 6; }
    if (!name || /事業\s\S/.test(name)) continue;
    const dept = m3[2] ?? (/^\S+(?:課|局|室)$/.test(S(i + 4)) ? S(i + 4) : null);
    const lastCell = m3[2] || !dept ? i + 3 : i + 4;
    const rowRaw = input.text.slice(c[nameAt].start, c[lastCell].end);
    // 事業名末尾の★は臨時交付金充当事業の印（表の注記）で、事業名には含めない。
    const star = /\s*★$/.test(name), clean = name.replace(/\s*★$/, '').trim();
    const p = project(input, nfkc(clean), clean, null, rowRaw, c[nameAt].start);
    if (star) p.warnings.push('事業名末尾の「★」（新型コロナウイルス感染症対応・物価高騰対応重点支援地方創生臨時交付金の一部又は全額充当事業の印）は事業名から除いて収録。');
    p.evaluatedFiscalYear = fy; p.department = dept;
    p.evidence.push(evidence(input, title[0], title.index), evidence(input, head[0], head.index));
    p.amounts.push(amount(input, 'actual', fy, S(i + 2), '千円', input.text.slice(c[i].start, c[i + 3].end), c[i].start));
    const [ind, tgt, act] = [S(r - 3), S(r - 2), S(r - 1)];
    if (ind !== '-' && ![ind, tgt, act].some(s => s.includes('\n')))
      p.indicators.push({ name: ind, fiscalYear: fy, target: tgt === '-' ? null : tgt, actual: act === '-' ? null : act, unit: null,
        evidence: evidence(input, input.text.slice(c[r - 3].start, c[r - 1].end), c[r - 3].start) });
    p.ratings.push({ kind: 'self', label: '事業評価', value: S(r), scale, evidence: evidence(input, input.text.slice(c[r].start, c[i].end), c[r].start) });
    p.warnings.push(`令和${era}年度事業一覧（主要な施策の成果の冒頭表）の行。金額は「決算額②」（千円）を令和${era}年度の実績として収録し、「R${era}事業費(最大時)①」は予算区分が明記されないため未収録。①－②（次年度繰越額）の検算が一致する行のみ採用。評価年度は本文に明記がないため未設定。指標の単位は目標値・成果値の原文に含まれるため単位欄は空。指標名は抽出テキストのまま（PDFの改行位置で文字が欠ける場合あり）。`);
    out.push(p);
  }
  return mergeReprints(out, p => `${p.projectName}|${p.evaluatedFiscalYear}`);
}

export const ookiEntries: Record<string, Entry> = {
  '40522': { extract: extractOoki, scope: '主要な施策の成果（令和3〜5年度）冒頭の「事業一覧」の事務事業行（事業名・評価指標の目標値/成果値・事業評価記号・決算額・課名）。①－②の検算が合わない行、列が崩れた行、施策評価シート、成果指標一覧・体系一覧、審議会意見、令和6年度版（事業一覧なし・施策評価シートの列崩れ）は対象外。' },
};
