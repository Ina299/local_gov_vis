/**
 * 沖縄県PDCA実施報告書（「施策」総括表、様式２）の「主な取組の進捗状況（Plan･Do）」欄。
 * 各行は 主な取組（アクティビティ）と（所管部課）・決算見込額・活動指標・進捗状況。抽出テキストでは取組名が数行に折り返され、
 * 行番号が名称の途中に入る。次の条件を満たす行だけを収録する:
 *  - 所管部課の行「(…部…課)」の直前に空行で区切られた連続行のまとまりがあり、その中に行番号（単独行または行頭の「k 」）がちょうど1つ;
 *  - 先頭の活動指標名らしい行（13字超、または（累計）（内訳）で終わる等）を除いた残りの各行が取組名の列幅（12字以下）に収まる。
 * 金額は「決算見込額」（決算額ではない）で、また複数の取組に同じ額が重ねて記載されるため収録しない。
 * 活動指標（目標・実績）・活動概要・進捗状況の欄は抽出テキストで行の順に並ばない（ある行の活動概要が前後の行の値の間に入る）ため、
 * 行ごとには対応づけない。進捗状況だけは、表の全行が同じ値のときに限りその値を各行に収録する。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const NL = String.fromCharCode(10);
const HEADER = /主な取組の進捗状況（Plan･Do）\nR(\d)年度\n主な取組\n（アクティビティ）\n（所管部課）\n/g;
/** 進捗状況の区分（主な取組の進捗割合の欄見出しの順）。 */
const PROGRESS = ['順調', '概ね順調', 'やや遅れ', '大幅遅れ', '未着手'];
const INDICATORISH =/(（累計）|（内訳）|率|数|量)$|^○|^様式|（調$|累$/;
/** 表示幅（半角は0.5字）。 */
const width = (s: string) => [...s].reduce((w, c) => w + (/[ -~｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

type Line = { text: string; start: number };

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '47000' || !input.text.includes('「施策」総括表')) return [];
  const t = input.text;
  const headers = [...t.matchAll(HEADER)];
  if (!headers.length) return [];
  const lines: Line[] = []; let pos = 0;
  for (const l of t.split(NL)) { lines.push({ text: l, start: pos }); pos += l.length + 1; }
  const out: ProjectEvaluation[] = [];
  // 進捗状況: 表（見出しから「成果指標の達成状況」まで）の進捗状況の欄は抽出テキストで行の順に並ばないため、
  // 欄の値が表の全行で同じ（値の数＝所管部課の行の数）ときだけ、その値を各行の進捗状況とする。
  const progress = new Map<number, Line | null>();
  for (const h of headers) {
    const end = t.indexOf('成果指標の達成状況', h.index!);
    const rows = lines.filter(l => l.start > h.index! && (end < 0 || l.start < end));
    const vals = rows.filter(l => PROGRESS.includes(l.text));
    const depts = rows.filter(l => /^\(.*部/.test(l.text) && !/^\(Do/.test(l.text)).length;
    progress.set(h.index!, end > 0 && vals.length > 0 && vals.length === depts && vals.every(v => v.text === vals[0].text) ? vals[0] : null);
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].text;
    if (!/^\(.*部/.test(l) || /^\(Do/.test(l)) continue;
    // 所管部課（2行に折り返す場合あり）
    let j = i, dept = l;
    while (!dept.endsWith(')') && j < i + 2 && lines[j + 1]?.text.trim()) { j++; dept += lines[j].text; }
    if (!/^\([^()]+\)$/.test(dept) || !/(課|室|局|所|センター|庁)\)$/.test(dept)) continue;
    const hdr = [...headers].reverse().find(h => h.index! < lines[i].start);
    if (!hdr) continue;
    // 取組名のまとまり（空行まで遡る）
    let k = i - 1; const blk: Line[] = [];
    while (k >= 0 && lines[k].text.trim() !== '') { blk.unshift(lines[k]); k--; }
    while (blk.length && (width(blk[0].text) > 13 || INDICATORISH.test(blk[0].text.trim()))) blk.shift();
    if (!blk.length || blk.length > 6) continue;
    const idx = blk.map((b, n) => ({ n, m: /^(\d{1,2})(?: (.+))?$/.exec(b.text) })).filter(x => x.m);
    if (idx.length !== 1) continue;
    const parts: Line[] = [];
    let ok = true;
    for (const [n, b] of blk.entries()) {
      let s = b.text, off = b.start;
      if (n === idx[0].n) { if (!idx[0].m![2]) continue; s = idx[0].m![2]; off = b.start + b.text.indexOf(s); }
      if (width(s) > 12 || INDICATORISH.test(s.trim()) || /[。]/.test(s) || s.trim() !== s) { ok = false; break; }
      parts.push({ text: s, start: off });
    }
    if (!ok || !parts.length) continue;
    // 折り返した行（最後の行以外）は列幅いっぱい（9.5字以上）のはず。短い行や「（」「の」で始まる先頭行は指標名の断片の可能性があるため除外。
    if (parts.slice(0, -1).some(x => width(x.text) < 9.5) || /^[（(の）)、]/.test(parts[0].text)) continue;
    const name = parts.map(x => x.text).join('');
    if (width(name) < 4) continue;
    const fy = 2018 + Number(hdr[1]);
    const rowNo = idx[0].m![1];
    const p = project(input, `${hdr.index}-${rowNo}-${nfkc(name)}`, name, null, parts[0].text, parts[0].start);
    for (const x of parts.slice(1)) p.evidence.push(evidence(input, x.text, x.start));
    p.evidence.push(evidence(input, blk[idx[0].n].text, blk[idx[0].n].start), evidence(input, hdr[0].trimEnd(), hdr.index!));
    const deptRaw = j === i ? l : t.slice(lines[i].start, lines[j].start + lines[j].text.length);
    p.department = dept.slice(1, -1);
    p.evidence.push(evidence(input, deptRaw, lines[i].start));
    p.evaluatedFiscalYear = fy;
    const pr = progress.get(hdr.index!);
    if (pr) {
      p.ratings.push({ kind: 'self', label: '進捗状況', value: pr.text, scale: PROGRESS.join('／'), evidence: evidence(input, pr.text, pr.start) });
      p.warnings.push('進捗状況は、同じ表の進捗状況の欄がすべて同じ値の場合のみ収録（抽出テキストでは欄の値が行の順に並ばないため、根拠の位置は同じ表の同じ値の欄）。');
    }
    p.warnings.push(`沖縄県PDCA「施策」総括表の主な取組（R${hdr[1]}年度）。取組名は抽出テキストで折り返された行をつないだもの。所管部課は取組名の下の括弧書き。金額欄は「決算見込額」（決算額ではなく、複数の取組に同じ額が重ねて記載される）のため未収録。`);
    out.push(p);
  }
  const key = (p: ProjectEvaluation) => `${p.evaluatedFiscalYear}|${p.department}|${nfkc(p.projectName)}`;
  // 再掲の間で進捗状況が食い違う（一方の表でだけ確定した場合を含む）ときは、記録は残して進捗状況だけ外す。
  const groups = new Map<string, ProjectEvaluation[]>();
  for (const p of out) groups.set(key(p), [...(groups.get(key(p)) ?? []), p]);
  for (const g of groups.values()) {
    if (new Set(g.map(p => p.ratings.map(r => r.value).join())).size < 2) continue;
    for (const p of g) { p.ratings = []; p.warnings = p.warnings.filter(w => !w.startsWith('進捗状況は')); }
  }
  return mergeReprints(out, key);
}

export const entries: Record<string, Entry> = {
  '47000': {
    scope: '沖縄県PDCA実施報告書（対象年度 令和6年度・令和7年度）の「施策」総括表の主な取組の名称と所管部課（取組名の折り返しと行番号の位置から名称が一意に復元できる行のみ）と、表の全行で同じ値の場合の進捗状況。金額は決算見込額のため対象外。活動指標・活動概要は欄の値が行の順に並ばないため対象外。個別の「主な取組」検証票、成果指標、概要版、付属資料は対象外。',
    extract: (input) => extractOne(input),
  },
};
