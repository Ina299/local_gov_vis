/**
 * 地方財政状況調査（e-Stat）の「歳出内訳及び財源内訳（その1〜6）」から
 * 目的別歳出（款）ごとの充当一般財源等を取得し、既存の予算JSONに付与する。
 *
 * データソース: e-Stat 地方財政状況調査 調査表（都道府県分・市町村分）
 *   https://www.e-stat.go.jp/stat-search/files?toukei=00200251&tstat=000001077755
 * 表の形式: 行=性質別内訳＋財源内訳（行名称「歳出合計」「一般財源等」等）、
 *           列=目的別の款・項（「002:総務費・総額」等）。金額は千円単位。
 * e-Statの「年次」は調査実施年で、決算年度はその前年（CSV内の決算年度列で照合する）。
 *
 * 実行: npm run -w @local-gov/crawler import:funding
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import type { LocalGovBudget } from './types/budget.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');
const CACHE_DIR = join(tmpdir(), 'local-gov-funding-cache');

/**
 * 「歳出内訳及び財源内訳（その1）」のstatInfId（e-Stat年次ごと）。
 * その2以降はIDが連番で続くため、表名称を確認しながら順に辿る。
 */
const BASE_IDS: Record<'pref' | 'muni', Record<number, string>> = {
  pref: {
    2021: '000032188832',
    2022: '000040045066',
    2023: '000040171280',
    2024: '000040231724',
    2025: '000040374264',
  },
  muni: {
    2021: '000032188703',
    2022: '000040044926',
    2023: '000040171707',
    2024: '000040231596',
    2025: '000040375643',
  },
};

/** IDが連番から外れているファイル（e-Stat側の採番の飛び）を明示的に追加する */
const EXTRA_IDS: Record<'pref' | 'muni', string[]> = {
  pref: [
    '000040374288', // 年次2025 表11（その5）
    '000040374289', // 年次2025 表12（その6）
  ],
  muni: [],
};

/** 款ごとの財源内訳（千円） */
interface KanFunding {
  total: number;
  general: number;
}

/** `${決算年度}:${自治体コード}` → 款名 → 財源内訳 */
type FundingMap = Map<string, Map<string, KanFunding>>;

function decodeCsv(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('shift_jis').decode(buf);
  }
}

async function fetchCsv(statInfId: string): Promise<string | null> {
  const cachePath = join(CACHE_DIR, `${statInfId}.csv`);
  if (existsSync(cachePath)) return readFileSync(cachePath, 'utf-8');

  const url = `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${statInfId}&fileKind=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  await new Promise((r) => setTimeout(r, 1000)); // レート制限
  if (!res.ok) return null;
  const text = decodeCsv(Buffer.from(await res.arrayBuffer()));
  if (!text.startsWith('決算年度')) return null; // HTMLエラーページ等
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, text);
  return text;
}

/**
 * 列名から款名を返す。款レベルの列（「001:議会費」「002:総務費・総額」）のみ対象で、
 * 項レベル（「003:総務費・総務管理費」「002:災害復旧費・農林水産施設・総額」）はnull。
 */
function kanOfColumn(header: string): string | null {
  const name = header.replace(/^\d+:/, '');
  const parts = name.split('・');
  if (parts.length === 1) return name === '歳出合計' ? null : name;
  if (parts.length === 2 && parts[1] === '総額') return parts[0];
  return null;
}

/** CSV 1ファイル分をFundingMapへ集計する */
function accumulate(text: string, level: 'pref' | 'muni', acc: FundingMap): void {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',');
  // 列index → 款名
  const kanCols: Array<{ index: number; kan: string }> = [];
  for (let j = 10; j < headers.length; j++) {
    const kan = kanOfColumn(headers[j].trim());
    if (kan) kanCols.push({ index: j, kan });
  }
  if (kanCols.length === 0) return;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rowName = cols[9];
    if (rowName !== '歳出合計' && rowName !== '一般財源等') continue;

    const rawCode = cols[2].trim().padStart(6, '0');
    const code = level === 'pref' ? rawCode.slice(0, 2) : rawCode.slice(0, 5);
    const key = `${cols[0]}:${code}`;
    let kanMap = acc.get(key);
    if (!kanMap) {
      kanMap = new Map();
      acc.set(key, kanMap);
    }
    for (const { index, kan } of kanCols) {
      const value = Number(cols[index]);
      if (!Number.isFinite(value)) continue;
      let f = kanMap.get(kan);
      if (!f) {
        f = { total: 0, general: 0 };
        kanMap.set(kan, f);
      }
      if (rowName === '歳出合計') f.total += value;
      else f.general += value;
    }
  }
}

/** 1ファイルをダウンロードして集計する（対象表のみ） */
async function importOne(level: 'pref' | 'muni', id: string, acc: FundingMap): Promise<boolean> {
  const text = await fetchCsv(id);
  if (!text) return false;
  const firstRow = text.slice(0, 2000).split(/\r?\n/)[1]?.split(',');
  const tableName = firstRow?.[7] ?? '';
  if (!/^歳出内訳及び財源内訳（その\d）$/.test(tableName)) return false;
  const tableNo = Number(firstRow[6]);
  if (tableNo >= 7 && tableNo <= 12) {
    accumulate(text, level, acc);
    console.log(`  表${tableNo} ${tableName} (${id}) 取込`);
  } else {
    console.log(`  表${tableNo} ${tableName} (${id}) スキップ`);
  }
  return true;
}

/** 1年次分の調査表（その1〜6）をダウンロードして集計する */
async function importYear(level: 'pref' | 'muni', baseId: string, acc: FundingMap): Promise<void> {
  const baseNum = Number(baseId);
  // 表が分割ファイルになることがあるため、表名称が合致する限り連番を辿る（最大30）。
  // 連番が飛んでいる年次分はEXTRA_IDSで補う
  for (let k = 0; k < 30; k++) {
    const id = String(baseNum + k).padStart(baseId.length, '0');
    if (!(await importOne(level, id, acc))) break;
  }
}

/** 予算JSONの歳出大項目にgeneralFundsを付与する */
function patchBudgets(budgets: LocalGovBudget[], acc: FundingMap): { patched: number; missed: number } {
  let patched = 0;
  let missed = 0;
  for (const b of budgets) {
    const kanMap = acc.get(`${b.fiscalYear}:${b.code}`);
    if (!kanMap) {
      missed++;
      continue;
    }
    const topNames = new Set(b.expenditures.map((e) => e.name));
    for (const e of b.expenditures) {
      if (e.name === 'その他') {
        // JD側で「その他」に集約された款（災害復旧費・諸支出金等）の一般財源等を合算
        let g = 0;
        for (const [kan, f] of kanMap) {
          if (!topNames.has(kan)) g += f.general;
        }
        e.generalFunds = Math.max(0, Math.min(g * 1000, e.amount));
      } else {
        const f = kanMap.get(e.name);
        if (!f) continue;
        e.generalFunds = Math.max(0, Math.min(f.general * 1000, e.amount));
      }
    }
    patched++;
  }
  return { patched, missed };
}

function patchFile(path: string, acc: FundingMap): void {
  const budgets: LocalGovBudget[] = JSON.parse(readFileSync(path, 'utf-8'));
  const { patched, missed } = patchBudgets(budgets, acc);
  writeFileSync(path, JSON.stringify(budgets, null, path.includes('municipal') ? 0 : 2));
  console.log(`${path}: ${patched}件付与 / ${missed}件データなし`);
}

async function main() {
  const prefAcc: FundingMap = new Map();
  const muniAcc: FundingMap = new Map();

  for (const [year, baseId] of Object.entries(BASE_IDS.pref)) {
    console.log(`都道府県分 年次${year}:`);
    await importYear('pref', baseId, prefAcc);
  }
  for (const id of EXTRA_IDS.pref) await importOne('pref', id, prefAcc);
  for (const [year, baseId] of Object.entries(BASE_IDS.muni)) {
    console.log(`市町村分 年次${year}:`);
    await importYear('muni', baseId, muniAcc);
  }
  for (const id of EXTRA_IDS.muni) await importOne('muni', id, muniAcc);
  console.log(`集計: 都道府県 ${prefAcc.size}団体年度 / 市町村 ${muniAcc.size}団体年度`);

  // 検証: 東京都2022の総務費
  const sample = prefAcc.get('2022:13')?.get('総務費');
  if (sample) {
    console.log(
      `検証 東京都2022 総務費: 歳出合計${sample.total}千円 うち一般財源等${sample.general}千円`
    );
  }

  patchFile(join(WEB_PUBLIC, 'budgets.json'), prefAcc);
  patchFile(join(REPO_ROOT, 'data', 'budgets', 'prefectures.json'), prefAcc);

  const muniDir = join(WEB_PUBLIC, 'budgets', 'municipal');
  for (const file of readdirSync(muniDir).filter((f) => /^\d{2}\.json$/.test(f))) {
    patchFile(join(muniDir, file), muniAcc);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
