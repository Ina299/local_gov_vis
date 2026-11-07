import { createHash } from 'node:crypto';
import type { EvaluationDataset, EvaluationEvidence, ProjectEvaluation } from '../../../web/src/types/evaluation';

export const KOMORO_PDF = 'https://www.city.komoro.lg.jp/material/files/group/4/R8ippankaikei.pdf';
export const KOMORO_PAGE = 'https://www.city.komoro.lg.jp/soshikikarasagasu/somubu/zaiseika/3/2/3/17447.html';
export const KOMORO_SHA = 'a7ff5c20d1e70d0b9937eb70149baea672ddaf40515b49e14d30732b1bad4bb6';
export interface BudgetText { text: string; x: number; y: number; width: number }
export interface BudgetPage { page: number; items: BudgetText[] }
export interface BudgetSnapshot { sourceUrl: string; sha256: string; fetchedAt: string; pages: BudgetPage[] }
const compact = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
function requireValue<T>(value: T | undefined, message: string): T { if (value === undefined) throw new Error(message); return value; }
function rowsOf(page: BudgetPage): BudgetText[][] {
  const rows: BudgetText[][] = [];
  for (const item of [...page.items].sort((a, b) => b.y - a.y)) {
    if (!rows.length || Math.abs(rows.at(-1)![0].y - item.y) > 2) rows.push([]);
    rows.at(-1)!.push(item);
  }
  return rows.map(row => row.sort((a, b) => a.x - b.x));
}
const textOf = (row: BudgetText[]) => row.map(w => w.text).join(' ');
const numberOf = (text: string) => {
  if (!/^\d{1,3}(,\d{3})*$|^\d+$/.test(text)) throw new Error(`Invalid budget amount: ${text}`);
  return Number(text.replace(/,/g, ''));
};

/** Pinned official PDF layout. No inferred amounts: unmatched rows or totals fail the import. */
export function extractKomoroBudget(snapshot: BudgetSnapshot): EvaluationDataset {
  if (snapshot.sourceUrl !== KOMORO_PDF || snapshot.sha256 !== KOMORO_SHA || !Number.isFinite(Date.parse(snapshot.fetchedAt))) throw new Error('Unreviewed Komoro PDF');
  const page = (n: number) => requireValue(snapshot.pages.find(p => p.page === n), `Missing PDF page ${n}`);
  if (!compact(textOf(page(1).items)).includes('令和8年度小諸市一般会計予算')) throw new Error('Wrong budget year/account');
  const evidence = (n: number, text: string): EvaluationEvidence => ({ sourceUrl: KOMORO_PDF, sourcePageUrl: KOMORO_PAGE,
    format: 'pdf', fetchedAt: snapshot.fetchedAt, sha256: snapshot.sha256, rawText: text, page: n, sheet: null, cell: null });
  const projects: ProjectEvaluation[] = [];
  let category = '', item = '', headerEvidence: EvaluationEvidence | undefined;
  for (let n = 32; n <= 181; n++) {
    const rows = rowsOf(page(n));
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      if (row.some(w => w.text === '（款）')) {
        category = row.filter(w => w.x >= 89 && w.x < 260).map(w => w.text).join('');
        item = row.filter(w => w.x >= 318 && w.x < 590).map(w => w.text).join('');
        headerEvidence = evidence(n, textOf(row));
      }
      // The unmarked gender-equality line is aligned with ◎ headings. Reserve is a separate budget line.
      const marker = row.find(w => w.x > 599 && w.x < 602 && (w.text.startsWith('◎') || w.text === '男女共同参画推進事業'));
      const reserve = n === 181 && row.find(w => w.x < 90 && w.y < 490 && w.text === '予備費');
      if (!marker && !reserve) continue;
      if (!category || !item || !headerEvidence) throw new Error(`Missing classification on page ${n}`);
      let name = marker?.text.replace(/^◎/, '') ?? '予備費';
      const amountIn = (r: BudgetText[]) => r.filter(w => reserve ? w.x > 100 && w.x + w.width < 145 : w.x > 750 && w.x + w.width > 800);
      let values = amountIn(row), rawText = textOf(row);
      if (!values.length && marker) {
        const next = rows[ri + 1] ?? [];
        const continuation = next.filter(w => w.x >= 600 && w.x + w.width < 770);
        if (!continuation.length || continuation.some(w => /^[◎・\d]/.test(w.text))) throw new Error(`Invalid wrapped heading on page ${n}`);
        name += continuation.map(w => w.text).join('');
        values = amountIn(next); rawText += '\n' + textOf(next);
      }
      if (values.length !== 1) throw new Error(`Ambiguous amount on page ${n}: ${name}`);
      const amount = numberOf(values[0].text), proof = evidence(n, rawText);
      const id = createHash('sha256').update(`${category}:${item}:${name}`).digest('hex').slice(0,24);
      projects.push({ id: `komoro-initial-2026-${id}`, municipalityCode: '20208', municipalityName: '小諸市',
        initialBudget: { fiscalYear: 2026, account: '一般会計', category, item },
        projectCode: null, projectName: name, department: null, evaluationYear: null, evaluatedFiscalYear: null,
        purpose: null, activities: null, outcomes: null, indicators: [], ratings: [], extractionStatus: 'partial',
        amounts: [{ kind: 'budget', fiscalYear: 2026, amountYen: amount * 1000, rawValue: values[0].text, rawUnit: '千円', evidence: proof }],
        evidence: [proof, headerEvidence, evidence(1, textOf(page(1).items))],
        warnings: ['令和8年度一般会計当初予算書の歳出事項別明細書。予算額であり決算額・事業評価ではありません。款・項は予算分類で、所管課ではありません。予備費を含みます。'] });
    }
  }
  if (projects.length !== 249 || new Set(projects.map(p => p.id)).size !== 249) throw new Error(`Unexpected budget line count: ${projects.length}`);
  // Independently read the current-year column of the official summary on PDF page 9.
  const totals = new Map<string, number>();
  for (const row of rowsOf(page(9))) {
    const label = row.filter(w => w.x > 60 && w.x < 270).map(w => w.text).join('');
    const amount = row.find(w => w.x > 280 && w.x + w.width < 350 && /^[\d,]+$/.test(w.text));
    if (label && amount) totals.set(compact(label), numberOf(amount.text));
  }
  for (const category of Array.from(new Set(projects.map(p => p.initialBudget!.category)))) {
    const sum = projects.filter(p => p.initialBudget!.category === category).reduce((s,p) => s + p.amounts[0].amountYen! / 1000, 0);
    if (sum !== totals.get(category)) throw new Error(`Category total mismatch: ${category} ${sum} != ${totals.get(category)}`);
  }
  if (projects.reduce((s,p) => s + p.amounts[0].amountYen!, 0) !== 23_700_000_000) throw new Error('General account total mismatch');
  return { schemaVersion: 1, generatedAt: snapshot.fetchedAt, projects, sources: [{ id: 'komoro-initial-budget-2026',
    municipalityCode: '20208', municipalityName: '小諸市', sourcePageUrl: KOMORO_PAGE, evaluationYear: null, status: 'partial',
    discoveredDocuments: 1, fetchedDocuments: 1, extractedProjects: projects.length,
    scope: '令和8年度一般会計当初予算。歳出事項別明細書の事業別金額（予備費を含む249件）。特別会計、決算額、事業評価は対象外。',
    message: '公式PDFの座標から抽出。14款の合計と歳出総額237億円を照合。',
    lastAttemptAt: snapshot.fetchedAt, lastSuccessAt: snapshot.fetchedAt,
    documents: [{ url: KOMORO_PDF, format: 'pdf', status: 'partial', sha256: snapshot.sha256, fetchedAt: snapshot.fetchedAt,
      projectCount: projects.length, message: 'PDF 32〜181ページ。金額の単位は千円。' }] }] };
}
