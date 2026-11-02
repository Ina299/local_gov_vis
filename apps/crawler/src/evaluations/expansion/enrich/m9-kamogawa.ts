import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 鴨川市「事業シート（概要説明書）」令和７年度決算
// 公開済みレコード（款別PDFの事業シートから作成。決算額・指標あり、目的なし）と同じ事業の目的を足す。
// 目的の欄は「目 的（何をどうしたいのか）」の見出しが段組みで本文と混ざって出るため、次の3つの形に限って採る。
//  (A) 「目 的」の行・空行の後に本文の段落があり、空行の後に「（何をどうしたいのか）」の行だけが続く。
//  (B) 本文の段落の直後に「目 的」「（何をどうしたいの」「か）」「対 象」の行が続く（見出しが本文の後に出る形）。
//      直前の空行までに実施の背景の段落が同居することがあるため、段落（句点で終わる行で区切る）が2つなら後ろを、
//      1つなら直前の空行の前の行が句点で終わる（＝背景の段落が別にある）場合だけ採る。
//  (C) 「目 的」の次の行から本文が始まり、2行目の先頭に見出しの「（何をどうしたいの 」が挟まり、「か）」の行で終わる。
//      見出しの断片（定形）だけを除いて行をつなぐ。根拠は見出しを含む原文のまま。
// どの形も、段落の途中の行は欄の幅いっぱい（最長行の3字差まで）で、本文が句点で終わること。事業内容は年度別の列が
// 混ざるため対象外。
const HEAD = '事業シート（概要説明書）\n予算事業名\n';
const SKIP = new Set(['', '上位施策事業名', '根拠法令等']);
const LABEL = /^(実施の背景|係名|担当課名|事務区分|関係個別計画名|この事業の|全体計画|事業開始年度|戦略|該当|×|○|５か年計画上の|事業期間（令和）|目 的)$|【|】/;

interface Field { value: string; raw: string; at: number }

/** 行の並びが段落（句点で終わる行で区切る）として整っているか。段落ごとの行の配列を返す。 */
function paragraphs(lines: string[]): string[][] | null {
  if (!lines.length || lines.some(l => !l.trim() || LABEL.test(l.trim())) || !lines[lines.length - 1].trimEnd().endsWith('。')) return null;
  const width = Math.max(...lines.map(l => l.length)), out: string[][] = [[]];
  for (const l of lines) {
    out[out.length - 1].push(l);
    if (l.trimEnd().endsWith('。')) out.push([]);
  }
  out.pop();
  // 段落の途中の行（最後の行以外）は折り返しなので幅いっぱいであること。
  if (out.some(p => p.slice(0, -1).some(l => l.length < width - 3))) return null;
  return out;
}

function shapeA(t: string, at: number): Field | null {
  const m = /^目 的\n\n([^\n]+(?:\n[^\n]+)*)\n\n（何をどうしたいのか）\n/.exec(t.slice(at));
  if (!m) return null;
  const ps = paragraphs(m[1].split('\n'));
  if (!ps || ps.length !== 1) return null;
  return { value: ps[0].map(l => l.trim()).join(''), raw: m[1], at: at + m[0].indexOf(m[1]) };
}

function shapeB(t: string, at: number): Field | null {
  if (!t.startsWith('目 的\n（何をどうしたいの\nか）\n対 象\n', at)) return null;
  const blank = t.lastIndexOf('\n\n', at - 1);
  if (blank < 0) return null;
  const start = blank + 2, lines = t.slice(start, at - 1).split('\n');
  const ps = paragraphs(lines);
  if (!ps) return null;
  let take: string[];
  if (ps.length === 2) take = ps[1];
  else if (ps.length === 1) {
    const before = t.slice(0, blank).trimEnd(), prev = before.slice(before.lastIndexOf('\n') + 1);
    if (!prev.endsWith('。')) return null;
    take = ps[0];
  } else return null;
  const raw = take.join('\n'), s = at - 1 - raw.length;
  if (t.slice(s, at - 1) !== raw) return null;
  return { value: take.map(l => l.trim()).join(''), raw, at: s };
}

function shapeC(t: string, at: number): Field | null {
  const m = /^目 的\n([^（\n][^\n]*)\n（何をどうしたいの(?: ([^\n]+))?\n((?:[^\n]+\n)*?)\n?か）\n/.exec(t.slice(at));
  if (!m) return null;
  const rest = m[4] ? m[4].replace(/\n$/, '').split('\n') : [];
  const lines = [m[1], ...(m[2] ? [m[2]] : []), ...rest];
  // 見出しの断片のない3行目以降は、2行目までと同じ欄の折り返しであること（別の欄の行が挟まる場合を除く）。
  if (rest.length && !m[2]) return null;
  const ps = paragraphs(lines);
  if (!ps || ps.length !== 1) return null;
  if (!m[2] && lines.length !== 1) return null;
  const raw = m[0].slice('目 的\n'.length, m[0].length - (m[0].endsWith('\n\nか）\n') ? '\n\nか）\n' : '\nか）\n').length);
  return { value: lines.map(l => l.trim()).join(''), raw, at: at + '目 的\n'.length };
}

function sheet(input: CachedInput, t: string, at: number, seg: string): ProjectEvaluation | null {
  if (!/\n令和７年度決算 作成時期\/令和8年6月\n\n事業シート（概要説明書）\n予算事業名\n$/.test(t.slice(Math.max(0, at - 60), at + HEAD.length))) return null;
  const lines = seg.slice(HEAD.length).split('\n');
  const k = lines.findIndex(l => !SKIP.has(l.trim()));
  if (k < 0 || !/^\n?事業開始年度\n/.test(lines.slice(k + 1).join('\n').replace(/^\n+/, '\n'))) return null;
  const name = lines[k].trim();
  const nameAt = at + HEAD.length + lines.slice(0, k).join('\n').length + (k ? 1 : 0);
  const fields = [...seg.matchAll(/\n目 的\n/g)].map(m => at + m.index! + 1)
    .map(pos => shapeA(t, pos) ?? shapeB(t, pos) ?? shapeC(t, pos)).filter((f): f is Field => !!f);
  if (fields.length !== 1 || [...seg.matchAll(/\n目 的\n/g)].length !== 1) return null;
  const f = fields[0];
  const p = project(input, `${name}:purpose`, name, null, lines[k], nameAt);
  p.evaluatedFiscalYear = 2025;
  p.purpose = f.value;
  p.evidence.push(evidence(input, f.raw, f.at));
  p.warnings.push('鴨川市 事業シート（概要説明書、令和７年度決算）の「目的（何をどうしたいのか）」欄。見出しの断片「（何をどうしたいの」が本文に挟まる形は、その断片だけを除いて行をつないだ。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12223' || input.format !== 'pdf' || !/\/uploaded\/attachment\/\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, starts = [...t.matchAll(/事業シート（概要説明書）\n予算事業名\n/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const p = sheet(input, t, s, t.slice(s, starts[i + 1] ?? t.length));
    if (p) out.push(p);
  });
  // 同じ資料に同名の事業シートが2つ以上あれば、どちらの目的か判別できないため捨てる。
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '鴨川市 事業シート（概要説明書、令和７年度決算）の目的欄（見出しの位置が確定する形のみ）。公開済みの事業シート由来レコードの補強用。' };
