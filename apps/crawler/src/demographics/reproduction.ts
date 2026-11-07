import * as XLSX from 'xlsx';
const FEMALE_BIRTH_SHARE = 100 / 205;
export const AGE_TABLES: Record<number, string> = {
  2016:'000031429220', 2017:'000031598552', 2018:'000031736918', 2019:'000031843913', 2020:'000031971233',
  2021:'000040306689', 2022:'000032224641', 2023:'000040306667', 2024:'000040306678', 2025:'000040306662',
};
export const FERTILITY_TABLE = '000040174881';

export function parseTotalFertilityRates(buf: Buffer): Map<string, number> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
  const result = new Map<string, number>();
  for (const row of rows) {
    const code = String(row[0] ?? '').trim().match(/^(\d{5}|\d{2})(?=\D|$)/)?.[1];
    const raw = String(row[1] ?? '').replace(/\*/g, '').trim();
    const value = Number(raw);
    if (code && raw && Number.isFinite(value) && value >= 0) result.set(code, value);
  }
  return result;
}

export async function loadReproductionData(fetchTable: (id: string) => Promise<Buffer>) {
  const fertilityBuffer = await fetchTable(FERTILITY_TABLE);
  const rates = parseBayesianFertilityRates(fertilityBuffer);
  const fertility = parseTotalFertilityRates(fertilityBuffer);
  const ages = new Map<number, Map<string, number[]>>();
  // Bound requests to one official table at a time.
  for (const [year, id] of Object.entries(AGE_TABLES)) ages.set(Number(year), parseFemaleAges(await fetchTable(id)));
  const byYear = new Map<number, Map<string, number>>();
  for (let year = 2020; year <= 2024; year++) byYear.set(year, buildRegionalReproductionRates(ages.get(year-4)!, ages.get(year+1)!, rates));
  return { byYear, fertility, ages, rates };
}
/** 0～4歳から45～49歳までの日本人女性人口（5歳階級） */
type FemaleAges = number[];

export function parseFemaleAges(buf: Buffer): Map<string, FemaleAges> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
  });
  const result = new Map<string, FemaleAges>();
  for (const row of rows) {
    const rawCode = String(row[0] ?? '');
    if (!/^\d{6}$/.test(rawCode) || row[3] !== '女') continue;
    const isPref = row[2] === '-' || row[2] === '' || row[2] == null;
    const code = isPref ? rawCode.slice(0, 2) : rawCode.slice(0, 5);
    const ages = Array.from({ length: 10 }, (_, i) => row[i + 5]);
    if (!ages.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) continue;
    result.set(code, ages as number[]);
  }
  return result;
}

/** 15～19歳から45～49歳までの女性人口千対出生率（ベイズ推定値） */
export function parseBayesianFertilityRates(buf: Buffer): Map<string, number[]> {
  const wb = XLSX.read(buf);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
  });
  const result = new Map<string, number[]>();
  const numberValue = (value: unknown): number | null => {
    if (typeof value === 'number') return value;
    const text = String(value ?? '').replace(/\*/g, '').trim();
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  };
  for (const row of rows) {
    const label = String(row[0] ?? '').trim();
    const match = label.match(/^(\d{5}|\d{2})(?=\D|$)/);
    if (!match) continue; // 全国・保健所（4桁）を除外
    const rates = Array.from({ length: 7 }, (_, i) => numberValue(row[i + 2]));
    if (rates.length !== 7 || rates.some((value) => value === null)) continue;
    result.set(match[1], rates as number[]);
  }
  return result;
}

/**
 * 地域人口再生産率（RRR）を算出する。
 *
 * 5年間の同一女性コーホート人口比を年齢順に累積した「累積残存率」は、
 * 生存だけでなく転出入も含む。通常の純再生産率の生存率をこの残存率に置き換え、
 * 2018～2022年の年齢別出生率（5歳階級）を適用する。
 */
export function buildRegionalReproductionRates(
  femaleBase: Map<string, FemaleAges>,
  femaleEnd: Map<string, FemaleAges>,
  fertilityRates: Map<string, number[]>
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [code, rates] of fertilityRates) {
    const base = femaleBase.get(code);
    const end = femaleEnd.get(code);
    if (!base || !end) continue;

    let cumulativeRetention = 1;
    const retentionByAge: number[] = [1];
    let valid = true;
    // 始点の0～4歳が5年後の5～9歳になる同一コーホートの比を順次累積
    for (let ageIndex = 1; ageIndex < 10; ageIndex++) {
      const denominator = base[ageIndex - 1];
      if (denominator <= 0) {
        valid = false;
        break;
      }
      cumulativeRetention *= end[ageIndex] / denominator;
      retentionByAge.push(cumulativeRetention);
    }
    if (!valid) continue;

    let rrr = 0;
    for (let fertilityIndex = 0; fertilityIndex < rates.length; fertilityIndex++) {
      const ageIndex = fertilityIndex + 3; // 15～19歳は年齢人口配列のindex 3
      rrr +=
        5 *
        (rates[fertilityIndex] / 1000) *
        FEMALE_BIRTH_SHARE *
        retentionByAge[ageIndex];
    }
    if (Number.isFinite(rrr) && rrr >= 0) {
      result.set(code, Math.round(rrr * 10000) / 10000);
    }
  }
  return result;
}

