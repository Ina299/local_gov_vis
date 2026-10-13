import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import type { EvaluationAmount, EvaluationEvidence, EvaluationFormat, EvaluationIndicator, ProjectEvaluation } from '../../../web/src/types/evaluation.js';

export interface SourceDefinition {
  id: string; municipalityCode: string; municipalityName: string; indexUrl: string;
  allowedHosts: string[]; scope: string; maxDocuments: number;
}
export interface FetchedArtifact { bytes: Uint8Array; fetchedAt: string; sha256: string }
export interface DiscoveredDocument {
  sourceId: string; municipalityCode: string; municipalityName: string;
  url: string; sourcePageUrl: string; format: EvaluationFormat; title: string;
  evaluationYear: number | null; evaluatedFiscalYear: number | null;
}
export interface DiscoveryResult {
  evaluationYear: number | null; sourcePageUrl: string;
  documents: DiscoveredDocument[]; warnings: string[];
}
export interface ParseResult { projects: ProjectEvaluation[]; status: 'ok' | 'partial' | 'unsupported'; message: string }
export interface PdfTextItem { str: string; x: number; y: number; width: number }
export interface PdfTextPage { page: number; text: string; items: PdfTextItem[] }

export const SOURCE_CATALOG: SourceDefinition[] = [
  { id: 'sapporo', municipalityCode: '01100', municipalityName: '札幌市', indexUrl: 'https://www.city.sapporo.jp/somu/hyoka/kekka/index.html', allowedHosts: ['www.city.sapporo.jp'], scope: '最新の公開評価年度の事業評価調書（自己評価）。公式の局別索引を最大30ページたどり、取得上限100文書。外部評価答申は対象外。', maxDocuments: 100 },
  { id: 'odawara', municipalityCode: '14206', municipalityName: '小田原市', indexUrl: 'https://www.city.odawara.kanagawa.jp/field/municipality/administra/gyoukaku/p25884.html', allowedHosts: ['www.city.odawara.kanagawa.jp'], scope: '最新の公開評価年度の本体Excel。現行評価表のみ（見方・旧年度の例は除外）。', maxDocuments: 1 },
  { id: 'misato', municipalityCode: '11237', municipalityName: '三郷市', indexUrl: 'https://www.city.misato.lg.jp/shiseijoho/gyoseihyoka/6673.html', allowedHosts: ['www.city.misato.lg.jp'], scope: '最新の公開評価年度の事務事業HTML。公式の総合計画体系を最大160索引ページたどり、取得上限50文書。', maxDocuments: 50 },
];

const normalized = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();
const compact = (s: string) => normalized(s).replace(/\s/g, '');
export function japaneseFiscalYear(value: string): number | null {
  const s = normalized(value);
  const era = s.match(/(令和|平成|昭和|R|H)\s*(元|\d{1,2})/i);
  if (era) return ({ '令和': 2018, '平成': 1988, '昭和': 1925, R: 2018, H: 1988 }[era[1].toUpperCase()] ?? 0) + (era[2] === '元' ? 1 : Number(era[2]));
  const western = s.match(/\b((?:19|20)\d{2})\s*年度/);
  return western ? Number(western[1]) : null;
}
export function amountToYen(rawValue: string, rawUnit: string): number | null {
  const value = normalized(rawValue).replace(/,/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return null;
  const unit = compact(rawUnit);
  const factor = ({ '円': 1, '千円': 1_000, '万円': 10_000, '百万円': 1_000_000, '億円': 100_000_000 } as Record<string, number>)[unit];
  if (!factor) return null;
  const amount = Number(value) * factor;
  return Number.isFinite(amount) && Math.abs(amount) <= Number.MAX_SAFE_INTEGER ? Math.round(amount) : null;
}
function decodeHtml(bytes: Uint8Array): string {
  const header = new TextDecoder('ascii').decode(bytes.slice(0, 4096));
  return new TextDecoder(/charset\s*=\s*["']?(?:shift[_-]jis|sjis|windows-31j)/i.test(header) ? 'shift_jis' : 'utf-8').decode(bytes);
}
function decodeEntities(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (all, numeric: string | undefined, named: string | undefined) => {
    if (numeric) {
      const n = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : parseInt(numeric, 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[named!.toLowerCase()] ?? all;
  });
}
function visibleText(html: string): string {
  return decodeEntities(html.replace(/<!--[^]*?-->/g, '').replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')).replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
interface Anchor { url: string; title: string }
/** Opening-tag tokenization also handles the legacy Misato index's unclosed anchors. */
function anchors(html: string, pageUrl: string, source: SourceDefinition): Anchor[] {
  const result: Anchor[] = [];
  const tags = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi)];
  for (let i = 0; i < tags.length; i++) {
    const m = tags[i];
    try {
      const u = new URL(decodeEntities(m[1] ?? m[2] ?? m[3]), pageUrl);
      if (u.protocol !== 'https:' || !source.allowedHosts.includes(u.hostname) || u.username || u.password) continue;
      u.hash = '';
      const start = m.index! + m[0].length;
      const closing = html.indexOf('</a', start);
      const next = tags[i + 1]?.index ?? html.length;
      const end = closing >= 0 ? Math.min(closing, next) : next;
      result.push({ url: u.href, title: visibleText(html.slice(start, end)) });
    } catch { /* Ignore non-URL anchors. */ }
  }
  return result;
}
function documentFor(source: SourceDefinition, a: Anchor, sourcePageUrl: string, format: EvaluationFormat, evaluationYear: number | null, evaluatedFiscalYear: number | null): DiscoveredDocument {
  return { sourceId: source.id, municipalityCode: source.municipalityCode, municipalityName: source.municipalityName, url: a.url, sourcePageUrl, format, title: a.title, evaluationYear, evaluatedFiscalYear };
}
export async function discoverDocuments(source: SourceDefinition, fetcher: (url: string) => Promise<FetchedArtifact>): Promise<DiscoveryResult> {
  const warnings: string[] = [];
  const index = decodeHtml((await fetcher(source.indexUrl)).bytes);
  const links = anchors(index, source.indexUrl, source);
  const documents: DiscoveredDocument[] = [];
  let sourcePageUrl = source.indexUrl;
  let evaluationYear: number | null = null;
  if (source.id === 'odawara') {
    const candidates = links.filter(a => /\.xlsx(?:\?|$)/i.test(a.url) && /事務事業評価/.test(a.title)).map(a => ({ ...a, year: japaneseFiscalYear(a.title) })).filter(a => a.year !== null).sort((a, b) => b.year! - a.year!);
    if (!candidates.length) throw new Error('小田原市の公式索引に年度付き評価Excelリンクがありません。');
    evaluationYear = candidates[0].year;
    for (const a of candidates.filter(a => a.year === evaluationYear)) {
      const assessed = a.title.match(/[（(]([^）)]+実施事業分)[）)]/);
      documents.push(documentFor(source, a, sourcePageUrl, 'xlsx', evaluationYear, assessed ? japaneseFiscalYear(assessed[1]) : null));
    }
  } else if (source.id === 'sapporo') {
    const years = links.filter(a => /\/kekka\/documents\/[rh]\d+\.html$/.test(a.url)).map(a => ({ ...a, year: japaneseFiscalYear(a.title) })).filter(a => a.year !== null).sort((a, b) => b.year! - a.year!);
    if (!years.length) throw new Error('札幌市の公式索引に評価年度リンクがありません。');
    evaluationYear = years[0].year;
    sourcePageUrl = years[0].url;
    const yearHtml = decodeHtml((await fetcher(sourcePageUrl)).bytes);
    const assessedText = visibleText(yearHtml).match(/((?:令和|平成)\s*[\d０-９元]+年度)に実施した事業を対象/);
    const assessed = assessedText ? japaneseFiscalYear(assessedText[1]) : null;
    const list = anchors(yearHtml, sourcePageUrl, source).find(a => /事業評価調書を見る/.test(a.title));
    if (!list) throw new Error('最新年度の自己評価調書一覧リンクがありません。');
    const listHtml = decodeHtml((await fetcher(list.url)).bytes);
    const branchRoot = new URL(list.url).pathname.replace(/\.html$/, 'kyoku/');
    const branches = anchors(listHtml, list.url, source).filter(a => new URL(a.url).pathname.startsWith(branchRoot) && /\.html$/.test(a.url));
    const unique = [...new Map(branches.map(a => [a.url, a])).values()];
    if (unique.length > 30) warnings.push('局別索引の探索上限30ページに達しました。全事業網羅ではありません。');
    for (const branch of unique.slice(0, 30)) {
      try {
        const html = decodeHtml((await fetcher(branch.url)).bytes);
        for (const a of anchors(html, branch.url, source).filter(a => /\.pdf(?:\?|$)/i.test(a.url) && new URL(a.url).pathname.startsWith(branchRoot))) documents.push(documentFor(source, a, branch.url, 'pdf', evaluationYear, assessed));
      } catch (error) { warnings.push(`局別索引を取得できません: ${branch.url}: ${String(error)}`); }
    }
  } else if (source.id === 'misato') {
    const years = links.filter(a => /\/section\/disclosure\//.test(a.url) && /事務事業評価結果/.test(a.title)).map(a => ({ ...a, year: japaneseFiscalYear(a.title) })).filter(a => a.year !== null).sort((a, b) => b.year! - a.year!);
    if (!years.length) throw new Error('三郷市の公式索引に年度付き事務事業評価リンクがありません。');
    evaluationYear = years[0].year;
    sourcePageUrl = years[0].url;
    const start = new URL(sourcePageUrl);
    const cycleRoot = start.pathname.match(/^(\/section\/disclosure\/[^/]+\/\d{4}\/)/)?.[1];
    if (!cycleRoot) throw new Error('三郷市の最新公開年度URL形式が未対応です。');
    const pending = [sourcePageUrl];
    const visited = new Set<string>();
    while (pending.length && visited.size < 160) {
      const pageUrl = pending.pop()!;
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);
      try {
        const html = decodeHtml((await fetcher(pageUrl)).bytes);
        const children: string[] = [];
        for (const a of anchors(html, pageUrl, source)) {
          const path = new URL(a.url).pathname;
          if (!path.startsWith(cycleRoot)) continue;
          if (/\/sheet\/proj\/[^/]+\.html$/.test(path)) documents.push(documentFor(source, a, pageUrl, 'html', evaluationYear, null));
          // Only follow strictly deeper policy indexes, never parent or archive links.
          else if (path.includes('/npm/') && path.endsWith('.html') && path.startsWith(new URL(pageUrl).pathname.replace(/\.html$/, '/')) && !visited.has(a.url)) children.push(a.url);
        }
        pending.push(...children.reverse());
      } catch (error) { warnings.push(`体系索引を取得できません: ${pageUrl}: ${String(error)}`); }
    }
    if (pending.length) warnings.push('体系索引の探索上限160ページに達しました。全事業網羅ではありません。');
  } else throw new Error(`未対応の取得元: ${source.id}`);
  const uniqueDocs = [...new Map(documents.map(d => [d.url, d])).values()];
  if (!uniqueDocs.length) throw new Error('最新公開年度の対象文書を発見できませんでした。');
  return { evaluationYear, sourcePageUrl, documents: uniqueDocs, warnings };
}

function evidenceFor(doc: DiscoveredDocument, context: Omit<FetchedArtifact, 'bytes'>, rawText: string, locator: Partial<Pick<EvaluationEvidence, 'page' | 'sheet' | 'cell'>> = {}): EvaluationEvidence {
  return { sourceUrl: doc.url, sourcePageUrl: doc.sourcePageUrl, format: doc.format, fetchedAt: context.fetchedAt, sha256: context.sha256, rawText, page: null, sheet: null, cell: null, ...locator };
}
function baseProject(doc: DiscoveredDocument, projectCode: string | null, projectName: string, evidence: EvaluationEvidence): ProjectEvaluation {
  const key = projectCode ?? createHash('sha256').update(`${doc.url}:${evidence.sheet ?? ''}:${evidence.cell ?? ''}:${projectName}`).digest('hex').slice(0, 12);
  return { id: `${doc.municipalityCode}-${doc.evaluationYear ?? 'unknown'}-${key}`, municipalityCode: doc.municipalityCode, municipalityName: doc.municipalityName, projectCode, projectName, department: null, evaluationYear: doc.evaluationYear, evaluatedFiscalYear: doc.evaluatedFiscalYear, purpose: null, activities: null, outcomes: null, amounts: [], indicators: [], ratings: [], evidence: [evidence], extractionStatus: 'extracted', warnings: [] };
}
const present = (s: string): string | null => /^(?:|[-―－—–]|N\/A)$/i.test(s.trim()) ? null : s;

export function parseOdawaraWorkbook(doc: DiscoveredDocument, workbook: XLSX.WorkBook, context: Omit<FetchedArtifact, 'bytes'>): ParseResult {
  const projects: ProjectEvaluation[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Validate the current layout AND the assessed fiscal year. Never ingest the legacy examples.
    if (!/評価/.test(sheetName) || compact(String(sheet.D1?.v ?? '')) !== '事務事業名' || !compact(String(sheet.G1?.v ?? '')).includes('決算額') || compact(String(sheet.O2?.v ?? '')) !== '方向性') continue;
    const fy = japaneseFiscalYear(String(sheet.G1?.v ?? ''));
    if (fy === null || (doc.evaluatedFiscalYear !== null && fy !== doc.evaluatedFiscalYear)) continue;
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:O2');
    if (range.e.r > 20_000) return { projects: [], status: 'unsupported', message: 'Excelの行数が安全な解析上限20,000行を超えています。' };
    const cellText = (cell: string): string => {
      const v = sheet[cell]?.v;
      return v === undefined || v === null || sheet[cell]?.t === 'e' ? '' : String(v);
    };
    for (let row = 3; row <= range.e.r + 1; row++) {
      const name = cellText(`D${row}`).trim();
      const code = cellText(`A${row}`).trim();
      if (!name || !/^\d+$/.test(cellText(`B${row}`).trim())) continue;
      const raw = Array.from({ length: 15 }, (_, c) => cellText(`${XLSX.utils.encode_col(c)}${row}`)).join('\t');
      const ev = evidenceFor(doc, context, raw, { sheet: sheetName, cell: `A${row}:O${row}` });
      const project = baseProject(doc, code || null, name, ev);
      project.evaluatedFiscalYear = fy;
      project.department = present(cellText(`C${row}`));
      const summary = cellText(`F${row}`);
      const purpose = summary.match(/(?:○|〇)目的[：:]\s*([^]*?)(?=(?:○|〇)(?:対象|実施|内容)|【|$)/);
      project.purpose = purpose?.[1].trim() ?? null;
      // The source intentionally combines purpose, activities, and outcomes in one field.
      project.activities = present(summary);
      project.outcomes = summary.match(/(?:【[^】]*実績】|＜[^＞]*実績＞)([^]*)/)?.[1].trim() ?? null;
      const value = cellText(`G${row}`);
      const unit = compact(cellText('G1')).match(/\((千円|円|百万円)\)/)?.[1] ?? '';
      project.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: amountToYen(value, unit), rawValue: value, rawUnit: unit, evidence: evidenceFor(doc, context, `${cellText('G1')}\n${value}`, { sheet: sheetName, cell: `G${row}` }) });
      const indicator = present(cellText(`H${row}`));
      if (indicator) project.indicators.push({ name: indicator, fiscalYear: fy, target: present(cellText(`I${row}`)), actual: present(cellText(`J${row}`)), unit: indicator.match(/[（(]([^（）()]+)[）)]\s*$/)?.[1] ?? null, evidence: evidenceFor(doc, context, ['H', 'I', 'J', 'K'].map(c => cellText(`${c}${row}`)).join('\t'), { sheet: sheetName, cell: `H${row}:K${row}` }) });
      for (const [column, label] of [['L', '妥当性・有効性'], ['M', '効率性・その他改善点'], ['O', '今後の方向性']] as const) {
        const rating = present(cellText(`${column}${row}`));
        if (rating) project.ratings.push({ kind: 'self', label, value: rating, scale: null, evidence: evidenceFor(doc, context, rating, { sheet: sheetName, cell: `${column}${row}` }) });
      }
      projects.push(project);
    }
  }
  return { projects, status: projects.length ? 'ok' : 'unsupported', message: projects.length ? `現行評価シートから${projects.length}事業を抽出。未掲載の費用区分は未取得（0とはみなしません）。尺度の定義が未掲載の評価は原文を保持。` : '対応する年度・列見出しの現行評価シートがありません。旧年度の見方シートは読み込みません。' };
}

interface HtmlRow { cells: string[]; rawText: string }
function htmlRows(html: string): HtmlRow[] {
  return [...html.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)].map(m => {
    const cells = [...m[1].matchAll(/<(?:td|th)\b[^>]*>([^]*?)<\/(?:td|th)>/gi)].map(c => visibleText(c[1]));
    return { cells, rawText: cells.join('\t') };
  });
}
export function parseMisatoHtml(doc: DiscoveredDocument, html: string, context: Omit<FetchedArtifact, 'bytes'>): ParseResult {
  const tables = [...html.matchAll(/<table\b[^>]*>((?:(?!<table\b)[^])*?)<\/table>/gi)].map(m => htmlRows(m[1]));
  const rows = tables.flat();
  const after = (pattern: RegExp): string | null => {
    for (const r of rows) { const i = r.cells.findIndex(c => pattern.test(compact(c))); if (i >= 0 && i + 1 < r.cells.length) return present(r.cells[i + 1]); }
    return null;
  };
  const name = after(/^事業名$/);
  const code = after(/^事務事業コード$/);
  if (!name || !code) return { projects: [], status: 'unsupported', message: '事務事業名・コードを含む三郷市評価表ではありません。' };
  const raw = rows.map(r => r.rawText).join('\n');
  const ev = evidenceFor(doc, context, raw);
  const p = baseProject(doc, code, name, ev);
  p.department = [after(/^担当部名$/), after(/^担当課名$/)].filter(Boolean).join(' ') || null;
  p.purpose = after(/何の為にやるのか.*目的/);
  p.activities = after(/何をする事業か.*概要/);
  p.outcomes = after(/^実績報告$/);
  const expenditure = tables.find(t => t.some(r => r.cells.some(c => compact(c) === '総事業費(合計)')));
  if (expenditure) {
    const costStart = expenditure.findIndex(r => r.cells.some(c => compact(c) === '総事業費(合計)'));
    const yearsRow = expenditure.slice(costStart + 1).find(r => r.cells.some(c => /年度決算/.test(c)));
    const dataIndex = yearsRow ? expenditure.indexOf(yearsRow) + 1 : -1;
    const values = dataIndex >= 0 ? expenditure[dataIndex]?.cells ?? [] : [];
    const years = yearsRow?.cells.map(c => japaneseFiscalYear(c)) ?? [];
    const unit = visibleText(html).match(/単位[：:]\s*(千円|百万円|円)/)?.[1] ?? '';
    years.forEach((year, i) => {
      if (year === null) return;
      const value = values[i] ?? '';
      p.amounts.push({ kind: 'actual', fiscalYear: year, amountYen: amountToYen(value, unit), rawValue: value, rawUnit: unit, evidence: evidenceFor(doc, context, ['総事業費（合計）', yearsRow!.cells[i], value].join('\n')) });
    });
    const explicitYears = years.filter((year): year is number => year !== null);
    if (explicitYears.length) p.evaluatedFiscalYear = Math.max(...explicitYears);
  }
  for (const table of tables) {
    if (!table.some(r => r.cells.some(c => /^(活動|成果)指標/.test(compact(c))))) continue;
    const field = (label: string): string | null => { const r = table.find(r => compact(r.cells[0] ?? '') === label); return r ? present(r.cells[1] ?? '') : null; };
    const name = field('指標名');
    if (!name) continue;
    const unit = field('単位');
    for (const r of table) {
      if (!/^(令和|平成|昭和)\s*[\d０-９元]+年度$/.test(r.cells[0] ?? '')) continue;
      p.indicators.push({ name, fiscalYear: japaneseFiscalYear(r.cells[0]), target: present(r.cells[1] ?? ''), actual: present(r.cells[2] ?? ''), unit, evidence: evidenceFor(doc, context, [name, r.rawText].join('\n')) });
    }
  }
  const rating = after(/^評価$/);
  if (rating) p.ratings.push({ kind: 'self', label: '評価', value: rating, scale: null, evidence: evidenceFor(doc, context, rating) });
  const direction = after(/^今後の方針\(改善策\)$/);
  if (direction) p.ratings.push({ kind: 'self', label: '今後の方針（改善策）', value: direction, scale: null, evidence: evidenceFor(doc, context, direction) });
  if (!p.amounts.some(a => a.kind === 'actual' && a.amountYen !== null)) { p.extractionStatus = 'partial'; p.warnings.push('決算費用の表構造または単位を確認できません。'); }
  p.warnings.push('評価年度は自治体の公開区分名です。人員・勤務割合を人件費へ換算していません。');
  return { projects: [p], status: p.extractionStatus === 'partial' ? 'partial' : 'ok', message: '三郷市のHTML評価表を抽出。決算年度は表中の明示値、評価年度は公開区分名を保持。' };
}

function itemLines(items: PdfTextItem[]): string {
  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of items) {
    let line = lines.find(l => Math.abs(l.y - item.y) < 2);
    if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  return lines.sort((a, b) => b.y - a.y).map(l => l.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')).join('\n');
}
export function parseSapporoPages(doc: DiscoveredDocument, pages: PdfTextPage[], context: Omit<FetchedArtifact, 'bytes'>): ParseResult {
  const projects: ProjectEvaluation[] = [];
  let unmatched = 0;
  for (const page of pages) {
    const text = page.text;
    if (!/事業評価調書/.test(text)) { unmatched++; continue; }
    const items = page.items.filter(i => i.str.trim());
    const region = (xmin: number, xmax: number, ymin: number, ymax: number) => itemLines(items.filter(i => i.x >= xmin && i.x < xmax && i.y >= ymin && i.y < ymax)).trim();
    // These are source-template coordinates, validated by field labels before use.
    const template = items.some(i => i.str === '事業名' && Math.abs(i.y - 771.12) < 3) && items.some(i => i.str === '事業内容' && Math.abs(i.y - 529.15) < 3);
    if (!template) { unmatched++; continue; }
    const name = region(85, 570, 767, 776);
    const code = region(480, 570, 782, 790).match(/\d+/)?.[0] ?? null;
    if (!name || !code) { unmatched++; continue; }
    const ev = evidenceFor(doc, context, text, { page: page.page });
    const p = baseProject(doc, code, name, ev);
    p.evaluatedFiscalYear = japaneseFiscalYear(region(85, 180, 782, 790));
    p.department = present(region(145, 390, 753, 761));
    p.purpose = present(region(145, 590, 413, 445));
    p.activities = present(region(145, 590, 449, 618));
    // The sheet has goals and indicator values, not an independently labelled outcome narrative.
    p.outcomes = null;
    for (const label of items.filter(i => /年度(?:決算額|予算額)$/.test(normalized(i.str)) && i.x < 100)) {
      const value = region(100, 185, label.y - 2, label.y + 2);
      const unit = region(185, 215, label.y - 2, label.y + 2);
      p.amounts.push({ kind: /決算/.test(label.str) ? 'actual' : 'budget', fiscalYear: japaneseFiscalYear(label.str), amountYen: amountToYen(value, unit), rawValue: value, rawUnit: unit, evidence: evidenceFor(doc, context, region(20, 215, label.y - 2, label.y + 2), { page: page.page }) });
    }
    for (const label of items.filter(i => /^(活動|成果)指標\d+$/.test(i.str))) {
      const headerY = label.y + 4.44;
      const indicatorName = region(205, 436, headerY + 7, headerY + 18);
      if (!indicatorName) continue;
      const headers = items.filter(i => i.x > 200 && Math.abs(i.y - headerY) < 2 && /年度(?:実績|予定)$/.test(i.str)).sort((a, b) => a.x - b.x);
      const byYear = new Map<number, EvaluationIndicator>();
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const fiscalYear = japaneseFiscalYear(header.str);
        if (fiscalYear === null) continue;
        const value = present(region(header.x - 5, (headers[i + 1]?.x ?? 580) - 5, headerY - 18, headerY - 3));
        const indicator = byYear.get(fiscalYear) ?? { name: indicatorName, fiscalYear, target: null, actual: null, unit: null, evidence: evidenceFor(doc, context, region(205, 590, headerY - 18, headerY + 18), { page: page.page }) };
        if (/予定/.test(header.str)) indicator.target = value; else indicator.actual = value;
        if (value?.includes('%') || value?.includes('％')) indicator.unit = '%';
        byYear.set(fiscalYear, indicator);
      }
      p.indicators.push(...byYear.values());
    }
    for (const [number, low, high] of [[1, 192, 222], [2, 87, 115]]) {
      const value = present(region(205, 590, low, high));
      if (value) p.ratings.push({ kind: 'self', label: `指標${number}の評価、未達理由、今後の考え方`, value, scale: null, evidence: evidenceFor(doc, context, value, { page: page.page }) });
    }
      p.warnings.push('人工（正規職員業務量）は金額ではないため人件費へ換算していません。外部評価答申はこの調書に含まれません。');
    projects.push(p);
  }
  if (!projects.length) return { projects: [], status: 'unsupported', message: pages.every(p => p.text.trim().length < 40) ? 'PDFから十分な文字を抽出できません。画像化・符号化・空欄等の原因は確定していません。OCRは実行しません。' : 'テキストPDFですが対応済み札幌市調書の配置と一致しません。誤抽出を避けて未対応とします。' };
  if (unmatched) for (const p of projects) { p.extractionStatus = 'partial'; p.warnings.push(`${unmatched}ページは既知の調書レイアウトではないため未抽出です。`); }
  return { projects, status: unmatched ? 'partial' : 'ok', message: `${pages.length}ページのテキストPDFから${projects.length}事業を抽出。原文・ページ番号を保存。` };
}
export async function parseEvaluationDocument(doc: DiscoveredDocument, bytes: Uint8Array, context: Omit<FetchedArtifact, 'bytes'>): Promise<ParseResult> {
  if (doc.sourceId === 'misato' && doc.format === 'html') return parseMisatoHtml(doc, decodeHtml(bytes), context);
  if (doc.sourceId === 'odawara' && doc.format === 'xlsx') {
    // Inspect ZIP metadata before SheetJS expands the workbook in memory.
    try {
      const entries = new AdmZip(Buffer.from(bytes)).getEntries();
      const uncompressedBytes = entries.reduce((total, entry) => total + entry.header.size, 0);
      if (entries.length > 5_000 || uncompressedBytes > 100 * 1024 * 1024) return { projects: [], status: 'unsupported', message: 'Excel ZIPが解析上限（5,000エントリー・展開後100MiB）を超えています。' };
      if (!entries.some(entry => entry.entryName === '[Content_Types].xml')) return { projects: [], status: 'unsupported', message: 'Office Open XML形式のExcelではありません。' };
      return parseOdawaraWorkbook(doc, XLSX.read(bytes, { type: 'array', cellFormula: false, cellHTML: false }), context);
    } catch (error) { return { projects: [], status: 'unsupported', message: `Excel ZIPを解析できません: ${String(error)}` }; }
  }
  if (doc.sourceId === 'sapporo' && doc.format === 'pdf') {
    if (new TextDecoder('ascii').decode(bytes.slice(0, 5)) !== '%PDF-') return { projects: [], status: 'unsupported', message: 'PDFヘッダーがありません。' };
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false, useSystemFonts: true, disableFontFace: true, maxImageSize: 1_000_000 }).promise;
    try {
      if (pdf.numPages > 100) return { projects: [], status: 'unsupported', message: 'PDFが解析上限100ページを超えています。' };
      const pages: PdfTextPage[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        if (content.items.length > 100_000) return { projects: [], status: 'unsupported', message: 'PDFの1ページあたりテキスト要素が解析上限100,000件を超えています。' };
        const items: PdfTextItem[] = content.items.filter((i): i is Extract<typeof i, { str: string }> => 'str' in i).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width }));
        pages.push({ page: pageNumber, items, text: itemLines(items) });
        page.cleanup();
      }
      return parseSapporoPages(doc, pages, context);
    } finally { await pdf.destroy(); }
  }
  return { projects: [], status: 'unsupported', message: '対応する自治体・文書形式の組み合わせではありません。' };
}
