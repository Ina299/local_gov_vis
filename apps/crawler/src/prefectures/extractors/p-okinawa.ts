/**
 * 沖縄県PDCA実施報告書（「施策」総括表、様式２）の「主な取組の進捗状況（Plan･Do）」欄。
 * 各行は 主な取組（アクティビティ）と（所管部課）・決算見込額・活動指標・進捗状況。抽出テキストでは取組名が数行に折り返され、
 * 行番号が名称の途中に入る。次の条件を満たす行だけを収録する:
 *  - 所管部課の行「(…部…課)」の直前に空行で区切られた連続行のまとまりがあり、その中に行番号（単独行または行頭の「k 」）がちょうど1つ;
 *  - 先頭の活動指標名らしい行（13字超、または（累計）（内訳）で終わる等）を除いた残りの各行が取組名の列幅（12字以下）に収まる。
 * 金額は「決算見込額」（決算額ではない）で、また複数の取組に同じ額が重ねて記載されるため収録しない。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const NL = String.fromCharCode(10);
const HEADER = /主な取組の進捗状況（Plan･Do）\nR(\d)年度\n主な取組\n（アクティビティ）\n（所管部課）\n/g;
const INDICATORISH = /(（累計）|（内訳）|率|数|量)$|^○|^様式|（調$|累$/;
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
    p.warnings.push(`沖縄県PDCA「施策」総括表の主な取組（R${hdr[1]}年度）。取組名は抽出テキストで折り返された行をつないだもの。所管部課は取組名の下の括弧書き。金額欄は「決算見込額」（決算額ではなく、複数の取組に同じ額が重ねて記載される）のため未収録。`);
    out.push(p);
  }
  return mergeReprints(out, p => `${p.evaluatedFiscalYear}|${p.department}|${nfkc(p.projectName)}`);
}

export const entries: Record<string, Entry> = {
  '47000': {
    scope: '沖縄県PDCA実施報告書（対象年度 令和6年度・令和7年度）の「施策」総括表の主な取組の名称と所管部課（取組名の折り返しと行番号の位置から名称が一意に復元できる行のみ）。金額は決算見込額のため対象外。個別の「主な取組」検証票、成果指標、概要版、付属資料は対象外。',
    extract: (input) => extractOne(input),
  },
};
