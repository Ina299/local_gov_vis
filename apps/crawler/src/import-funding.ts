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

/**
 * 性質別の大区分の行名称。これ以外の性質別行（「うち職員給」「補助事業費」等）は
 * 大区分の内訳なので集計しない
 */
const NATURE_ROWS = new Set([
  '人件費',
  '扶助費',
  '物件費',
  '維持補修費',
  '補助費等',
  '普通建設事業費',
  '災害復旧事業費',
  '失業対策事業費',
  '公債費',
  '積立金',
  '投資及び出資金',
  '貸付金',
  '繰出金',
  '前年度繰上充用金',
]);

/**
 * 目的別の款名（列名の1要素目がこれ以外の列＝補助事業費等の性質別内訳列は対象外）。
 * 表12の税関係交付金の列（都道府県が市区町村へ配る交付金）はJD側の「その他」款に
 * 含まれるため款扱いで集計する
 */
const KAN_NAMES = new Set([
  '議会費',
  '総務費',
  '民生費',
  '衛生費',
  '労働費',
  '農林水産業費',
  '商工費',
  '土木費',
  '消防費',
  '警察費',
  '教育費',
  '災害復旧費',
  '公債費',
  '諸支出金',
  '前年度繰上充用金',
  '特別区財政調整交付金',
  '利子割交付金',
  '配当割交付金',
  '株式等譲渡所得割交付金',
  '分離課税所得割交付金',
  '地方消費税交付金',
  'ゴルフ場利用税交付金',
  '特別地方消費税交付金',
  '自動車取得税交付金',
  '軽油引取税交付金',
  '自動車税環境性能割交付金',
  '法人事業税交付金',
]);

/** 款ごとの財源内訳と性質別内訳（千円） */
interface KanFunding {
  total: number;
  general: number;
  natures: Map<string, number>;
}

/** `${決算年度}:${自治体コード}` → 款名または`款/項` → 財源内訳 */
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
 * 列名から集計キー（款名または`款/項`）を返す。
 *   「001:議会費」「002:総務費・総額」                → 款
 *   「003:総務費・総務管理費」「民生費・児童福祉費」   → 款/項
 *   「教育費・保健体育費・学校給食費」等の3要素列      → 総額列がない項（保健体育費・都市計画費）のみ合算
 * 補助事業費・単独事業費などの目的別でない列、災害復旧費の施設別内訳等はnull。
 */
function keyOfColumn(header: string): string | null {
  const name = header.replace(/^\d+:/, '');
  const parts = name.split('・');
  if (!KAN_NAMES.has(parts[0])) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[1] === '総額' ? parts[0] : `${parts[0]}/${parts[1]}`;
  if (parts.length === 3 && parts[0] === '教育費' && parts[1] === '保健体育費')
    return '教育費/保健体育費';
  if (parts.length === 3 && parts[0] === '土木費' && parts[1] === '都市計画費')
    return '土木費/都市計画費';
  return null;
}

/** CSV 1ファイル分をFundingMapへ集計する */
function accumulate(text: string, level: 'pref' | 'muni', acc: FundingMap): void {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',');
  // 列index → 集計キー（款名または`款/項`）
  const kanCols: Array<{ index: number; kan: string }> = [];
  for (let j = 10; j < headers.length; j++) {
    const key = keyOfColumn(headers[j].trim());
    if (key) kanCols.push({ index: j, kan: key });
  }
  if (kanCols.length === 0) return;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const rowName = cols[9];
    if (rowName !== '歳出合計' && rowName !== '一般財源等' && !NATURE_ROWS.has(rowName)) continue;

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
        f = { total: 0, general: 0, natures: new Map() };
        kanMap.set(kan, f);
      }
      if (rowName === '歳出合計') f.total += value;
      else if (rowName === '一般財源等') f.general += value;
      else f.natures.set(rowName, (f.natures.get(rowName) ?? 0) + value);
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

/**
 * 性質別内訳を構成比%の上位3件に絞る（JSONサイズ対策。ツールチップの一言表示用）。
 * 四捨五入後5%未満の区分と、意味のない負値・ゼロ総額は落とす
 */
function topNatures(
  total: number,
  natures: Map<string, number>
): Array<{ name: string; share: number }> | undefined {
  if (total <= 0) return undefined;
  const list = [...natures]
    .map(([name, value]) => ({ name, share: Math.round((value / total) * 100) }))
    .filter((n) => n.share >= 5)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);
  return list.length > 0 ? list : undefined;
}

/** 予算JSONの歳出大項目にgeneralFundsと性質別内訳を付与する */
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
        // JD側で「その他」に集約された款（災害復旧費・諸支出金等）の一般財源等・性質別を合算
        let g = 0;
        let total = 0;
        const natures = new Map<string, number>();
        for (const [kan, f] of kanMap) {
          if (topNames.has(kan) || kan.includes('/')) continue; // 項キーは款に含まれるので除外
          g += f.general;
          total += f.total;
          for (const [name, value] of f.natures) natures.set(name, (natures.get(name) ?? 0) + value);
        }
        e.generalFunds = Math.max(0, Math.min(g * 1000, e.amount));
        e.natures = topNatures(total, natures);
      } else {
        const f = kanMap.get(e.name);
        if (!f) continue;
        e.generalFunds = Math.max(0, Math.min(f.general * 1000, e.amount));
        e.natures = topNatures(f.total, f.natures);
      }
      // 項レベル: 款/項キーで名前が一致した項にのみ性質別内訳を付与。
      // 収支図は歳出総額比2%未満の項を表示しないため、1%未満の項は付与せずJSONを軽く保つ
      for (const c of e.children ?? []) {
        const cf =
          c.amount >= b.totalExpenditure * 0.01 ? kanMap.get(`${e.name}/${c.name}`) : undefined;
        c.natures = cf ? topNatures(cf.total, cf.natures) : undefined;
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
