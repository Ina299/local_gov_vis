import { chromium, type Browser } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { LocalGovBudget, CrawlerOptions } from '../types/budget.js';
import { PREFECTURES } from '../data/prefectures.js';

/**
 * 市区町村の予算データをクロール
 */
export async function crawlCities(options: CrawlerOptions): Promise<void> {
  console.log('📍 市区町村予算データのクロール開始');

  const browser = await chromium.launch({ headless: true });

  try {
    const prefectures = options.prefectureCode
      ? PREFECTURES.filter((p) => p.code === options.prefectureCode)
      : PREFECTURES;

    for (const pref of prefectures) {
      console.log(`  🔍 ${pref.name}の市区町村...`);

      const results: LocalGovBudget[] = [];

      // TODO: 各市区町村の予算ページをクロール
      // 市区町村データは総務省の全国地方公共団体コード一覧などから取得可能

      // 結果を保存
      if (results.length > 0) {
        await saveResults(results, options.outputDir, `cities_${pref.code}`);
        console.log(`    ✅ ${results.length}件の市区町村データを保存`);
      }

      // レート制限対策
      await sleep(1000);
    }
  } finally {
    await browser.close();
  }
}

async function saveResults(
  data: LocalGovBudget[],
  outputDir: string,
  filename: string
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const jsonPath = join(outputDir, `${filename}.json`);
  await writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
