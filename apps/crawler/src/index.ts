import { program } from 'commander';
import { crawlPrefectures } from './crawlers/prefecture.js';
import { crawlCities } from './crawlers/city.js';

program
  .name('local-gov-crawler')
  .description('都道府県・市区町村の予算データをクロール')
  .version('1.0.0');

program
  .option('-t, --type <type>', '対象タイプ (prefecture|city)', 'all')
  .option('-p, --prefecture <code>', '都道府県コード (01-47)')
  .option('-o, --output <path>', '出力先ディレクトリ', '../../data/budgets');

program.parse();

const options = program.opts();

async function main() {
  console.log('🚀 クロール開始...');

  try {
    if (options.type === 'prefecture' || options.type === 'all') {
      await crawlPrefectures({
        prefectureCode: options.prefecture,
        outputDir: options.output,
      });
    }

    if (options.type === 'city' || options.type === 'all') {
      await crawlCities({
        prefectureCode: options.prefecture,
        outputDir: options.output,
      });
    }

    console.log('✅ クロール完了');
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }
}

main();
