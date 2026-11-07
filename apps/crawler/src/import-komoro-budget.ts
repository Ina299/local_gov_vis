/** Offline replay by default; --pdf <downloaded official PDF> refreshes the pinned text snapshot. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractKomoroBudget, KOMORO_PDF, KOMORO_SHA, type BudgetSnapshot } from './evaluations/komoro-budget';
import { importSupplementalEvaluations } from './evaluations/supplemental-integration';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const snapshotPath = join(root, 'data/evaluations/komoro-budget-2026.json');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--pdf')) throw new Error('Use import:komoro-budget [--pdf <official PDF path>]');
let snapshot: BudgetSnapshot;
if (args.length) {
  const bytes = await readFile(resolve(args[1]));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== KOMORO_SHA) throw new Error('Official PDF changed; review layout and totals before importing');
  const pdf = await getDocument({ data: new Uint8Array(bytes), verbosity: 0, useSystemFonts: true,
    cMapUrl: join(root, 'node_modules/pdfjs-dist/cmaps/'), cMapPacked: true }).promise;
  snapshot = { sourceUrl: KOMORO_PDF, sha256, fetchedAt: new Date().toISOString(), pages: [] };
  for (const n of [1,9,...Array.from({ length: 150 }, (_, i) => i + 32)]) {
    const page = await pdf.getPage(n), text = await page.getTextContent();
    snapshot.pages.push({ page: n, items: text.items.flatMap(item => 'str' in item && item.str.trim()
      ? [{ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width }] : []) });
  }
  await pdf.destroy();
  extractKomoroBudget(snapshot); // Reject partial extraction before persisting anything.
  // Reuse acquisition metadata for the exact same PDF, making repeat imports idempotent.
  try { const old: BudgetSnapshot = JSON.parse(await readFile(snapshotPath, 'utf8')); if (old.sha256 === sha256) snapshot.fetchedAt = old.fetchedAt; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await writeFile(snapshotPath, JSON.stringify(snapshot) + '\n');
} else snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const dataset = extractKomoroBudget(snapshot);
const sourceDirectory = join(root, 'apps/crawler/output/komoro-budget/import');
await mkdir(sourceDirectory, { recursive: true });
await writeFile(join(sourceDirectory, '20208.json'), JSON.stringify(dataset) + '\n');
await importSupplementalEvaluations({ root, sourceDirectory, generatedAt: dataset.generatedAt });
console.log(JSON.stringify({ municipality: '小諸市', fiscalYear: 2026, budgetLines: dataset.projects.length,
  amountYen: dataset.projects.reduce((sum, p) => sum + p.amounts[0].amountYen!, 0), officialPdfSha256: snapshot.sha256 }));
