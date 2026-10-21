import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const KOTO_LIST = '7f27e16566f18fc7157c9048';
const KOTO_TITLE = '令和７年度 施策別事務事業評価結果一覧';
const NAME_HEADER = '\n事務事業名称\n';
const BUDGET7 = '７年度\n予算額\n（千円）\n';
const BUDGET6 = '６年度\n予算額\n（千円）\n';
const DIRECTION = /^(?:(?:△ )?[\d.]+%|皆増|皆減)? ?(維持|新規|レベルアップ|見直し|廃止(?:（[^）\n]+）)?)(?: [〇－])?$/;

interface Line { text: string; start: number }
interface Row { kind: 'heading' | 'project'; code: string; name: string; line: Line; amount7: Line; amount6: Line; direction: Line | null; directionValue: string | null; page: number }

function lines(text: string, from: number, to: number): Line[] {
  const out: Line[] = []; let pos = from;
  for (const text0 of text.slice(from, to).split('\n')) { out.push({ text: text0, start: pos }); pos += text0.length + 1; }
  return out;
}
/** Runs of thousand-yen figures (one figure per line, runs split by any other line) in [from, to). */
function numberRuns(text: string, from: number, to: number): Line[][] {
  const runs: Line[][] = []; let cur: Line[] = [];
  for (const l of lines(text, from, to)) {
    if (/^[\d,]+$/.test(l.text)) cur.push(l);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs;
}
/** The two budget columns: either each run follows its own header, or both headers come first and the runs follow in header order. */
function budgetColumns(text: string, from: number, to: number): [Line[], Line[]] | null {
  const h7 = text.indexOf(BUDGET7, from), h6 = text.indexOf(BUDGET6, from);
  if (h7 < 0 || h6 < 0 || h7 >= to || h6 >= to) return null;
  const after = (h: number) => numberRuns(text, h, to)[0];
  if (h7 < h6 && !numberRuns(text, h7, h6).length) {
    const runs = numberRuns(text, h6, to);
    return runs.length >= 2 ? [runs[0], runs[1]] : null;
  }
  const b7 = after(h7), b6 = after(h6);
  return b7 && b6 ? [b7, b6] : null;
}

/** Koto: per-project rows of the 令和7年度 list (names, two budget columns, 改善方向), cross-checked by 取組方針 subtotals. */
function extractKoto(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== KOTO_LIST || input.municipalityCode !== '13108') return [];
  const text = input.text, titleAt = text.indexOf(KOTO_TITLE);
  if (titleAt < 0) return [];
  const pageStarts: number[] = [];
  for (let i = text.indexOf(NAME_HEADER, titleAt); i >= 0; i = text.indexOf(NAME_HEADER, i + 1)) pageStarts.push(i);
  const rows: Row[] = [], badPages = new Set<number>();
  pageStarts.forEach((pageStart, page) => {
    const pageEnd = pageStarts[page + 1] ?? text.length;
    const nameLines: { line: Line; kind: Row['kind']; code: string; name: string }[] = [];
    let ok = true;
    for (const l of lines(text, pageStart + NAME_HEADER.length, pageEnd)) {
      if (l.text === '改善の視点' || l.text === '７年度' || l.text === '６年度') break;
      if (l.text === '') continue;
      const heading = l.text.match(/^(\d{2}|\d{4})([^\d\s].*)$/), item = l.text.match(/^(?:[♦♥] )?(\d{1,3}) (\S.*)$/);
      if (heading) nameLines.push({ line: l, kind: 'heading', code: heading[1], name: heading[2] });
      else if (l.text === '総計') nameLines.push({ line: l, kind: 'heading', code: '', name: l.text });
      else if (item) nameLines.push({ line: l, kind: 'project', code: item[1], name: item[2] });
      else ok = false; // wrapped name or broken column order
    }
    const cols = budgetColumns(text, pageStart, pageEnd);
    if (!ok || !cols) { badPages.add(page); return; }
    const [b7, b6] = cols;
    if ( b7.length !== nameLines.length || b6.length !== nameLines.length) { badPages.add(page); return; }
    // 改善方向 labels are one per project row in reading order; anything else leaves ratings out for the page.
    const regionStart = Math.max(b7.at(-1)!.start, b6.at(-1)!.start);
    const directions = lines(text, regionStart, pageEnd).map(l => ({ l, m: l.text.match(DIRECTION) })).filter(x => x.m);
    const projects = nameLines.filter(n => n.kind === 'project');
    const useDirections = directions.length === projects.length;
    let p = 0;
    nameLines.forEach((n, i) => {
      const d = n.kind === 'project' && useDirections ? directions[p++] : null;
      rows.push({ kind: n.kind, code: n.code, name: n.name, line: n.line, amount7: b7[i], amount6: b6[i], direction: d?.l ?? null, directionValue: d?.m![1] ?? null, page });
    });
    if (useDirections) {
      // 新規 must have no 6年度 budget and 廃止 no 7年度 budget; otherwise the column order is not trusted.
      // A 前年比 printed on the same line as the label must also match that row's two budgets.
      const pageRows = rows.filter(r => r.page === page && r.kind === 'project');
      const yen = (l: Line) => Number(l.text.replaceAll(',', ''));
      const ratioMismatch = (r: Row) => {
        const t = r.direction!.text, pct = t.match(/^(△ )?([\d.]+)%/), a7 = yen(r.amount7), a6 = yen(r.amount6);
        if (t.startsWith('皆増')) return a6 !== 0 || a7 === 0;
        if (t.startsWith('皆減')) return a7 !== 0 || a6 === 0;
        if (!pct) return false;
        if (a6 === 0) return true;
        return Math.abs((pct[1] ? -1 : 1) * Number(pct[2]) - (a7 / a6 - 1) * 100) > 0.051;
      };
      if (pageRows.some(r => (r.directionValue === '新規' && r.amount6.text !== '0') || (r.directionValue!.startsWith('廃止') && r.amount7.text !== '0') || ratioMismatch(r)))
        for (const r of pageRows) { r.direction = null; r.directionValue = null; }
    }
  });
  const num = (l: Line) => Number(l.text.replaceAll(',', ''));
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const head = rows[i];
    if (head.kind !== 'heading' || head.code.length !== 4) continue;
    const members: Row[] = [];
    for (let j = i + 1; j < rows.length && rows[j].kind === 'project'; j++) members.push(rows[j]);
    if (!members.length) continue;
    // A subtotal spanning a skipped page cannot be checked, since its rows are missing from `rows`.
    const pages = new Set([head.page, ...members.map(m => m.page)]);
    const spanOk = [...pages].every((pg, k, all) => !k || pg === all[k - 1] + 1) && ![...pages].some(pg => badPages.has(pg));
    const sum7 = members.reduce((s, m) => s + num(m.amount7), 0), sum6 = members.reduce((s, m) => s + num(m.amount6), 0);
    // If the group runs to the end of a page, the following page must have been parsed (else members may be missing).
    const last = members.at(-1)!.page, next = rows[i + 1 + members.length];
    const groupEndsCleanly = next ? next.page === last || (next.page === last + 1 && next.kind === 'heading') : !badPages.has(last + 1) && last + 1 >= pageStarts.length;
    if (!spanOk || !groupEndsCleanly || sum7 !== num(head.amount7) || sum6 !== num(head.amount6)) continue;
    for (const m of members) {
      const name = m.name.replace(/※\d+$/, '');
      const pr = project(input, `${head.code}-${m.code}`, name, null, m.line.text, m.line.start);
      pr.evidence.push(evidence(input, KOTO_TITLE, titleAt), evidence(input, head.line.text, head.line.start));
      pr.amounts.push(
        { kind: 'budget', fiscalYear: 2025, amountYen: num(m.amount7) * 1000, rawValue: m.amount7.text, rawUnit: '千円', evidence: evidence(input, m.amount7.text, m.amount7.start) },
        { kind: 'budget', fiscalYear: 2024, amountYen: num(m.amount6) * 1000, rawValue: m.amount6.text, rawUnit: '千円', evidence: evidence(input, m.amount6.text, m.amount6.start) });
      if (m.direction) pr.ratings.push({ kind: 'self', label: '改善方向', value: m.directionValue!, scale: '維持／新規／レベルアップ／見直し／廃止（廃止（事業終了）等を含む）', evidence: evidence(input, m.direction.text, m.direction.start) });
      pr.warnings.push('施策別事務事業評価結果一覧の行。事業名・７年度/６年度予算額（千円、令和7年度一覧の列見出しから）と改善方向のみ。予算額の列対応は取組方針ごとの小計と行の合計が一致することで確認。担当課・指標・決算額はこの一覧に無い。評価年度は資料上「令和７年度」一覧とされる一方、報告書は令和6年度行政評価結果のため null とした。'
        + (m.direction ? '' : '改善方向は段組み崩れで行との対応が確定できないため未収録。'));
      const key = name, old = out.get(key);
      if (old) {
        if (old.amounts[0].amountYen !== pr.amounts[0].amountYen || old.amounts[1].amountYen !== pr.amounts[1].amountYen || old.ratings[0]?.value !== pr.ratings[0]?.value) conflicts.add(key);
        else old.evidence.push(evidence(input, m.line.text, m.line.start));
      } else out.set(key, pr);
    }
  }
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, v]) => v);
}

/** 日野市 (13212) is intentionally absent: its batch-7 H24 citizen-evaluation list duplicates the 31 records already structured. */
export const kotoHinoEntries: Record<string, Entry> = {
  '13108': { extract: extractKoto, scope: '令和７年度 施策別事務事業評価結果一覧（行政評価結果報告書3章）の事務事業行のみ構造化（事業名・７/６年度予算額・改善方向）。取組方針の小計と合計が一致しない群、段組み崩れのページ、施策評価・計画の実現シート・事業の見直し・新たな取り組み一覧は対象外。' },
};
