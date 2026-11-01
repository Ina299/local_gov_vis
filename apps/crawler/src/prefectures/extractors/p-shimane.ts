import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 島根県（令和7年度 施策評価及び事務事業評価の全文 PDF）
// 施策別の PDF・事務事業の一覧表は全文 PDF の再掲なので、全文 PDF だけを構造化する。
const FULL = /施策評価・事務事業評価/;
const SHEET = /令和７年度\n\n事務事業評価シート\n/g;
const N = String.raw`\d{1,3}(?:,\d{3})*`;
const LABELS = new Set(['うち一般財源', '令和6年度の実績額', '事業費', '目的', '担当課', '誰（何）を', '事務事業の名称']);

/** 様式の欄名・数値・上位の施策名の行（値の範囲に混ざっていれば並びが崩れているとみなす）。 */
const FORM_LINE = /^[Ⅰ-Ⅻ]－|^[\d,]+$|うち一般財源|（千円）|取組内容|見直したこと|上位の施策|事業費|実績額|当初予算額/m;

/** 折り返した行を連結する（箇条書きの行頭記号の前だけ改行を残す）。 */
const joinLines = (lines: string[]) => lines.map((l, i) => (i && /^[・○◯■●◆①-⑳＜<]/.test(l) ? '\n' : '') + l.trim()).join('');

/**
 * 事務事業評価シートの文章欄。欄名と値が同じ行に並ぶ（欄名の断片が行頭に付く）ため、決まった並びのときだけ欄名の断片を除いて読む。
 *  - 目的: 「目的」の直後が「どういう状態を 値1／目指すのか 値2」の2行、または「どういう状態を／値／目指すのか」の3行で、
 *    空行の次が「令和7年度の…」「うち一般財源」のとき。
 *  - 令和7年度の取組内容: 欄名どうしの間（「令和7年度の／取組内容」と「令和6年度に行った／評価を踏まえて／見直したこと」の間）に値がある場合、
 *    または当初予算額の数値4つの後の段落が（上位の施策名の段落を除いて）ちょうど2つの場合の1つ目（2つ目は見直したこと）。
 *  - 成果: 「成／果」の後から欄名「改善状況」の行までが空行なしで続き、欄名の断片「「目的」の達成に」「向けた取組による」が行頭に1回ずつある場合、断片を除いた行。
 */
function texts(input: CachedInput, p: ProjectEvaluation, s: number, sheet: string, head: string) {
  const pur = /\n目的\n(?:どういう状態を ([^\n]+)\n目指すのか ([^\n]+)|どういう状態を\n([^\n]+)\n目指すのか)\n\n(?:令和7年度の|うち一般財源)/.exec(head);
  if (pur) {
    const raw = pur[3] ?? pur[0].slice('\n目的\n'.length, pur[0].lastIndexOf('\n\n'));
    p.purpose = pur[3] ? pur[3].trim() : joinLines([pur[1], pur[2]]);
    p.evidence.push(evidence(input, raw, s + pur.index + pur[0].indexOf(raw)));
  } else {
    // 3行の目的が欄名をはさんで出力される配置: 事業費の数値4つの直後の1行／「どういう状態を」の次の1行／「目指すのか」の後の1行
    // （間に「うち一般財源（千円）」が入ることがある）。1・2行目が折り返しの満ちた行であることを確かめる。
    const wrap = /\n\n(?:\d[\d,]*\n\n){3}\d[\d,]*\n\n([^\n]+)\n\nどういう状態を\n([^\n]+)\n目指すのか\n\n(?:うち一般財源\n（千円）\n\n)?([^\n]+)\n\n(?:令和7年度の\n取組内容|うち一般財源)/.exec(head);
    if (wrap && wrap[1].length >= 25 && wrap[2].length >= 25 && !/^(?:令和|うち一般財源|（千円）)/.test(wrap[3])) {
      p.purpose = joinLines([wrap[1], wrap[2], wrap[3]]);
      const a = wrap[0].indexOf(`\n\n${wrap[1]}\n\nどういう状態を`) + 2, b = wrap[0].lastIndexOf(`${wrap[3]}\n\n`) + wrap[3].length;
      p.evidence.push(evidence(input, wrap[0].slice(a, b), s + wrap.index + a));
      p.warnings.push('目的は事務事業評価シートの「目的」欄の値が欄名の行をはさんで3行に分かれて出力されているものを連結。');
    }
  }
  const act = /\n令和7年度の\n取組内容\n\n((?:[^\n]+\n)+)\n令和6年度に行った\n評価を踏まえて\n見直したこと\n/.exec(head);
  if (act && !FORM_LINE.test(act[1])) {
    p.activities = joinLines(act[1].trimEnd().split('\n'));
    p.evidence.push(evidence(input, act[1].trimEnd(), s + act.index + act[0].indexOf(act[1])));
  } else {
    const after = /\n令和7年度の当初予算額\n\n(?:\d[\d,]*\n\n){4}([^]*?)\n\n(?:\d\n\n)?上位の施策\n/.exec(head);
    const paras = after ? after[1].split('\n\n') : [];
    while (paras.length && /^[Ⅰ-Ⅻ]－/.test(paras[paras.length - 1])) paras.pop();
    // 値が欄名の直前に出力され、「見直したこと」が空欄の配置: 数値4つの後の段落が「令和7年度の／取組内容」で終わり、次の段落が見直したことの欄名だけ。
    const LABEL = '\n令和7年度の\n取組内容';
    if (after && paras.length === 2 && paras[0].endsWith(LABEL) && paras[1] === '令和6年度に行った\n評価を踏まえて\n見直したこと') {
      const raw = paras[0].slice(0, -LABEL.length);
      if (raw.trim() && !FORM_LINE.test(raw)) {
        p.activities = joinLines(raw.split('\n'));
        p.evidence.push(evidence(input, raw, s + after.index + after[0].indexOf(after[1])));
      }
    // 2つ目の段落（見直したこと）の末尾には上位の施策名の行が続くことがある。1つ目には欄名・施策名の行が無いこと。
    } else if (after && paras.length === 2 && paras.every(x => x.trim() && !/取組内容|見直したこと|上位の施策|^[Ⅰ-Ⅻ]－/.test(x)) && !FORM_LINE.test(paras[0])) {
      p.activities = joinLines(paras[0].split('\n'));
      p.evidence.push(evidence(input, paras[0], s + after.index + after[0].indexOf(after[1])));
    }
  }
  if (p.activities) p.warnings.push('活動は事務事業評価シートの「令和7年度の取組内容」（評価時点の今年度の取組予定）。');
  const ev = sheet.indexOf('３ 現状に対する評価\n\n成\n果\n\n');
  if (ev >= 0) {
    const from = ev + '３ 現状に対する評価\n\n成\n果\n\n'.length;
    const end = sheet.indexOf('\n改善状況\n\n', from);
    const region = end > from ? sheet.slice(from, end) : '';
    const lines = region.split('\n');
    const l1 = lines.filter(l => l.startsWith('「目的」の達成に')).length, l2 = lines.filter(l => l.startsWith('向けた取組による')).length;
    const body = lines.map(l => l.replace(/^(?:「目的」の達成に|向けた取組による) ?/, '')).filter(l => l.trim());
    if (region && !lines.some(l => !l.trim()) && l1 === 1 && l2 === 1 && body.length && !body.some(l => /^(?:目標値|実績値|達成率)/.test(l))) {
      p.outcomes = joinLines(body);
      p.evidence.push(evidence(input, region, s + from));
    }
  }
  // 値が欄名より前に出力される配置: 「３ 現状に対する評価」の直後の段落、続いて空の欄名「成／果」「「目的」の達成に／向けた取組による／改善状況」。
  const pre = /３ 現状に対する評価\n((?:[^\n]+\n)+)\n成\n果\n\n「目的」の達成に\n向けた取組による\n改善状況\n/.exec(sheet);
  if (!p.outcomes && pre && !/^(?:成|果|「目的」|向けた取組|改善状況|目標値|実績値|達成率)/m.test(pre[1])) {
    const raw = pre[1].trimEnd();
    p.outcomes = joinLines(raw.split('\n'));
    p.evidence.push(evidence(input, raw, s + pre.index + pre[0].indexOf(raw)));
  }
}

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
    texts(input, p, s, sheet, head);
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
  if (process.env.DBG) console.error("pre", out.length, out.filter(p => p.outcomes).length, out.filter(p => p.purpose).length);
  return mergeReprints(out.filter(p => p.amounts.length || !withAmounts.has(p.projectCode)), p => p.projectCode!);
}

export const entries: Record<string, Entry> = {
  '32000': {
    extract: (input) => extractShimane(input),
    scope: '令和7年度「施策評価及び事務事業評価の全文」PDF の事務事業評価シートの事務事業名・担当課・事業費（令和6年度の実績額・令和7年度の当初予算額。施策の事務事業一覧の前年度・今年度の事業費と一致するもののみ）。目的・令和7年度の取組内容・成果（「目的」の達成に向けた取組による改善状況）は欄名と値の並びが確定する配置のシートのみ。施策別 PDF・事務事業の一覧表は全文の再掲のため対象外。KPI（年度列と値の並びが抽出テキストで崩れる）・課題／原因／方向性の文・一般財源は対象外。',
  },
};
