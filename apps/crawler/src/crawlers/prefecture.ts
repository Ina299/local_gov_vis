import { chromium, type Browser, type Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { LocalGovBudget, CrawlerOptions } from '../types/budget.js';
import { PREFECTURES } from '../data/prefectures.js';

/**
 * 都道府県の予算データをクロール
 */
export async function crawlPrefectures(options: CrawlerOptions): Promise<void> {
  console.log('📍 都道府県予算データのクロール開始');

  const browser = await chromium.launch({ headless: true });

  try {
    const prefectures = options.prefectureCode
      ? PREFECTURES.filter((p) => p.code === options.prefectureCode)
      : PREFECTURES;

    const results: LocalGovBudget[] = [];

    for (const pref of prefectures) {
      console.log(`  🔍 ${pref.name}...`);

      try {
        const budget = await crawlPrefectureBudget(browser, pref);
        if (budget) {
          results.push(budget);
        }
      } catch (error) {
        console.error(`    ⚠️ ${pref.name}のクロールに失敗:`, error);
      }

      // レート制限対策
      await sleep(1000);
    }

    // 結果を保存
    await saveResults(results, options.outputDir, 'prefectures');
    console.log(`✅ ${results.length}件の都道府県データを保存`);
  } finally {
    await browser.close();
  }
}

async function crawlPrefectureBudget(
  browser: Browser,
  pref: { code: string; name: string; url?: string }
): Promise<LocalGovBudget | null> {
  const page = await browser.newPage();

  try {
    // TODO: 各都道府県の予算ページをクロール
    // 現在はプレースホルダー実装
    // 実際の実装では各都道府県の公式サイトから予算データを取得

    return {
      code: pref.code,
      name: pref.name,
      prefecture: pref.name,
      fiscalYear: new Date().getFullYear(),
      budgetType: 'initial',
      totalRevenue: 0,
      totalExpenditure: 0,
      expenditures: [],
      revenues: [],
      sourceUrl: pref.url || '',
      crawledAt: new Date().toISOString(),
    };
  } finally {
    await page.close();
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
