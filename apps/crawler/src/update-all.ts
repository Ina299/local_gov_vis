/**
 * データパイプライン全体を正しい順序で実行するオーケストレーター。
 *
 * ベースのインポーター（import-dashboard / import-municipal）はJSONを一から
 * 再生成し、後続インポーターが付与するenrichmentフィールドを消してしまう。
 * そのため必ずこの順序で全ステップを流し直す必要がある。
 *
 * 個別の npm スクリプト（import:demographics 等）は毎回 build:municipal-all を
 * 連結しているが、ここでは各 tsx ファイルを直接呼び、集約ビルドは最後に一度だけ
 * 実行して無駄を省く。build:topo は境界データ更新時のみで、ここには含めない。
 *
 * 実行: npm run -w @local-gov/crawler update:all
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRAWLER_ROOT = join(__dirname, '..');

/** 実行順のステップ（src/ 直下のファイル名と説明） */
const STEPS: Array<{ file: string; label: string }> = [
  { file: 'import-dashboard.ts', label: '都道府県 財政データ取込' },
  { file: 'import-municipal.ts', label: '市区町村 財政データ取込' },
  { file: 'import-demographics.ts', label: '人口統計 付与' },
  { file: 'import-funding.ts', label: '目的別財源・性質別内訳 付与' },
  { file: 'import-employment.ts', label: '就労・所得 付与' },
  { file: 'import-infrastructure.ts', label: 'インフラ 付与' },
  { file: 'import-safety.ts', label: '交通事故（安全）付与' },
  { file: 'import-crime.ts', label: '犯罪統計 付与（都道府県）' },
  { file: 'build-municipal-all.ts', label: '全国市区町村ビュー 結合' },
  { file: 'build-averages.ts', label: '全国平均 算出' },
  { file: 'verify-data.ts', label: 'データ検証' },
];

function runStep(file: string, label: string, index: number): void {
  const header = `[${index + 1}/${STEPS.length}] ${label}  (src/${file})`;
  console.log(`\n${'='.repeat(72)}\n${header}\n${'='.repeat(72)}`);

  const started = Date.now();
  const result = spawnSync('npx', ['tsx', join('src', file)], {
    cwd: CRAWLER_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (result.status !== 0) {
    console.error(
      `\n✗ ステップ失敗: ${label} (src/${file}) — 終了コード ${result.status ?? 'null'}（${elapsed}秒）\n` +
        '   パイプラインを中断します。上のログを確認してください。'
    );
    process.exit(1);
  }
  console.log(`✓ 完了: ${label}（${elapsed}秒）`);
}

const total = Date.now();
console.log(`データパイプラインを開始します（全${STEPS.length}ステップ）`);
STEPS.forEach((step, i) => runStep(step.file, step.label, i));
console.log(
  `\n🎉 全ステップ完了（合計 ${((Date.now() - total) / 1000).toFixed(1)}秒）。` +
    'データは検証済みです。'
);
