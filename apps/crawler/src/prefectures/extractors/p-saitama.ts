/**
 * 埼玉県教育委員会「教育委員会の事務に関する点検評価報告書」（令和７年度版＝令和６年度対象、令和８年度版＝令和７年度対象。全体版PDF、
 * pdftotext -layout による段組保持テキスト）の施策ごとの「主な事業」表（事業名・予算額（千円）・事業の概要・実績・事業の自己評価・担当課）。
 * 表の1行（または1事業の小区分の1行）は空行で区切られたまとまりとして出力され、事業名は行頭（字下げなし）に数文字ずつ折り返し、予算額はその右（行頭から21字以内で終わる数値）に出る。
 * 次の条件をすべて満たす事業だけを収録する:
 *  - まとまりの中に行頭の事業名の断片があり（断片どうしの間が2行以内＝1つの事業名）、予算額の数値がちょうど1つ;
 *  - 前後のまとまりが「事業名なしで予算額だけ」または「事業名だけで予算額なし」でない（1事業が小区分ごとに複数の予算額を持つ表、
 *    ページをまたいで事業名と予算額が分かれた行は、小区分の帰属・合計が確定しないため事業ごと対象外。小区分の合算はしない）。
 * 年度は表紙後の「（１）点検評価の対象」に続く「令和N年度「第４期埼玉県教育振興基本計画」」による（予算額の欄に年度の印字はない）。
 * 担当課は、まとまり内の右端の担当課欄に別表「課名略称一覧」の略称がちょうど1種類ある場合に、その表の課名で収録する（再掲の間で読み取りが食い違う事業は担当課を未収録）。
 * 同じ事業の他施策への再掲（「（施策N にも掲載）」）は、事業名（掲載注記を除く）と予算額が一致すれば1件に統合、不一致なら除外。
 * 精度確認（2026-11）: PDF原本の語座標（PyMuPDF）から作った正解表と照合し、統合後の収録 128件（令和7年度版 55件・令和8年度版 73件）の
 * 事業名と予算額がすべて一致（正解表が罫線なしのページで行を取れなかった1件は原本の座標で個別に確認）。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const TITLE = '教育委員会の事務に関する点検評価報告書';
const TARGET = /（１）点検評価の対象\n[^\n]*\n\s*(令和([０-９\d])年度「第４期埼玉県教育振興基本計画」)/;
const STOP = /^(?:施策指標の|学識経験者|今後の取組)|^\s*目標\s+[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\s|^\s*主な事業\s*$/;
/** 予算額: 行頭の事業名の断片（3つ以上の空白を含まない）＋空白＋数値。数値の終わりが行頭から21字以内。 */
const AMOUNT = /^(.*?)( +)(\d{1,3}(?:,\d{3})*)(?= |$)/;
const NOTE = /[（(][^（）()]*にも掲載[）)]$/;

type Line = { text: string; at: number };

/** 別表「課名略称一覧」: 略称 → { 課名, 証跡 } */
function deptTable(t: string): Map<string, { name: string; raw: string; at: number }> {
  const map = new Map<string, { name: string; raw: string; at: number }>();
  const head = t.indexOf('課名略称一覧');
  if (head < 0) return map;
  let pos = t.indexOf('\n', head) + 1;
  for (let i = 0; i < 8 && pos > 0; i++) {
    const end = t.indexOf('\n', pos);
    const line = t.slice(pos, end);
    if (!line.trim()) break;
    const toks = [...line.matchAll(/\S+/g)];
    if (toks.length % 2 === 0 && toks[0][0] !== '課名') {
      for (let k = 0; k < toks.length; k += 2) {
        const a = toks[k], b = toks[k + 1];
        if (!/課$/.test(a[0])) continue;
        map.set(b[0], { name: a[0], raw: line.slice(a.index!, b.index! + b[0].length), at: pos + a.index! });
      }
    }
    pos = end + 1;
  }
  return map;
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.format !== 'pdf' || !t.slice(0, 600).includes(TITLE)) return [];
  const target = TARGET.exec(t);
  if (!target) return [];
  const fy = 2018 + Number(nfkc(target[2]));
  const targetAt = target.index + target[0].indexOf(target[1]);
  const depts = deptTable(t);
  const lines: Line[] = [];
  for (let at = 0; at < t.length;) {
    const end = t.indexOf('\n', at);
    const e = end < 0 ? t.length : end;
    lines.push({ text: t.slice(at, e), at });
    at = e + 1;
  }
  const out: ProjectEvaluation[] = [];
  let seq = 0;
  for (let s = 0; s < lines.length; s++) {
    if (lines[s].text.trim() !== '主な事業') continue;
    let e = s + 1;
    while (e < lines.length && !STOP.test(lines[e].text)) e++;
    // 空行で区切ったまとまり（ページ番号だけの行・表の見出しは除く）
    const groups: Line[][] = [];
    let cur: Line[] = [];
    for (let k = s + 1; k < e; k++) {
      if (!lines[k].text.trim()) { if (cur.length) groups.push(cur); cur = []; } else cur.push(lines[k]);
    }
    if (cur.length) groups.push(cur);
    const unit = groups.flat().find(l => l.text.includes('（千円）'));
    const info = groups.filter(g => !(g.length === 1 && /^\s{15,}\d{1,3}$/.test(g[0].text)) && !g.some(l => l.text.includes('事業名') || l.text.includes('（千円）'))).map(g => {
      const names: { text: string; raw: string; at: number; idx: number }[] = [];
      const amounts: { value: string; at: number }[] = [];
      const abbr = new Set<string>(); const abbrAt: { raw: string; at: number }[] = [];
      g.forEach((l, idx) => {
        let pre = l.text;
        const m = AMOUNT.exec(l.text);
        if (m && m[0].length <= 21 && m[0].length - m[3].length >= 8 && !/ {3,}/.test(m[1])) {
          amounts.push({ value: m[3], at: l.at + m[0].length - m[3].length });
          pre = m[1];
        }
        if (/^\S/.test(pre)) {
          const raw = pre.split(/ {3,}/)[0].trimEnd();
          names.push({ text: raw.replace(/ /g, ''), raw, at: l.at, idx });
        }
        const d = / {2,}(\S+)\s*$/.exec(l.text);
        if (d && d.index + d[0].indexOf(d[1]) > 60 && depts.has(d[1])) { abbr.add(d[1]); abbrAt.push({ raw: d[1], at: l.at + d.index + d[0].indexOf(d[1]) }); }
      });
      const split = names.some((n, i) => i > 0 && n.idx - names[i - 1].idx > 2);
      const salary = g.some(l => { const i = l.text.indexOf('（給与費'); return i >= 0 && i < 25; });
      return { names, amounts, split, abbr, abbrAt, salary };
    });
    info.forEach((g, j) => {
      if (!g.names.length || g.split || g.amounts.length !== 1 || !unit) return;
      const odd = [info[j - 1], info[j + 1]].some(n => n && ((!n.names.length && n.amounts.length) || (n.names.length && !n.amounts.length)));
      if (odd) return;
      const printed = g.names.map(n => n.text).join('');
      const note = NOTE.exec(printed)?.[0] ?? null;
      const name = note ? printed.slice(0, -note.length) : printed;
      if (name.length < 3) return;
      const p = project(input, `${fy}-${++seq}`, name, null, g.names[0].raw, g.names[0].at);
      for (const n of g.names.slice(1)) p.evidence.push(evidence(input, n.raw, n.at));
      p.evaluatedFiscalYear = fy;
      p.evidence.push(evidence(input, target[1], targetAt), evidence(input, '（千円）', unit.at + unit.text.indexOf('（千円）')));
      const a = g.amounts[0];
      p.amounts.push(amount(input, 'budget', fy, a.value, '千円', a.value, a.at));
      if (g.abbr.size === 1) {
        const d = depts.get([...g.abbr][0])!;
        p.department = d.name;
        p.evidence.push(evidence(input, g.abbrAt[0].raw, g.abbrAt[0].at), evidence(input, d.raw, d.at));
      } else p.warnings.push(g.abbr.size ? '担当課欄に複数の課の略称があるため担当課は未収録。' : '担当課欄の略称が確認できないため担当課は未収録。');
      p.warnings.push(`金額は「主な事業」表の「予算額（千円）」欄。予算額の欄に年度・当初/補正の別の印字はなく、「（１）点検評価の対象」の「令和${fy - 2018}年度「第４期埼玉県教育振興基本計画」」により${fy}年度とした。`);
      if (g.salary) p.warnings.push('予算額欄に「（給与費含む）」の注記あり（給与費を含む額）。');
      if (note) p.warnings.push(`原文の事業名には「${note}」の注記あり（他施策への再掲）。`);
      out.push(p);
    });
  }
  // 再掲で担当課欄の読み取りだけが食い違う場合（略称が確認できない欄を含む）は、担当課を未収録にそろえてから統合する
  const key = (p: ProjectEvaluation) => `${p.evaluatedFiscalYear}|${nfkc(p.projectName)}`;
  const byKey = new Map<string, ProjectEvaluation[]>();
  for (const p of out) byKey.set(key(p), [...(byKey.get(key(p)) ?? []), p]);
  for (const g of byKey.values()) {
    if (new Set(g.map(p => p.department)).size < 2) continue;
    for (const p of g) {
      if (p.department) {
        p.evidence = p.evidence.slice(0, -2);
        p.department = null;
      }
      p.warnings = p.warnings.filter(w => !w.startsWith('担当課欄'));
      p.warnings.push('再掲の間で担当課欄の読み取りが一致しないため担当課は未収録。');
    }
  }
  return mergeReprints(out, key);
}

export const entries: Record<string, Entry> = {
  '11000': {
    scope: '教育委員会の事務に関する点検評価報告書（令和７年度版・令和８年度版の全体版）の施策ごとの「主な事業」のうち、事業名と予算額（千円）が段組保持テキストの同じ行のまとまりで1対1に対応する事業の予算額と担当課。小区分ごとに複数の予算額がある事業、ページをまたいで事業名と予算額が分かれた事業、目標別の分冊PDF（全体版と同内容で年度の印字がない）、知事部局の施策評価・主な取組実績は対象外。',
    extract: (input) => extractOne(input),
  },
};
