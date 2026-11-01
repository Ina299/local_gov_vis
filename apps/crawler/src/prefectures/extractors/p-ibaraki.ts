import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 茨城県（電源立地地域対策交付金 事業評価報告書、令和4〜6年度）
// 1事業ごとに「Ⅰ．事業評価総括表（令和X年度）」と「Ⅱ．事業評価個表（令和X年度）」が続く。総括表の欄名と値は PDF の段組みで
// 入り交じるため、値の並び順ではなく次の定義上の大小関係で「交付金事業に要した経費」を確定する:
//   交付金充当額 ≦ 交付金事業に要した経費 ≦ 間接交付金事業者の総事業費（市町村事業費）。
const HEAD = 'Ⅰ．事業評価総括表';
const KOHYO = 'Ⅱ．事業評価個表';
const NUM = /(?<![\d,.])(\d{1,3}(?:,\d{3})+)円?(?![\d,.])|(?<=\n)(0)(?=\n)/g;
const reiwa = (s: string) => 2018 + num(s === '元' ? '1' : s);

type N = { raw: string; value: number; start: number };

/** Removes the 文部科学省分＋経済産業省分 breakdown (a pair summing to another value). Null when the removal is ambiguous. */
function withoutBreakdown(nums: N[]): N[] | null {
  const results = new Set<string>(); let chosen: N[] | null = null;
  for (let i = 0; i < nums.length; i++) for (let j = 0; j < nums.length; j++) for (let k = j + 1; k < nums.length; k++) {
    if (i === j || i === k || nums[j].value + nums[k].value !== nums[i].value) continue;
    const rest = nums.filter((_, x) => x !== j && x !== k);
    results.add(rest.map(n => n.value).sort((a, b) => a - b).join(','));
    chosen ??= rest;
  }
  return results.size === 1 ? chosen : null;
}

/** 欄の見出しの断片（段組みで本文の間に出力される）。 */
const LABEL_BITS = /交付金事業|府県又は|市町村の主要|主要政策|施策とその|^策・施策|^とその目標$|^目標$|事業開始年度|成果目標|成果実績|^成果指標$|第三者機関/;
type Span = { text: string; raw: string; at: number };
/** 欄の幅いっぱいの行（表示幅が最長の行の90%以上。半角は0.5字）の後の改行は折り返しとして詰め、それより短い行の後の改行は残す。 */
const displayWidth = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) < 0x100 ? 0.5 : 1), 0);
function joinWrapped(raw: string): string {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const width = Math.max(...lines.map(displayWidth));
  return lines.reduce((a, l, i) => i === 0 ? l : a + (displayWidth(lines[i - 1]) >= width * 0.9 ? '' : '\n') + l, '');
}

/**
 * 「交付金事業の概要」欄: 見出しの直後（空行）から、見出しの断片だけの段落と交付金事業者名などの短い値の段落（1つまで）を飛ばした
 * 次の段落。句点で終わり、見出しの断片を含まない場合のみ。
 */
function overview(kohyo: string, base: number): Span | null {
  const m = /\n交付金事業の概要\n\n/.exec(kohyo);
  if (!m) return null;
  let pos = m.index + m[0].length, shortSkipped = 0;
  for (let guard = 0; guard < 4; guard++) {
    const end = kohyo.indexOf('\n\n', pos);
    if (end < 0) return null;
    const para = kohyo.slice(pos, end);
    const lines = para.split('\n');
    if (lines.every(l => LABEL_BITS.test(l))) { pos = end + 2; continue; }
    if (lines.length === 1 && !para.includes('。') && para.length <= 20 && !shortSkipped) { shortSkipped++; pos = end + 2; continue; }
    if (!/。$/.test(para) || lines.some(l => LABEL_BITS.test(l))) return null;
    return { text: joinWrapped(para), raw: para, at: base + pos };
  }
  return null;
}

/**
 * 「交付金事業の定性的な成果及び評価等」欄: 見出しの後、欄の見出し（成果目標及び成果実績・成果指標・年度）だけの行を飛ばし、
 * 「評価に係る第三者機関等の活用の有無」の直前まで。本文の行に見出しの断片が混ざる場合は収録しない。
 */
function qualitative(kohyo: string, base: number): Span | null {
  const h = '\n交付金事業の定性的な成果及び評価等\n';
  const i = kohyo.indexOf(h);
  const j = kohyo.indexOf('\n評価に係る第三者機関等の活用の有無', i);
  if (i < 0 || j < 0 || kohyo.indexOf(h, i + 1) >= 0) return null;
  let pos = i + h.length;
  for (;;) {
    const nl = kohyo.indexOf('\n', pos);
    if (nl < 0 || nl > j) break;
    const line = kohyo.slice(pos, nl).trim();
    if (line && !/^(?:交付金事業の成果目標及び|交付金事業の成果目|標及び成果実績|成果実績|成果指標|令和[0-9０-９元]+年度)$/.test(line)) break;
    pos = nl + 1;
  }
  const raw = kohyo.slice(pos, j);
  if (!raw.trim() || raw.split('\n').some(l => LABEL_BITS.test(l)) || !/。$/.test(raw.trim())) return null;
  return { text: joinWrapped(raw), raw, at: base + pos };
}

function extractIbaraki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08000' || !input.text.includes(HEAD) || !input.text.includes(KOHYO) || !input.text.includes('交付金事業の名称')) return [];
  const t = input.text;
  const starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, idx) => {
    const end = starts[idx + 1] ?? t.length;
    const sec = t.slice(s, end);
    const fyM = /^Ⅰ．事業評価総括表（令和([0-9０-９]+|元)年度）/.exec(sec);
    const k = sec.indexOf(KOHYO);
    if (!fyM || k < 0) return;
    const fy = reiwa(fyM[1]);
    // 事業名: 個表の冒頭（「交付金事業に関係する」欄の前）で「…事業」「…補助」で終わる行・語がちょうど1つの場合のみ。
    const headEnd = sec.indexOf('交付金事業に関係する', k);
    const head = sec.slice(k, headEnd < 0 ? undefined : headEnd);
    const cands: { name: string; start: number }[] = [];
    for (const m of head.matchAll(/[^\n ]+/g)) {
      const w = m[0];
      if (/(?:事業|補助)(?:（[^）\n]*）)?$/.test(w) && !w.includes('交付金事業') && !/^(?:事業名|措置名)$/.test(w)) cands.push({ name: w, start: s + k + m.index! });
    }
    if (cands.length !== 1) return;
    const { name, start } = cands[0];
    const p = project(input, `R${fy - 2018}-${idx + 1}`, name, null, name, start);
    p.evidence.push(evidence(input, fyM[0], s));
    p.evaluatedFiscalYear = fy;

    // 担当課室: 「交付金事業の担当課室 ○○課」と同じ行に値がある場合はその値。欄名と値が別行の場合は、欄名以降に
    // 課室名の行がちょうど2つ（担当課室・評価課室）あり、両者が同一の場合のみ（異なると対応が確定しない）。
    const lab = sec.indexOf('交付金事業の担当課室', k);
    const inline = lab < 0 ? null : /^交付金事業の担当課室 ([^\s]+(?:課|室))\n/.exec(sec.slice(lab));
    const DEPT = /^(?:茨城県)?[^\s、。，（）]{0,20}?(?:部|庁)[^\s、。，（）]{0,20}?(?:課|室)$/;
    const deptLines = lab < 0 ? [] : [...sec.slice(lab).matchAll(/(?<=\n)[^\n]+(?=\n)/g)].filter(m => DEPT.test(m[0]) && !m[0].includes('交付金'));
    if (inline) {
      p.department = inline[1];
      p.evidence.push(evidence(input, inline[0].trimEnd(), s + lab));
    } else if (deptLines.length === 2 && deptLines[0][0] === deptLines[1][0]) {
      p.department = deptLines[0][0];
      p.evidence.push(evidence(input, deptLines[0][0], s + lab + deptLines[0].index!));
    } else p.warnings.push('個表の担当課室・評価課室の値が一致しない（または欄の対応が確定しない）ため担当課は未収録。');

    // 金額: 総括表の数値から文部科学省分・経済産業省分の内訳を除き、
    //   2値 → 大きい方が「交付金事業に要した経費」（充当額 ≦ 経費）、
    //   3値（間接交付金事業者の総事業費の欄がある場合）→ 中央値が経費（充当額 ≦ 経費 ≦ 総事業費）。
    // 確定した値が個表にも印字されている場合のみ収録。
    const sum = sec.slice(0, k);
    const nums: N[] = [...sum.matchAll(NUM)].map(m => ({ raw: m[1] ?? m[2], value: num(m[1] ?? m[2]), start: s + m.index! }));
    const main = /文部科学省/.test(sum) ? withoutBreakdown(nums) : nums;
    const indirect = /間接交付金事業者\n?の総事業費|事業費/.test(sum.replace(/交付金事業に\n?要\n?した\n?経費/g, ''));
    let cost: N | null = null;
    if (main && !main.some(n => n.value === 0)) {
      const sorted = [...main].sort((x, y) => x.value - y.value);
      if (main.length === 2) cost = sorted[1];
      else if (main.length === 3 && indirect) cost = sorted[1];
    }
    if (cost && sec.slice(k).includes(cost.raw)) {
      p.amounts.push(amount(input, 'actual', fy, cost.raw, '円', cost.raw, cost.start));
      p.warnings.push(`金額は総括表の「交付金事業に要した経費」（令和${fy - 2018}年度、円）。欄名と値の並びが段組みで入り交じるため、交付金充当額 ≦ 経費 ≦ 間接交付金事業者の総事業費 の定義上の大小関係で経費の値を確定し、個表にも同じ値が印字されていることを確認。交付金充当額・間接交付金事業者（市町村）の総事業費は未収録。`);
    } else p.warnings.push('総括表の数値の並びから「交付金事業に要した経費」を一意に確定できない（または個表で照合できない）ため金額は未収録。');
    // 交付金事業の概要・定性的な成果（個表の欄の本文。他の欄の見出しが入り交じる箇所は収録しない）
    const gaiyo = overview(sec.slice(k), s + k);
    if (gaiyo) { p.activities = gaiyo.text; p.evidence.push(evidence(input, gaiyo.raw, gaiyo.at)); }
    const seika = qualitative(sec.slice(k), s + k);
    if (seika) { p.outcomes = seika.text; p.evidence.push(evidence(input, seika.raw, seika.at)); }
    if (/^(?:水戸|日立|常陸太田|高萩|北茨城|ひたちなか|那珂|鉾田|茨城町|東海|大洗)/.test(name) || /間接交付金事業者/.test(sum))
      p.warnings.push('市町村が実施する間接交付金事業の場合、担当課は交付金を所管する県の課。');
    p.warnings.push('電源立地地域対策交付金の事業評価報告書（交付金事業のみ）。県の事業全体ではない。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '08000': {
    extract: (input) => extractIbaraki(input),
    scope: '電源立地地域対策交付金 事業評価報告書（令和4・5・6年度）の交付金事業のみ: 事業名（個表）・対象年度・「交付金事業に要した経費」（円、決算相当）・担当課室（担当と評価の課室が同一の場合）・交付金事業の概要と定性的な成果の本文（他の欄の見出しが入り交じらないもの）。交付金充当額・市町村の総事業費・成果指標（指標名と値の欄が入り交じる）、県総合計画の政策・施策評価資料は対象外。',
  },
};
