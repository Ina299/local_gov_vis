import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m14-util';

// ---------------------------------------------------------------- 湯梨浜町（教育行政の点検及び評価 平成21・22年度）
// 公開済みレコードは同じ報告書（6370.pdf・6371.pdf）の「教育委員会点検・評価における主要事業シート」（対象年度＝表紙の年度）。
// シートの「事業のねらい」欄を目的、「事業の概要」欄を事業内容として収録する。担当課の欄が見出しの前後に入る版があるため、
// 見出し「事業のねらい」の後の担当課の行を除き、「事業の概要」の見出しまでを目的とする。見出しの並びが崩れて本文の前に
// 「事業の概要」「取組状況」の見出しが来る版（ねらいの本文が見出しの直後にない版）は採らない。事業内容は目的が取れたシートだけ、
// 「事業の概要」の見出しから「取組状況」の見出しまで。「成果」「自己評価」欄は見出しの1字ずつが本文と混ざるため採らない。
const SHEET = /^(?:教育委員会点検・評価における)?主要事業シート\n/gm;
const NAME = /^事業名(?: |\n\n)?[０-９\d]+[．.]([^\n]+)$/m;
const AIM = /^事業のねらい(?: (.+))?$/;
const OUTLINE = /^事 ?業 ?の ?概 ?要(?: (.+))?$/;
const STATUS = /^取 組 状 況(?: (.+))?$/;
/** 見出し（本文に混ざっていれば欄の範囲が決まらない）。 */
const HEADING = /^(事業名|事業のねらい|事 ?業 ?の ?概 ?要|取 組 状 況|予|算|額|成|果|自|己|評|価|課|題|決|算 額|- ?\d+ ?-)( |$)/;
/** 担当課の欄（「担当課 ○○課」「担当課」とその次の課名の行）。 */
const DEPT = /^(担当課( .+)?|[^\s、。]{2,20}課(（[^）]*）)?)$/;
/** 1字ずつ空白で区切られて出力された行の空白を除く（全角文字の間の空白だけ）。 */
const unspace = (s: string) => s.split('\n').map(l => (l.match(/[^\x00-\x7f] (?=[^\x00-\x7f])/g)?.length ?? 0) >= 5 ? l.replace(/([^\x00-\x7f]) +(?=[^\x00-\x7f])/g, '$1') : l).join('\n');

interface Field { value: string; raw: string; at: number }
/** lines[i] の見出し（同じ行の本文があればそれから）の後、end の見出しまでの本文。空行は見出しの前後だけ。 */
function field(t: string, offsets: number[], lines: string[], i: number, inline: string | undefined, end: RegExp, skipDept: boolean): { f: Field; next: number } | null {
  const body: { line: string; at: number }[] = [];
  if (inline) body.push({ line: inline, at: offsets[i] + lines[i].length - inline.length });
  let j = i + 1, blankAfterBody = false;
  for (; j < lines.length && !end.test(lines[j]); j++) {
    const l = lines[j];
    if (!l.trim()) { if (body.length) blankAfterBody = true; continue; }
    if (skipDept && !body.length && DEPT.test(l)) continue;
    if (blankAfterBody || HEADING.test(l) || DEPT.test(l) && !/[、。]/.test(l) && l.startsWith('担当課')) return null;
    body.push({ line: l, at: offsets[j] });
  }
  if (j >= lines.length || !body.length) return null;
  const first = body[0], last = body[body.length - 1];
  const raw = t.slice(first.at, last.at + last.line.length);
  // 見出しの行に本文が続く場合（inline）の後に担当課などの行が挟まれば、範囲が連続しないため採らない。
  if (raw.split('\n').filter(l => l.trim()).length !== body.length) return null;
  return { f: { value: unspace(unwrap(raw, 3)), raw, at: first.at }, next: j };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '31370' || input.format !== 'pdf' || !/\/uploaded\/attachment\/637[01]\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const cover = /^平成([２-３][０-９])年度\n\n湯梨浜町教育行政の点検及び評価\n/.exec(t);
  if (!cover) return [];
  const fy = 1988 + Number(cover[1].replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xff10)));
  const heads = [...t.matchAll(SHEET)];
  for (let k = 0; k < heads.length; k++) {
    const start = heads[k].index!, end = heads[k + 1]?.index ?? t.length, seg = t.slice(start, end);
    const nm = NAME.exec(seg);
    if (!nm || nm.index > 40) continue;
    const name = nm[1].trim();
    // 2行に折り返した事業名は採らない（次の行が見出し・担当課でない）。
    const after = seg.slice(nm.index + nm[0].length + 1).split('\n')[0];
    if (after && !HEADING.test(after) && !DEPT.test(after)) continue;
    const lines = seg.split('\n'), offsets: number[] = [];
    lines.reduce((pos, l) => (offsets.push(start + pos), pos + l.length + 1), 0);
    const ai = lines.findIndex(l => AIM.test(l));
    if (ai < 0) continue;
    const aim = field(t, offsets, lines, ai, AIM.exec(lines[ai])![1], OUTLINE, true);
    if (!aim) continue;
    const p = project(input, `narrative:${name}`, name, null, nm[0], start + nm.index);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.purpose = aim.f.value;
    p.evidence.push(evidence(input, aim.f.raw, aim.f.at));
    const oi = aim.next, outline = field(t, offsets, lines, oi, OUTLINE.exec(lines[oi])![1], STATUS, false);
    if (outline) {
      p.activities = outline.f.value;
      p.evidence.push(evidence(input, outline.f.raw, outline.f.at));
    }
    p.warnings.push('湯梨浜町 教育行政の点検及び評価（主要事業シート）の「事業のねらい」欄を目的、「事業の概要」欄を事業内容として収録。'
      + '欄の幅での折り返しをつなぎ、1字ずつ空白で区切られて抽出された行は全角文字の間の空白を除いた。成果・自己評価欄は見出しと本文が混ざるため未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '湯梨浜町 教育行政の点検及び評価（平成21・22年度）の主要事業シート: 「事業のねらい」「事業の概要」欄。見出しの並びが崩れた版は対象外。',
};
