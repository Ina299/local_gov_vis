import { describe, it, expect } from 'vitest';
import { metricValue, formatMetricValue, metricCategory, metricDef, categoryKeys,
  headerEntries,
  groupVariants,
  metricLabelValue,
} from '../metrics';
import type { LocalGovBudget } from '@/types/budget';

const budget: LocalGovBudget = {
  code: '13',
  name: '東京都',
  prefecture: '東京都',
  fiscalYear: 2024,
  budgetType: 'final',
  totalRevenue: 9_000_000_000_000,
  totalExpenditure: 8_000_000_000_000,
  expenditures: [],
  revenues: [],
  fiscalIndicators: [{ name: '財政力指数', value: 1.21, unit: '' }],
  population: 14_000_000,
  demographics: {
    areaKm2: 2_200,
    elderlyRatio: 0.2248,
    foreignRatio: 0.0515,
    births: 89_000,
    regionalReproductionRate: 0.81,
    populationChange: 91_000,
    foreignBirthRatio: 0.0473,
  },
  sourceUrl: '',
  crawledAt: '',
};

describe('metricValue', () => {
  it('歳出/歳入の総額と一人当たり', () => {
    expect(metricValue(budget, 'expenditure', 'total')).toBe(8_000_000_000_000);
    expect(metricValue(budget, 'revenue', 'total')).toBe(9_000_000_000_000);
    expect(metricValue(budget, 'expenditure', 'perCapita')).toBeCloseTo(
      8_000_000_000_000 / 14_000_000
    );
  });

  it('款・歳入項目の指標はbudgetItemで引き、ない項目は0円', () => {
    const b: LocalGovBudget = {
      ...budget,
      expenditures: [{ name: '教育費', amount: 1_200_000_000_000, category: 'education' }],
      revenues: [{ name: '地方税', amount: 6_000_000_000_000, category: 'other' }],
    };
    expect(metricValue(b, 'expenditureEducation', 'total')).toBe(1_200_000_000_000);
    expect(metricValue(b, 'expenditureEducation', 'perCapita')).toBeCloseTo(
      1_200_000_000_000 / 14_000_000
    );
    expect(metricValue(b, 'revenueLocalTax', 'total')).toBe(6_000_000_000_000);
    // リストにない項目（不交付団体の地方交付税等）は0円
    expect(metricValue(b, 'localAllocationTax', 'total')).toBe(0);
  });

  it('人口・人口密度', () => {
    expect(metricValue(budget, 'population', 'total')).toBe(14_000_000);
    expect(metricValue(budget, 'populationDensity', 'total')).toBeCloseTo(14_000_000 / 2_200);
  });

  it('demographics由来の指標', () => {
    expect(metricValue(budget, 'elderlyRatio', 'total')).toBe(0.2248);
    expect(metricValue(budget, 'births', 'total')).toBe(89_000);
    expect(metricValue(budget, 'regionalReproductionRate', 'total')).toBe(0.81);
    expect(metricValue(budget, 'populationChange', 'total')).toBe(91_000);
    expect(metricValue(budget, 'foreignBirthRatio', 'total')).toBe(0.0473);
  });

  it('財政指標は指標名で引く', () => {
    expect(metricValue(budget, 'fiscalIndex', 'total')).toBe(1.21);
    expect(metricValue(budget, 'futureBurdenRatio', 'total')).toBeNull();
  });

  it('欠損はnull', () => {
    expect(metricValue(undefined, 'population', 'total')).toBeNull();
    const noDemo = { ...budget, demographics: undefined };
    expect(metricValue(noDemo, 'elderlyRatio', 'total')).toBeNull();
    expect(metricValue(noDemo, 'populationDensity', 'total')).toBeNull();
  });
});

describe('formatMetricValue', () => {
  it('人数は万人/人で切り替える', () => {
    expect(formatMetricValue(14_000_000, 'population')).toBe('1,400万人');
    expect(formatMetricValue(2_100, 'population')).toBe('2,100人');
  });

  it('比率は%表示', () => {
    expect(formatMetricValue(0.2248, 'elderlyRatio')).toBe('22.5%');
  });

  it('指数は小数2桁', () => {
    expect(formatMetricValue(1.21, 'fiscalIndex')).toBe('1.21');
  });

  it('人口密度は人/km²', () => {
    expect(formatMetricValue(6363.6, 'populationDensity')).toBe('6,364人/km²');
  });

  it('増減数は符号付き', () => {
    expect(formatMetricValue(91_000, 'populationChange')).toBe('+9.1万人');
    expect(formatMetricValue(-554_485, 'populationChange')).toBe('-55.4万人');
    expect(formatMetricValue(-500, 'populationChange')).toBe('-500人');
  });
});

describe('カテゴリ定義', () => {
  it('metricCategoryはMETRICSのcategoryを返す', () => {
    expect(metricCategory('expenditure')).toBe('money');
    expect(metricCategory('populationChange')).toBe('population');
    expect(metricCategory('fiscalIndex')).toBe('fiscal');
  });

  it('歳入・歳出カテゴリのトグル順（商工費は都道府県のみ）', () => {
    expect(categoryKeys('money')).toEqual([
      'expenditure',
      'expenditureEducation',
      'expenditureWelfare',
      'expenditureCivil',
      'expenditureCommerce',
      'expenditureAgriculture',
      'expenditureHealth',
      'revenue',
      'revenueLocalTax',
      'localAllocationTax',
      'revenueNationalTreasury',
      'roadFunding',
      'roadFundingChange',
      'roadFundingAnomaly',
    ]);
    expect(metricDef('expenditureCommerce').prefOnly).toBe(true);
    expect(metricDef('expenditureEducation').prefOnly).toBeUndefined();
  });

  it('人口カテゴリのトグル順', () => {
    expect(categoryKeys('population')).toEqual([
      'population',
      'populationDensity',
      'elderlyRatio',
      'births',
      'regionalReproductionRate',
      'foreignRatio',
      'foreignBirthRatio',
      'populationChange',
    ]);
  });

  it('道路の国費（配分）は最新の配分年度を使い、前年度比は両年度に記載がある自治体だけ', () => {
    const base = { code: '09215', name: '那須烏山市', prefecture: '栃木県', fiscalYear: 2024, totalRevenue: 0, totalExpenditure: 0, expenditures: [], revenues: [], population: 25_000 };
    const budget = { ...base, roadFunding: { byYear: { '2025': 137_000_000, '2026': 83_000_000 }, latestYear: 2026, source: 'test' } };
    expect(metricValue(budget, 'roadFunding', 'total')).toBe(83_000_000);
    expect(metricValue(budget, 'roadFunding', 'perCapita')).toBe(83_000_000 / 25_000);
    expect(metricValue(budget, 'roadFundingChange', 'total')).toBeCloseTo(83 / 137 - 1, 6);
    expect(metricValue({ ...base, roadFunding: { byYear: { '2025': 0, '2026': 5_000_000 }, latestYear: 2026, source: 'test' } }, 'roadFundingChange', 'total')).toBeNull();
    expect(metricValue(base, 'roadFunding', 'total')).toBeNull();
    expect(formatMetricValue(-0.394, 'roadFundingChange')).toBe('-39%');
    expect(formatMetricValue(0.07, 'roadFundingChange')).toBe('+7.0%');
    for (const key of ['roadFunding', 'roadFundingChange', 'roadFundingAnomaly'] as const) expect(metricDef(key).yearIndependent).toBe(true);
    expect(metricValue(budget, 'roadFundingAnomaly', 'total')).toBeNull();
    expect(metricValue({ ...budget, roadFunding: { ...budget.roadFunding, anomaly: { score: 1.23, rank: 5, residualPct: -75, expectedPct: 4, routes: 4, decreased: 4 } } }, 'roadFundingAnomaly', 'total')).toBe(1.23);
    expect(metricDef('roadFundingChange').kind).toBe('changeRatio');
  });

  it('選挙カテゴリは当選者の地元での差（発散配色）と地元得票率。年度によらない', () => {
    expect(categoryKeys('election')).toEqual(['electionWinnerParty', 'electionWinnerChange', 'electionWinnerMargin', 'electionWinnerShare']);
    expect(metricDef('electionWinnerParty').kind).toBe('category');
    expect(metricDef('electionWinnerParty').muniOnly).toBe(true);
    expect(metricDef('electionWinnerMargin').muniOnly).toBe(true);
    expect(metricDef('electionWinnerMargin').kind).toBe('changeRatio');
    for (const key of ['electionWinnerMargin', 'electionWinnerShare'] as const) expect(metricDef(key).yearIndependent).toBe(true);
    const base = { code: '09215', name: '那須烏山市', prefecture: '栃木県', fiscalYear: 2024, totalRevenue: 0, totalExpenditure: 0, expenditures: [], revenues: [] };
    const e = (no: number, year: number, winnerMargin: number) => ({ no, year, name: 'test', date: `${year}-01-01`, districts: [{ district: '栃木県第３区', winner: '甲', party: '乙党' }], winnerParty: '乙党', winnerShare: 0.42, winnerMargin, source: 's' });
    const budget = { ...base, elections: [e(50, 2024, 0.1), e(51, 2026, -0.05)] };
    expect(metricValue(budget, 'electionWinnerShare', 'total')).toBe(0.42);
    expect(metricValue(budget, 'electionWinnerMargin', 'total')).toBe(-0.05); // 最新
    expect(metricValue(budget, 'electionWinnerMargin', 'total', 2024)).toBe(0.1);
    expect(metricValue(budget, 'electionWinnerMargin', 'total', 2017)).toBeNull(); // その年の記載なし
    expect(metricValue(base, 'electionWinnerMargin', 'total')).toBeNull();
    expect(metricLabelValue(budget, 'electionWinnerParty', 'total' as never)).toBeNull();
    expect(metricLabelValue(budget, 'electionWinnerParty', 2026)).toBe('乙党');
    expect(metricLabelValue(budget, 'electionWinnerParty')).toBe('乙党');
    // 当選者の交代: 最新（2026）は前回（2024）と同じ当選者「甲」
    expect(metricLabelValue(budget, 'electionWinnerChange')).toBe('同じ当選者');
    expect(metricLabelValue(budget, 'electionWinnerChange', 2024)).toBeNull(); // 前回の記載なし
    const changed = { ...base, elections: [e(50, 2024, 0.1), { ...e(51, 2026, 0.2), districts: [{ district: '栃木県第3区', winner: '丙', party: '丁党' }], winnerParty: '丁党' }] };
    expect(metricLabelValue(changed, 'electionWinnerChange')).toBe('政党が交代');
    const sameParty = { ...base, elections: [e(50, 2024, 0.1), { ...e(51, 2026, 0.2), districts: [{ district: '栃木県第3区', winner: '丙', party: '乙党' }] }] };
    expect(metricLabelValue(sameParty, 'electionWinnerChange')).toBe('当選者が交代（同じ党）');
  });

  it('道路の国費の 3 指標はヘッダーで 1 つの組にまとまり、見方の切替が下段に出る', () => {
    const entries = headerEntries('money', 'expenditure');
    expect(entries.filter((e) => e.groupKey === 'roadFunding')).toHaveLength(1);
    expect(entries.find((e) => e.groupKey === 'roadFunding')?.label).toBe('道路の国費');
    expect(headerEntries('money', 'roadFundingAnomaly').find((e) => e.groupKey === 'roadFunding')?.key).toBe('roadFundingAnomaly');
    expect(groupVariants('roadFunding').map((v) => v.label)).toEqual(['配分額', '前年度比', '要確認度']);
  });

  it('就労系の静的指標にはyearIndependentが立っている', () => {
    for (const key of ['avgIncome', 'industryMedical', 'industryPublic'] as const) {
      expect(metricDef(key).yearIndependent).toBe(true);
    }
  });

  it('公共施設状況調のインフラ指標は年度別（1年ずらしで全年度に対応するためmaxYearなし）', () => {
    for (const key of [
      'roadPerCapita',
      'sewerageRatio',
      'parkPerCapita',
      'publicHousingRate',
    ] as const) {
      expect(metricDef(key).yearIndependent).toBeUndefined();
      expect(metricDef(key).maxYear).toBeUndefined();
    }
  });

  it('インフラカテゴリのトグル順（橋の要修繕率は道路の長さの右隣）', () => {
    expect(categoryKeys('infra')).toEqual([
      'roadPerCapita',
      'bridgeRepairRate',
      'waterPipeAging',
      'sewerageRatio',
      'parkPerCapita',
      'publicHousingRate',
      'hospitals',
      'hospitalBeds',
    ]);
  });

  it('橋の要修繕率は点検0件でデータなし', () => {
    const withBridges = {
      ...budget,
      infrastructure: { bridgesInspected: 200, bridgesNeedRepair: 18 },
    };
    expect(metricValue(withBridges, 'bridgeRepairRate', 'total')).toBeCloseTo(0.09);
    const noBridges = { ...budget, infrastructure: { bridgesInspected: 0 } };
    expect(metricValue(noBridges, 'bridgeRepairRate', 'total')).toBeNull();
  });

  it('見える化DB由来のインフラ指標は年度別（yearIndependentなし）', () => {
    for (const key of ['waterPipeAging', 'hospitals', 'hospitalBeds'] as const) {
      expect(metricDef(key).yearIndependent).toBeUndefined();
    }
  });

  it('安全カテゴリは年度別データ（yearIndependentなし）でトグル順も維持', () => {
    expect(categoryKeys('safety')).toEqual([
      'trafficAccidents',
      'trafficFatalities',
      'penalCodeOffenses',
      'homicides',
      'robberies',
      'burglaries',
      'sexualAssaults',
    ]);
    for (const key of categoryKeys('safety')) {
      expect(metricDef(key).yearIndependent).toBeUndefined();
    }
  });

  it('犯罪統計の指標は都道府県のみ（prefOnly）、交通事故は市区町村もあり', () => {
    for (const key of [
      'penalCodeOffenses',
      'homicides',
      'robberies',
      'burglaries',
      'sexualAssaults',
    ] as const) {
      expect(metricDef(key).prefOnly).toBe(true);
    }
    expect(metricDef('trafficAccidents').prefOnly).toBeUndefined();
  });

  it('per1000/per100kは指標定義のunitで表示する', () => {
    expect(formatMetricValue(11.44, 'publicHousingRate')).toBe('11.4戸');
    expect(formatMetricValue(1.87, 'trafficAccidents')).toBe('1.9件');
    expect(formatMetricValue(3.03, 'trafficFatalities')).toBe('3.0人');
  });

  it('人口統計指標は年度別に取得するためyearIndependentなし', () => {
    for (const key of [
      'elderlyRatio',
      'foreignRatio',
      'births',
      'populationChange',
      'foreignBirthRatio',
    ] as const) {
      expect(metricDef(key).yearIndependent).toBeUndefined();
    }
    expect(metricDef('regionalReproductionRate').yearIndependent).toBe(true);
    expect(metricDef('expenditure').yearIndependent).toBeUndefined();
  });

  it('出生数と地域再生産率は値が高い地域ほど濃く表示する', () => {
    expect(metricDef('births').invertColor).toBeUndefined();
    expect(metricDef('regionalReproductionRate').invertColor).toBeUndefined();
  });
});
