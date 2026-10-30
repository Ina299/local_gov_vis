import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 島根県（令和7年度 施策評価及び事務事業評価の全文 PDF）
// 施策別の PDF・事務事業の一覧表は全文 PDF の再掲なので、全文 PDF だけを構造化する。
const FULL = /施策評価・事務事業評価/;
const SHEET = /令和７年度\n\n事務事業評価シート\n/g;
const N = String.raw`\d{1,3}(?:,\d{3})*`;
const LABELS = new Set(['うち一般財源', '令和6年度の実績額', '事業費', '目的', '担当課', '誰（何）を']);

function extractShimane(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '32000' || input.format !== 'pdf') return [];
  const t = input.text;
  if (!/^令和７年度\n\n施策評価・事務事業評価/.test(t) || !FULL.test(t.slice(0, 200))) return [];
  // 施策ごとの「事務事業の一覧」の行: 前年度の事業費（千円）／今年度の事業費（千円）／所管課名 が1行（または改行をはさんで）並ぶ。
  const listPairs = new Map<string, { dept: string; raw: string; start: number }[]>();
  for (const m of t.matchAll(new RegExp(String.raw`(?<![\d,])(${N})\s+(${N}) ([^\n\d][^\n]*)\n`, 'g'))) {
    const k = `${m[1]}|${m[2]}`;
    if (!listPairs.has(k)) listPairs.set(k, []);
    listPairs.get(k)!.push({ dept: m[3].replace(/\s/g, ''), raw: m[0].trimEnd(), start: m.index });
  }
  const starts = [...t.matchAll(SHEET)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const sheet = t.slice(s, starts[i + 1] ?? t.length);
    const kpi = sheet.indexOf('２ ＫＰＩ');
    const head = sheet.slice(0, kpi < 0 ? sheet.length : kpi);
    const d = /\n([^\n]+)\n\n担当課\n\n１ 事務事業の概要\n/.exec(head);
    if (!d) return;
    let nm = /^１ 事務事業の概要\n\n?([^\n]+)\n/.exec(head.slice(d.index + d[0].indexOf('１ 事務事業の概要')));
    let nameOff = nm ? s + d.index + d[0].indexOf('１ 事務事業の概要') + nm[0].indexOf(nm[1], 10) : -1;
    if (!nm || LABELS.has(nm[1].trim())) {
      nm = /\n事務事業の名称\n\n([^\n]+)\n\n誰（何）を\n/.exec(head);
      nameOff = nm ? s + nm.index + nm[0].indexOf(nm[1]) : -1;
    }
    if (!nm || LABELS.has(nm[1].trim())) return;
    const name = nm[1].trim(), dept = d[1].trim();
    if (LABELS.has(dept)) return;
    const p = project(input, `${nfkc(dept)}|${nfkc(name)}`, name, 2025, t.slice(s, s + head.indexOf('１ 事務事業の概要')).trimEnd(), s);
    p.evidence.push(evidence(input, name, nameOff));
    p.department = dept;
    // 「令和6年度の実績額」「令和7年度の当初予算額」の事業費（千円）。単独行の数値の先頭2つ（事業費の実績・当初予算、その後に一般財源の2つ）。
    const a = head.indexOf('令和6年度の実績額');
    if (a < 0) { p.warnings.push('事業費欄が見つからないため金額は未収録。'); out.push(p); return; }
    const region = head.slice(a);
    const nums: { v: string; off: number }[] = [];
    for (const m of region.matchAll(new RegExp(`^(${N})$`, 'gm'))) {
      if (region.startsWith('\n\n上位の施策', m.index! + m[0].length)) continue; // 上位の施策の番号
      nums.push({ v: m[1], off: s + a + m.index! });
    }
    const pair = nums.length >= 2 ? (listPairs.get(`${nums[0].v}|${nums[1].v}`) ?? []).find(r => r.dept.length > 0 && nfkc(dept).includes(nfkc(r.dept))) : undefined;
    if (!pair || !region.includes('令和7年度の当初予算額')) {
      p.warnings.push('事業費（令和6年度の実績額・令和7年度の当初予算額）が施策の事務事業一覧の前年度・今年度の事業費と照合できないため金額は未収録。');
      out.push(p); return;
    }
    const raw = t.slice(s + a, nums[1].off + nums[1].v.length);
    const ra = amount(input, 'actual', 2024, nums[0].v, '千円', raw, s + a);
    const rb = amount(input, 'budget', 2025, nums[1].v, '千円', raw, s + a);
    if (ra.amountYen! > 0) p.amounts.push(ra);
    if (rb.amountYen! > 0) p.amounts.push(rb);
    p.evidence.push(evidence(input, pair.raw, pair.start));
    p.warnings.push('金額は事務事業評価シートの事業費（千円）: 令和6年度の実績額を決算（2024年度）、令和7年度の当初予算額を予算（2025年度）として収録。施策の「事務事業の一覧」の前年度・今年度の事業費（同じ所管課の行）と一致する場合のみ。0 は収録していない。一般財源は未収録。');
    out.push(p);
  });
  // 複数の施策に再掲される事業は値が一致すれば1件に統合、食い違えば除外。
  // 一覧と照合できなかった写し（金額なし）は、照合できた写しがある事業では使わない。
  const withAmounts = new Set(out.filter(p => p.amounts.length).map(p => p.projectCode));
  return mergeReprints(out.filter(p => p.amounts.length || !withAmounts.has(p.projectCode)), p => p.projectCode!);
}

export const entries: Record<string, Entry> = {
  '32000': {
    extract: (input) => extractShimane(input),
    scope: '令和7年度「施策評価及び事務事業評価の全文」PDF の事務事業評価シートの事務事業名・担当課・事業費（令和6年度の実績額・令和7年度の当初予算額。施策の事務事業一覧の前年度・今年度の事業費と一致するもののみ）。施策別 PDF・事務事業の一覧表は全文の再掲のため対象外。KPI・評価文・一般財源は対象外。',
  },
};
