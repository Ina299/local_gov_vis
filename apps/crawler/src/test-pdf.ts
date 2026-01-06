import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocument({ data: buffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(`\n--- ページ ${i} ---\n${pageText}`);
  }

  return textParts.join('\n');
}

async function testPdfParsing() {
  const pdfUrl = 'https://www.zaimu.metro.tokyo.lg.jp/documents/d/zaimu/6yosanangaiyou';

  console.log('📥 PDFをダウンロード中:', pdfUrl);

  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`📄 PDFサイズ: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // PDFを解析
    console.log('📊 PDF解析中...');
    const text = await extractTextFromPdf(arrayBuffer);

    // テキストの最初の部分を表示
    console.log('\n📝 抽出テキスト（最初の3000文字）:');
    console.log(text.substring(0, 3000));

    // テキストをファイルに保存
    const outputDir = join(__dirname, '../output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'tokyo_budget.txt'), text, 'utf-8');
    console.log(`\n✅ テキストを保存しました: ${join(outputDir, 'tokyo_budget.txt')}`);

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testPdfParsing();
