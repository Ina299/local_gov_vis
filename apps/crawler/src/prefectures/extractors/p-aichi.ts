/**
 * 愛知県 管理事業評価調書（令和6年度＝6年度対象、令和7年度＝7年度対象。局別PDF、1管理事業1ページ）。
 * 各ページの事業コード・事業名・所属名と「従事人員・経費等」表を収録する。
 *
 * 経費表は 4列（予算額 Y年度（当初）／Y-1年度（当初）／決算額 Y-1年度／Y-2年度）× 4行（人件費(a)／事業費(b)／公債費(c)／計）。
 * 抽出テキストでは各列が「N 千円」4行のかたまりとして出力され、続いて受益者負担額4値・一般財源等4値が1値ずつ並ぶ。
 * 列の対応は次の条件をすべて満たすときだけ確定とする:
 *  - かたまりが4つあり、どれも (a)+(b)+(c)=計（決算列は四捨五入差±2千円まで、原文注記による）;
 *  - 列順の候補は、4つのかたまりが連続して出力された場合は出力順、1つだけ後ろに離れて出力された場合は
 *    「離れたかたまりが先頭列」「末尾列」の2通り。一般財源等・受益者負担額（列順に並ぶ1値の行）について
 *    一般財源等≦計、一般財源等＋受益者負担額≦計＋2 を満たす候補が1つだけのとき採用;
 *  - 同じ事業コードの両年度の調書があれば、令和7年度調書の「6年度（当初）」「5年度決算」の計が
 *    令和6年度調書の同じ列の計と一致すること（一致しなければ両年度とも金額を収録しない。候補が2つ残った
 *    ページはこの照合で1つに絞れた場合のみ採用）。
 * 収録する金額: 予算列の事業費(b)＝budget、決算列の事業費(b)＝actual・人件費(a)＝personnel・計＝fullCost（0 は収録しない）。
 * 管理事業評価結果一覧・当初予算への反映状況（億円単位の一覧）は調書と同じ事業の再掲のため対象外。
 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const CODE = '23000';
const PAGE = /令和\s?[0-9０-９]+年度 管理事業評価調書[（(]\s?[0-9０-９]+年度対象[）)]/g;

type Block = { values: number[]; raws: string[]; start: number; raw: string; line: number };
type Col = { fy: number; kind: 'budget' | 'actual'; block: Block };
type Page = {
  input: CachedInput; start: number; text: string; header: string; code: string; codeRaw: { raw: string; start: number };
  name: string; nameRaw: { raw: string; start: number }; dept: string | null; deptRaw: { raw: string; start: number } | null;
  year: number; reiwa: number; candidates: Block[][]; cols: Block[] | null; warnings: string[]; overlap?: boolean;
};

const toNum = (raw: string) => (raw.startsWith('△') ? -1 : 1) * Number(raw.replace(/[△,]/g, ''));

const LABELS = new Set(['事業コード', '事業名', '評価責任者', '作成責任者', '所属名', '政策名', '施策名', 'ダイヤルイン']);
/**
 * 事業コード・事業名: 見出し行（事業コード〜評価責任者）の配置は数通り。名称は (1) 空行の後に置かれ「評価責任者」の直前に空行なしで続く行、
 * (2)「事業名」ラベル直後の行（前後が空行）、(3) 見出し間にラベル以外の行が「4桁コード」と名称の2行だけある場合のその名称行。
 */
function identity(text: string): { code: string; codeAt: number; name: string; nameAt: number } | null {
  const a = text.indexOf('\n事業コード\n'), b = text.indexOf('\n評価責任者\n');
  if (a < 0 || b < a) return null;
  const region = text.slice(a + 1, b + 1);
  const lines: { s: string; at: number }[] = [];
  let off = a + 1;
  for (const s of region.split('\n')) { if (s.trim()) lines.push({ s, at: off }); off += s.length + 1; }
  const codes = lines.filter(l => /^\d{4}$/.test(l.s));
  if (codes.length !== 1) return null;
  const before = /\n([^\n]+)\n評価責任者\n/.exec(text.slice(a, b + '\n評価責任者\n'.length));
  let name: { s: string; at: number } | undefined;
  const after = /\n事業名\n\n([^\n]+)\n\n/.exec(text.slice(a, b + 1));
  const ok = (s: string) => !LABELS.has(s.trim()) && !/^\d+$/.test(s) && !/課長|責任者/.test(s);
  if (before && ok(before[1]) && text.slice(0, a + before.index).endsWith('\n')) name = lines.find(l => l.at === a + before.index + 1);
  else if (after && ok(after[1])) name = lines.find(l => l.at === a + after.index + '\n事業名\n\n'.length);
  else {
    const rest = lines.filter(l => !LABELS.has(l.s.trim()) && l !== codes[0]);
    if (rest.length === 1) name = rest[0];
  }
  if (!name || !name.s.trim() || /責任者|所属名|千円|人 \(/.test(name.s) || /(?:局|部|課|室)$/.test(name.s.trim())) return null;
  return { code: codes[0].s, codeAt: codes[0].at, name: name.s, nameAt: name.at };
}

function parsePage(input: CachedInput, start: number, text: string): Page | null {
  const h = /^令和\s?([0-9０-９]+)年度 管理事業評価調書[（(]\s?([0-9０-９]+)年度対象[）)]/.exec(text);
  if (!h || nfkc(h[1]) !== nfkc(h[2])) return null;
  const reiwa = Number(nfkc(h[1]));
  const id = identity(text);
  if (!id) return null;
  const { code, name } = id;
  const codeOff = start + id.codeAt, nameOff = start + id.nameAt;
  const page: Page = { input, start, text, header: h[0], code, codeRaw: { raw: code, start: codeOff }, name, nameRaw: { raw: name, start: nameOff },
    dept: null, deptRaw: null, year: 2018 + reiwa, reiwa, candidates: [], cols: null, warnings: [] };
  // 所属名: 値の行（折り返しは空行なしで続く）。末尾が組織名で終わる場合のみ。
  const d = /\n所属名\n\n([^\n]+(?:\n[^\n]+)?)\n\n/.exec(text);
  if (d) {
    const v = d[1].replace(/\n/g, '');
    if (/^[^\s]+(?:課|室|局|部|所|庁|本部|センター|事務局|委員会)$/.test(v) && !/政策名|施策名|事業目的|評価責任者|ダイヤルイン/.test(v)) {
      page.dept = v; page.deptRaw = { raw: d[1], start: start + d.index + '\n所属名\n\n'.length };
    }
  }
  if (!page.dept) page.warnings.push('所属名の値が抽出テキストで一意に読めないため所管課は未収録。');

  // 経費表のかたまり
  const lines: { s: string; off: number }[] = [];
  let off = 0;
  for (const s of text.split('\n')) { lines.push({ s, off }); off += s.length + 1; }
  const blocks: Block[] = [];
  let cur: { i: number; raw: string }[] = [];
  const flush = () => {
    if (cur.length) {
      const first = lines[cur[0].i], last = lines[cur[cur.length - 1].i];
      blocks.push({ values: cur.map(c => toNum(c.raw)), raws: cur.map(c => c.raw), start: start + first.off, raw: text.slice(first.off, last.off + last.s.length), line: cur[0].i });
    }
    cur = [];
  };
  lines.forEach((l, i) => {
    const m = /^(△?\d{1,3}(?:,\d{3})*) 千円$/.exec(l.s);
    if (!m) return;
    if (cur.length && cur[cur.length - 1].i !== i - 1) flush();
    cur.push({ i, raw: m[1] });
  });
  flush();
  const sig = blocks.map(b => (b.values.length === 4 ? 'Q' : b.values.length === 1 ? 'S' : 'X')).join('');
  const quads = blocks.filter(b => b.values.length === 4), singles = blocks.filter(b => b.values.length === 1).map(b => b.values[0]);
  if (sig !== 'QQQQSSSSSSSS' && sig !== 'QQQSSSSSSSSQ') { page.warnings.push('経費表の値のかたまりが4列×4行の形で出力されていないため金額は未収録。'); return page; }
  // 年度見出しの確認
  const y0 = reiwa, n = (s: string) => nfkc(text).includes(nfkc(s));
  if (!n(`予算額`) || !n(`${y0}年度（当初）`) || !n(`${y0 - 1}年度（当初）`) || !n('決算額（C/F)') || !n(`\n${y0 - 1}年度\n`) || !n(`\n${y0 - 2}年度\n`)) {
    page.warnings.push('経費表の年度見出しが確認できないため金額は未収録。'); return page;
  }
  const sumOk = quads.every(q => Math.abs(q.values[0] + q.values[1] + q.values[2] - q.values[3]) <= 2);
  if (!sumOk) { page.warnings.push('経費表の人件費(a)＋事業費(b)＋公債費(c)＝計の検算が合わないため金額は未収録。'); return page; }
  const rec = singles.slice(0, 4), gen = singles.slice(4, 8);
  const fits = (order: Block[]) => order.every((q, i) => gen[i] <= q.values[3] && gen[i] + rec[i] <= q.values[3] + 2 && gen[i] >= 0 && rec[i] >= 0);
  const cands: Block[][] = sig === 'QQQQSSSSSSSS' ? [quads] : [[quads[3], quads[0], quads[1], quads[2]], [quads[0], quads[1], quads[2], quads[3]]];
  page.candidates = cands.filter(fits);
  if (page.candidates.length === 1) page.cols = page.candidates[0];
  return page;
}

function pagesOf(input: CachedInput): Page[] {
  if (input.municipalityCode !== CODE || input.format !== 'pdf') return [];
  const t = input.text;
  const starts = [...t.matchAll(PAGE)].map(m => m.index!);
  return starts.map((s, i) => parsePage(input, s, t.slice(s, starts[i + 1] ?? t.length))).filter((p): p is Page => !!p);
}

let cache: { key: string; pages: Page[] } | null = null;
function allPages(inputs: CachedInput[]): Page[] {
  const key = inputs.map(i => i.sourceSha256).join();
  if (cache?.key === key) return cache.pages;
  const pages = [...inputs].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).flatMap(pagesOf);
  // 同じ年度・同じ事業コードの重複ページ（同一資料の再掲）は最初の1件のみ。
  const seen = new Map<string, Page>();
  const keep: Page[] = [];
  for (const p of pages) {
    const k = `${p.code}|${p.year}`;
    const old = seen.get(k);
    if (!old) { seen.set(k, p); keep.push(p); continue; }
  }
  // 年度間の照合
  const byCode = new Map<string, Page[]>();
  for (const p of keep) byCode.set(p.code, [...(byCode.get(p.code) ?? []), p]);
  for (const ps of byCode.values()) {
    const p7 = ps.find(p => p.reiwa === 7), p6 = ps.find(p => p.reiwa === 6);
    if (!p7 || !p6) continue;
    const agree = (c7: Block[], c6: Block[]) => c7[1].values[3] === c6[0].values[3] && Math.abs(c7[3].values[3] - c6[2].values[3]) <= 2;
    const pairs = p7.candidates.flatMap(c7 => p6.candidates.filter(c6 => agree(c7, c6)).map(c6 => [c7, c6] as const));
    if (pairs.length === 1) {
      p7.cols = pairs[0][0]; p6.cols = pairs[0][1]; p6.overlap = true;
      const note = '同じ事業コードの令和6年度・令和7年度調書で「6年度（当初）」「5年度決算」の計が一致することを確認。';
      p7.warnings.push(note); p6.warnings.push(note);
    } else if (!pairs.length && p7.candidates.length && p6.candidates.length) {
      p7.cols = null; p6.cols = null;
      const note = '令和6年度・令和7年度の調書の間で共通する列（6年度当初・5年度決算）の計が一致しない（または列の対応が一意に決まらない）ため金額は未収録。';
      p7.warnings.push(note); p6.warnings.push(note);
    }
  }
  for (const p of keep) if (!p.cols && p.candidates.length > 1 && !p.warnings.some(w => w.includes('未収録')))
    p.warnings.push('経費表の列のかたまりの出力順から列の対応が一意に決まらないため金額は未収録。');
  for (const p of keep) if (!p.cols && p.candidates.length === 0 && !p.warnings.some(w => w.includes('未収録')))
    p.warnings.push('一般財源等・受益者負担額と計の関係から列の対応が確認できないため金額は未収録。');
  cache = { key, pages: keep };
  return keep;
}

function record(p: Page): ProjectEvaluation {
  const { input } = p;
  const r = project(input, p.code, p.name, p.year, p.codeRaw.raw, p.codeRaw.start);
  r.evidence.push(evidence(input, p.header, p.start), evidence(input, p.nameRaw.raw, p.nameRaw.start));
  r.evaluatedFiscalYear = p.year;
  if (p.dept && p.deptRaw) { r.department = p.dept; r.evidence.push(evidence(input, p.deptRaw.raw, p.deptRaw.start)); }
  if (p.cols) {
    const y = p.year;
    const cols: Col[] = [{ fy: y, kind: 'budget', block: p.cols[0] }, { fy: y - 1, kind: 'budget', block: p.cols[1] },
      { fy: y - 1, kind: 'actual', block: p.cols[2] }, { fy: y - 2, kind: 'actual', block: p.cols[3] }];
    const out: EvaluationAmount[] = [];
    for (const c of cols) {
      // 令和7年度調書と照合済みの事業は、重なる列（6年度当初・5年度決算）を令和7年度調書の記録にだけ収録する。
      if (p.overlap && ((c.kind === 'budget' && c.fy === y) || (c.kind === 'actual' && c.fy === y - 1))) continue;
      const [pa, pb, , pt] = c.block.values;
      if (pb > 0) out.push(amount(input, c.kind, c.fy, c.block.raws[1], '千円', c.block.raw, c.block.start));
      if (c.kind === 'actual') {
        if (pa > 0) out.push(amount(input, 'personnel', c.fy, c.block.raws[0], '千円', c.block.raw, c.block.start));
        if (pt > 0) out.push(amount(input, 'fullCost', c.fy, c.block.raws[3], '千円', c.block.raw, c.block.start));
      }
    }
    r.amounts.push(...out);
    if (p.overlap) r.warnings.push(`${p.reiwa}年度（当初）・${p.reiwa - 1}年度決算は令和7年度調書の同じ事業の記録に収録（同じ年度の金額の二重計上を避けるため本記録では省略）。`);
    r.warnings.push(`金額は「従事人員・経費等」表（千円）。予算額 ${p.reiwa}年度（当初）・${p.reiwa - 1}年度（当初）の事業費(b)を budget、決算額 ${p.reiwa - 1}年度・${p.reiwa - 2}年度の事業費(b)を actual、人件費(a)を personnel、計(a)+(b)+(c)（公債費を含む）を fullCost として収録。0 の値は収録していない。`);
  }
  r.warnings.push(...p.warnings);
  return r;
}

export const entries: Record<string, Entry> = {
  [CODE]: {
    scope: '管理事業評価調書（令和6年度・令和7年度、局別PDF）の事業コード・事業名・所属名と「従事人員・経費等」表（予算額2年度分・決算額2年度分の事業費・人件費・計）。列の対応が検算と一般財源等の大小関係・年度間照合で確定したページのみ金額を収録。評価結果一覧・当初予算反映状況の一覧、指標・評価区分の文章は対象外。',
    extract: (input, inputs) => allPages(inputs).filter(p => p.input.sourceId === input.sourceId).map(record),
  },
};
