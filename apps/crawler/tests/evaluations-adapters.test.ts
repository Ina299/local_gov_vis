import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { amountToYen, discoverDocuments, japaneseFiscalYear, parseEvaluationDocument, parseMisatoHtml, parseOdawaraWorkbook, parseSapporoPages, SOURCE_CATALOG, type DiscoveredDocument, type PdfTextPage } from '../src/evaluations/adapters.js';

const fixtures = fileURLToPath(new URL('./fixtures/evaluations/', import.meta.url));
const json = async (name: string) => JSON.parse(await readFile(`${fixtures}${name}`, 'utf8'));
const provenance = await json('provenance.json');
function doc(sourceId: string, format: 'html' | 'xlsx' | 'pdf'): DiscoveredDocument {
  const source = SOURCE_CATALOG.find(s => s.id === sourceId)!;
  const original = provenance.find((p: { file: string }) => p.file === `${sourceId}.${format === 'html' ? 'html' : format}`);
  return { sourceId, municipalityCode: source.municipalityCode, municipalityName: source.municipalityName, url: original.url, sourcePageUrl: original.sourcePageUrl, format, title: '原本からの検証用抜粋', evaluationYear: sourceId === 'misato' ? 2024 : 2025, evaluatedFiscalYear: sourceId === 'misato' ? null : 2024 };
}
function context(sourceId: string) {
  const p = provenance.find((p: { file: string }) => p.file.startsWith(`${sourceId}.`));
  return { fetchedAt: p.fetchedAt, sha256: p.sha256 };
}

test('fiscal years use official era labels, including fullwidth digits; money preserves missing vs zero', () => {
  assert.equal(japaneseFiscalYear('令和７年度事務事業評価（令和６年度実施事業分）'), 2025);
  assert.equal(japaneseFiscalYear('R６\r\n決算額\r\n(千円)'), 2024);
  assert.equal(japaneseFiscalYear('令和元年度'), 2019);
  assert.equal(japaneseFiscalYear('平成30年度'), 2018);
  assert.equal(japaneseFiscalYear('更新日 2026年10月10日'), null);
  assert.equal(amountToYen('14,838', '千円'), 14_838_000);
  assert.equal(amountToYen('0', '円'), 0);
  for (const raw of ['', '-', '－', '非公表', '12万円']) assert.equal(amountToYen(raw, '千円'), null);
  assert.equal(amountToYen('0.65', '人工'), null);
});

test('latest official anchors only: no guessed current year, archive crawl, or document-cap truncation', async () => {
  const pages: Record<string, string> = await json('discovery-pages.json');
  for (const fragment of Object.values(pages)) assert.doesNotMatch(fragment, /<(?:html|head|body|script|style|iframe|form)\b|\son\w+\s*=|javascript:/i);
  for (const source of SOURCE_CATALOG) {
    const visited: string[] = [];
    const result = await discoverDocuments({ ...source, maxDocuments: 1 }, async url => {
      visited.push(url);
      assert.ok(pages[url] !== undefined, `unexpected navigation ${url}`);
      const bytes = Buffer.from(pages[url]);
      return { bytes, fetchedAt: '2026-10-10T18:21:00.000Z', sha256: createHash('sha256').update(bytes).digest('hex') };
    });
    assert.equal(result.evaluationYear, source.id === 'misato' ? 2024 : 2025);
    assert.ok(result.documents.length >= (source.id === 'odawara' ? 1 : 2));
    assert.ok(visited.every(url => !/\/r[1-5](?:RE)?\//.test(url) && !/\/r[1-6]\.html$/.test(url)));
    assert.ok(result.documents.every(d => d.evaluationYear === result.evaluationYear));
    if (source.id === 'sapporo') assert.ok(result.documents.some(d => d.url.endsWith('/20251070154.pdf') && d.evaluatedFiscalYear === 2024));
    if (source.id === 'odawara') assert.equal(result.documents[0].url, doc('odawara', 'xlsx').url);
    if (source.id === 'misato') assert.ok(result.documents.some(d => d.url === doc('misato', 'html').url));
  }
});

test('discovery ignores javascript and external links, including misleading latest-year labels', async () => {
  const source = SOURCE_CATALOG.find(s => s.id === 'odawara')!;
  const pages = await json('discovery-pages.json');
  const poisoned = pages[source.indexUrl] + '<a href="https://evil.example/data.xlsx">令和99年度事務事業評価</a><a href="javascript:alert(1)">令和99年度事務事業評価</a>';
  const result = await discoverDocuments(source, async url => { assert.equal(url, source.indexUrl); return { bytes: Buffer.from(poisoned), ...context('odawara') }; });
  assert.equal(result.evaluationYear, 2025);
  assert.equal(result.documents.length, 1);
});

test('real Odawara cell fixture preserves 44,806 thousand yen, zero, missing project codes and local ratings', async () => {
  const fixture = await json('odawara-cells.json');
  const workbook: XLSX.WorkBook = { SheetNames: [fixture.sheetName, '見方'], Sheets: { [fixture.sheetName]: fixture.cells, '見方': fixture.legacySheet } };
  const result = parseOdawaraWorkbook(doc('odawara', 'xlsx'), workbook, context('odawara'));
  assert.equal(result.status, 'ok');
  assert.equal(result.projects.length, 8);
  const first = result.projects[0];
  assert.equal(first.projectName, '広報紙発刊事業');
  assert.equal(first.evaluationYear, 2025);
  assert.equal(first.evaluatedFiscalYear, 2024);
  assert.equal(first.amounts.find(a => a.kind === 'actual')?.amountYen, 44_806_000);
  assert.equal(first.amounts.find(a => a.kind === 'actual')?.evidence.cell, 'G3');
  assert.equal(first.amounts.find(a => a.kind === 'personnel'), undefined);
  assert.equal(first.indicators[0].target, '900000');
  assert.equal(first.indicators[0].actual, '900000');
  assert.equal(first.ratings.find(r => r.label === '今後の方向性')?.value, '①継続実施');
  assert.equal(first.ratings.find(r => r.label === '今後の方向性')?.scale, null);
  const zero = result.projects.find(p => p.projectName === '市長への提案事業')!;
  assert.equal(zero.amounts.find(a => a.kind === 'actual')?.amountYen, 0);
  const noCode = result.projects.find(p => p.projectName === 'デジタル化によるまちづくり推進事業')!;
  assert.equal(noCode.projectCode, null);
  assert.ok(noCode.id);
  assert.ok(result.projects.every(p => !p.projectName.includes('プロダクティブ')));
  const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const runtime = await parseEvaluationDocument(doc('odawara', 'xlsx'), bytes, context('odawara'));
  assert.equal(runtime.projects.length, 8);
});

test('XLSX zip metadata limits stop declared expansion before spreadsheet parsing', async () => {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  const bytes = zip.toBuffer();
  // Central-directory uncompressed size (offset 24) is inspected without inflating.
  const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central >= 0);
  bytes.writeUInt32LE(101 * 1024 * 1024, central + 24);
  const result = await parseEvaluationDocument(doc('odawara', 'xlsx'), bytes, context('odawara'));
  assert.equal(result.status, 'unsupported');
  assert.match(result.message, /100MiB/);
});

test('real Misato HTML keeps yen, annual goals/results, self narrative, future blanks and original anomaly', async () => {
  const html = await readFile(`${fixtures}misato-project.html`, 'utf8');
  assert.doesNotMatch(html, /<(?:html|head|body|script|style|iframe|form)\b|\son\w+\s*=|javascript:/i);
  const result = parseMisatoHtml(doc('misato', 'html'), html, context('misato'));
  assert.equal(result.status, 'ok');
  const p = result.projects[0];
  assert.equal(p.projectName, '広報事業');
  assert.equal(p.department, '企画政策部 広報広聴課');
  assert.equal(p.evaluatedFiscalYear, 2024);
  assert.equal(p.amounts.find(a => a.kind === 'actual')?.amountYen, 21_574_621);
  assert.equal(p.amounts.find(a => a.kind === 'fullCost'), undefined);
  assert.equal(p.indicators.find(i => i.name === '市民への情報提供' && i.fiscalYear === 2024)?.actual, '56527');
  assert.equal(p.indicators.find(i => i.name === '市民への情報提供' && i.fiscalYear === 2025)?.actual, null);
  // Keep the city's published 52.21; do not "repair" it to agree with its 94.68% attainment.
  assert.equal(p.indicators.find(i => i.name === '広報配布率の増加。' && i.fiscalYear === 2022)?.actual, '52.21');
  assert.ok(p.ratings.every(r => r.kind === 'self' && r.scale === null));
  assert.ok(p.outcomes?.includes('696,000部'));
  assert.equal(p.evidence[0].sha256, context('misato').sha256);
  const runtime = await parseEvaluationDocument(doc('misato', 'html'), Buffer.from(html), context('misato'));
  assert.equal(runtime.projects[0].projectName, p.projectName);
});

test('real Sapporo text-PDF coordinates preserve independent fiscal years, costs and score targets', async () => {
  const pages: PdfTextPage[] = await json('sapporo-text-pages.json');
  const result = parseSapporoPages(doc('sapporo', 'pdf'), pages, context('sapporo'));
  assert.equal(result.status, 'ok');
  const p = result.projects[0];
  assert.equal(p.projectName, '組織活性化推進費');
  assert.equal(p.projectCode, '70154');
  assert.equal(p.evaluationYear, 2025);
  assert.equal(p.evaluatedFiscalYear, 2024);
  assert.equal(p.amounts.find(a => a.kind === 'actual' && a.fiscalYear === 2024)?.amountYen, 14_838_000);
  assert.equal(p.amounts.find(a => a.kind === 'budget' && a.fiscalYear === 2024)?.amountYen, 10_845_000);
  assert.equal(p.amounts.find(a => a.kind === 'personnel'), undefined);
  const score = p.indicators.find(i => i.name === 'エンゲージメントスコアの上昇' && i.fiscalYear === 2024)!;
  assert.equal(score.target, '43.4');
  assert.equal(score.actual, '47.2');
  assert.equal(score.evidence.page, 1);
  assert.ok(p.activities?.includes('エンゲージメント調査'));
  assert.ok(!p.ratings.some(r => r.kind === 'external'));
});

test('PDF with no text or changed template is explicitly unsupported, without OCR or invented projects', async () => {
  const d = doc('sapporo', 'pdf');
  assert.equal(parseSapporoPages(d, [{ page: 1, text: '', items: [] }], context('sapporo')).status, 'unsupported');
  const changed = parseSapporoPages(d, [{ page: 1, text: '事業評価調書 変更されたレイアウトのPDFです。'.repeat(4), items: [] }], context('sapporo'));
  assert.equal(changed.status, 'unsupported');
  assert.match(changed.message, /配置/);
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>', '<< /Length 0 >>\nstream\n\nendstream'];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n${xref}\n%%EOF\n`;
  const runtime = await parseEvaluationDocument(d, Buffer.from(pdf), context('sapporo'));
  assert.equal(runtime.status, 'unsupported');
  assert.match(runtime.message, /OCR/);
  assert.match(runtime.message, /原因は確定していません/);
  assert.ok(!runtime.message.includes('スキャンPDFです'));
});


test('legacy Shift_JIS official HTML bytes decode without mojibake', async () => {
  const base64 = await readFile(`${fixtures}misato-shift-jis-fragment.base64`, 'utf8');
  const result = await parseEvaluationDocument(doc('misato', 'html'), Buffer.from(base64.trim(), 'base64'), context('misato'));
  assert.equal(result.projects[0].projectName, '広報事業');
  assert.equal(result.projects[0].projectCode, '1000039');
  assert.equal(result.status, 'partial'); // Only identity rows are in this codec fixture.
});
