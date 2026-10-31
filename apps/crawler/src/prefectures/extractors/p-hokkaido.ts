/**
 * 北海道 基本評価調書（令和７年度。施策ごとのPDF「0101.pdf」…）の後半「事務事業評価調書」。
 * 1行1事業の表（整理番号・重複施策・経費区分・事務事業名・事務事業概要・課・局室名・事業費（千円）・うち一般財源・
 * 前年度からの繰越事業費（千円）・執行体制（本庁・出先機関・人工計）・フルコスト（千円））だが、抽出テキストでは
 * 列が入り交じる。次の条件をすべて満たす事業だけを収録する:
 *  - 金額: 課・局室名の行の直後に整数2〜3個（事業費・一般財源・繰越事業費。並び順は表により異なる）、続いて
 *    本庁・出先機関・人工計（小数1桁、本庁＋出先＝人工計）とフルコストが並び、
 *    フルコスト − 事業費 ＝ 人工計 × 人件費単価（令和７年度 8,175千円/人。四捨五入）の検算が合う整数を事業費とする
 *    （検算が合う値が複数あり互いに異なるときは対象外）;
 *  - 事業名: 前の金額欄の終わりからその課の行までが「[整理番号] 経費区分（一般・維持費・義務費・投資的経費…）
 *    事業名 概要… 課」の形で、それより前には表の見出し・一次評価の方向性などの定型語しかない;
 *  - 事業名の行は1行で完結（空白・句読点を含まず括弧が対応し、表示幅15字以下＝事業名欄の折り返し幅16字に届かない）。
 *  - 課名が2行に割れる場合（「食産業振」「興課」）は、同じ割れ方が文書内に2回以上ある場合に連結する。
 *    3字以下の課名の直前に句読点のない短い行がある場合（「ギー課」「推進局」等の断片の可能性）は対象外。
 * 事業費は令和７年度の予算額とみなす（施策0401・0501・0509・0517など20以上の施策で、施策の「予算額（千円）R7」が
 *  施策内の全事業の事業費の合計と一致することを確認。単位は表頭の（千円））。評価対象年度（evaluatedFiscalYear）は印字がないため未設定。
 * 事業費のない「事務（0予算)」は対象外。令和６年度版（別URLの0601.pdf）は人件費単価・欄構成が異なるため対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const HEAD = '令和７年度\n施策名\n\n基本評価調書';
const SECTION = '事務事業評価調書';
const TITLE = /【(\d\(\d\)[A-ZＡ-Ｚ])_(\d{4})】([^\n]+)/;
/** 人件費単価（千円/人）。フルコスト＝事業費＋人工計×単価 の検算から（11.5人→94,013千円、0.3人→2,453千円 等）。 */
const COST = 8175;
const INT = /^-?\d{1,3}(?:,\d{3})*$/;
const DEC = /^\d{1,3}\.\d$/;
const KUBUN = /^(一般|維持費|義務費|投資的経費(?:[ＡＢAB])?(?:（施設等建設工事費(?:以外)?）)?)(?: (\S+))?$/;
const CODE = /^(?:\d{3,4}|[０-９]{4})$/;
const DEPT = /^[^\s、。・「」（）()0-9０-９]{2,14}(?:課|室|局|センター|事務所)$/;
/** 事業名より前に現れてよい定型語（表の見出し・一次評価の方向性欄など）。 */
const JUNK = new Set(['令和７年度', '事務事業評価調書', '事務事業名', '施策名', '事務事業概要', '課・局', '室名', '前年度から', '事業費',
  'の繰越事業', '（千円）', '費（千円）', '施策コード', '執行体制', 'うち', '一般財源', '本庁', '出先機関', '人工計', 'フル', 'コスト',
  '一次政策評価', '３月末時点における対応', '対応', '方針', '番号', '方向性', '二次政策評価意見', '二次評価意見への対応状況', '翌年度の',
  '整理番号', '重複施策', '経費区分', '分析）', '改善（取組', '改善（指標', '改善', '現状維持', '拡充', '縮小', '廃止', '休止', '終了', '完了', '統合', '-', '－']);

type Tok = { s: string; at: number; num: boolean };

/** 全角1・半角0.5の表示幅 */
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
const balanced = (s: string) => (s.match(/[（(]/g)?.length ?? 0) === (s.match(/[）)]/g)?.length ?? 0) && (s.match(/［/g)?.length ?? 0) === (s.match(/］/g)?.length ?? 0);
const tenths = (s: string) => Math.round(Number(s) * 10);

function tokens(t: string, from: number): Tok[] {
  const out: Tok[] = [];
  let pos = from;
  for (const line of t.slice(from).split('\n')) {
    const s = line.trim();
    if (s) {
      const parts = s.split(' ');
      if (parts.length > 1 && parts.every(p => INT.test(p) || DEC.test(p))) {
        let off = pos + line.indexOf(s);
        for (const p of parts) { out.push({ s: p, at: off, num: true }); off += p.length + 1; }
      } else out.push({ s, at: pos + line.indexOf(s), num: INT.test(s) || DEC.test(s) });
    }
    pos += line.length + 1;
  }
  return out;
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01000') return [];
  const t = input.text;
  if (!t.startsWith(HEAD)) return [];
  const s0 = t.indexOf(SECTION);
  const title = TITLE.exec(t);
  if (s0 < 0 || !title) return [];
  const toks = tokens(t, s0);
  const isInt = (k: number) => toks[k]?.num && INT.test(toks[k].s);
  const isDec = (k: number) => toks[k]?.num && DEC.test(toks[k].s);
  // 課名の割れ（「食産業振」「興課」）の出現回数
  const splits = new Map<string, number>();
  toks.forEach((x, k) => {
    const y = toks[k + 1];
    if (y && /^[^\s、。0-9０-９]{2,8}$/.test(x.s) && /^[^\s、。]{0,4}(?:課|室|局)$/.test(y.s)) splits.set(x.s + y.s, (splits.get(x.s + y.s) ?? 0) + 1);
  });
  const out: ProjectEvaluation[] = [];
  const seen = new Map<string, number>();
  let prevEnd = 0;
  for (let j = 0; j + 3 < toks.length; j++) {
    if (!(isDec(j) && isDec(j + 1) && isDec(j + 2) && isInt(j + 3))) continue;
    if (tenths(toks[j].s) + tenths(toks[j + 1].s) !== tenths(toks[j + 2].s)) continue;
    const fc = toks[j + 3];
    const regionEnd = prevEnd;
    prevEnd = j + 4;
    let k = j;
    while (k > regionEnd && j - k < 3 && isInt(k - 1)) k--;
    if (j - k < 2) continue;
    const labor = Math.floor((tenths(toks[j + 2].s) * COST + 5) / 10);
    const cands = toks.slice(k, j).filter(x => !x.s.startsWith('-') && num(fc.s) - num(x.s) === labor);
    if (!cands.length || new Set(cands.map(x => num(x.s))).size > 1) continue;
    const cost = cands[0];
    if (num(cost.s) === 0) continue;
    // 課 → 事業名 → 経費区分 → 整理番号 の順に遡る
    const region = toks.slice(regionEnd, k);
    let dept: string | null = null, deptTok: Tok[] = [];
    const last = region.at(-1), last2 = region.at(-2);
    const frag = last2 && /^[^\s、。，,0-9０-９]{2,8}$/.test(last2.s);
    if (last && last2 && frag && (splits.get(last2.s + last.s) ?? 0) >= 2 && DEPT.test(last2.s + last.s)) deptTok = [last2, last];
    // 3字以下の課名の直前に句読点のない短い行がある場合は、課名の割れ（「推進局」）と区別できない
    else if (last && DEPT.test(last.s) && !(last.s.length <= 3 && frag)) deptTok = [last];
    if (!deptTok.length) continue;
    dept = deptTok.map(x => x.s).join('');
    const lines = region.slice(0, region.length - deptTok.length);
    const ks = lines.map((x, i) => (KUBUN.test(x.s) ? i : -1)).filter(i => i >= 0);
    if (ks.length !== 1) continue;
    const ki = ks[0], km = KUBUN.exec(lines[ki].s)!;
    const nameTok = km[2] ? { s: km[2], at: lines[ki].at + km[1].length + 1, num: false } : lines[ki + 1];
    let desc = lines.slice(km[2] ? ki + 1 : ki + 2);
    if (!nameTok || desc.some(x => CODE.test(x.s))) continue;
    let name = nameTok.s, nameRaw = name;
    // 事業名の改行（「…事業費」「（需要拡大対策）」）: 括弧だけの短い行は事業名の続きとして連結
    if (desc[0] && /^（[^（）]+）$/.test(desc[0].s) && width(desc[0].s) <= 16) {
      name += desc[0].s;
      nameRaw = t.slice(nameTok.at, desc[0].at + desc[0].s.length);
      desc = desc.slice(1);
    }
    // 概要の1行目が事業名欄の幅（16字）を超えるか句点で終わる場合だけ、事業名の続きではないと判断できる
    if (!desc.length || !(width(desc[0].s) > 16 || /。$/.test(desc[0].s))) continue;
    const head = lines.slice(0, ki).map(x => x.s);
    const page = head.lastIndexOf('（千円）');
    if (page >= 0) head.splice(0, page + 1);
    const codes: string[] = [];
    while (head.length && (CODE.test(head.at(-1)!) || head.at(-1) === '-')) codes.unshift(head.pop()!);
    const code = codes[0] && codes[0] !== '-' ? codes[0] : null;
    if (!head.every(s => JUNK.has(s) || /^[①-⑳]$/.test(s) || s === title[3] || s === title[2])) continue;
    if (/[\s、。]/.test(nameTok.s) || !balanced(name) || width(nameTok.s) > 15 || name.length < 3) continue;
    const id = `${title[2]}-${code ?? ''}-${nfkc(name)}`;
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const p = project(input, `${id}-${seen.get(id)}`, name, 2025, nameRaw, nameTok.at);
    p.department = dept;
    p.evidence.push(evidence(input, HEAD, 0), evidence(input, title[0], title.index));
    p.evidence.push(evidence(input, t.slice(deptTok[0].at, deptTok.at(-1)!.at + deptTok.at(-1)!.s.length), deptTok[0].at));
    const raw = t.slice(toks[k].at, fc.at + fc.s.length);
    p.amounts.push(amount(input, 'budget', 2025, cost.s, '千円', raw, toks[k].at));
    p.warnings.push(`令和７年度基本評価調書（施策${title[2]}「${title[3]}」）の事務事業評価調書の事業費欄（千円）。令和７年度予算額とみなした（施策0401・0501・0509等で、施策の「予算額（千円）R7」と事業費の合計が一致することを確認）。` +
      `事業費の列はフルコスト（${fc.s}千円）−人工計（${toks[j + 2].s}人）×人件費単価8,175千円の検算で特定。`);
    if (code) p.warnings.push(`整理番号 ${code}。`);
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '01000': {
    scope: '令和７年度 基本評価調書（施策別PDF）の事務事業評価調書のうち、事業名・経費区分・課の並びと事業費・執行体制・フルコストの欄が抽出テキストで一意に対応づき、フルコストの検算が合う事業の事業名・課・令和７年度事業費（予算額、千円）。事業費のない事務、令和６年度版、施策評価本体・成果指標は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, extractOne, p => `${p.department}|${nfkc(p.projectName)}|${p.amounts[0]?.amountYen}`),
  },
};
