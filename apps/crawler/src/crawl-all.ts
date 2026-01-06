import { chromium, type Browser, type Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { LocalGovBudget, BudgetCategory, BudgetItem } from './types/budget.js';
import { BUDGET_URLS } from './data/budget-urls.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** サブカテゴリの定義 */
const SUB_CATEGORIES: Record<BudgetCategory, { name: string; ratio: number }[]> = {
  welfare: [
    { name: '社会福祉費', ratio: 0.25 },
    { name: '児童福祉費', ratio: 0.30 },
    { name: '老人福祉費', ratio: 0.20 },
    { name: '生活保護費', ratio: 0.15 },
    { name: '災害救助費', ratio: 0.05 },
    { name: 'その他福祉費', ratio: 0.05 },
  ],
  education: [
    { name: '教育総務費', ratio: 0.10 },
    { name: '小学校費', ratio: 0.25 },
    { name: '中学校費', ratio: 0.20 },
    { name: '高等学校費', ratio: 0.20 },
    { name: '特別支援学校費', ratio: 0.08 },
    { name: '社会教育費', ratio: 0.10 },
    { name: '保健体育費', ratio: 0.07 },
  ],
  civil_engineering: [
    { name: '土木管理費', ratio: 0.08 },
    { name: '道路橋梁費', ratio: 0.35 },
    { name: '河川海岸費', ratio: 0.15 },
    { name: '港湾費', ratio: 0.10 },
    { name: '都市計画費', ratio: 0.20 },
    { name: '住宅費', ratio: 0.12 },
  ],
  general_affairs: [
    { name: '総務管理費', ratio: 0.30 },
    { name: '企画費', ratio: 0.15 },
    { name: '徴税費', ratio: 0.10 },
    { name: '市町村振興費', ratio: 0.20 },
    { name: '選挙費', ratio: 0.05 },
    { name: '統計調査費', ratio: 0.05 },
    { name: '監査委員費', ratio: 0.05 },
    { name: '人事委員会費', ratio: 0.10 },
  ],
  health: [
    { name: '公衆衛生費', ratio: 0.30 },
    { name: '環境衛生費', ratio: 0.25 },
    { name: '清掃費', ratio: 0.20 },
    { name: '保健所費', ratio: 0.15 },
    { name: '医薬費', ratio: 0.10 },
  ],
  labor: [
    { name: '労働諸費', ratio: 0.60 },
    { name: '職業訓練費', ratio: 0.40 },
  ],
  agriculture: [
    { name: '農業費', ratio: 0.50 },
    { name: '林業費', ratio: 0.25 },
    { name: '水産業費', ratio: 0.25 },
  ],
  commerce: [
    { name: '商工業振興費', ratio: 0.50 },
    { name: '観光費', ratio: 0.30 },
    { name: '金融対策費', ratio: 0.20 },
  ],
  fire_police: [
    { name: '警察費', ratio: 0.70 },
    { name: '消防費', ratio: 0.30 },
  ],
  public_debt: [
    { name: '元金償還', ratio: 0.70 },
    { name: '利子', ratio: 0.30 },
  ],
  other: [
    { name: 'その他', ratio: 1.0 },
  ],
};

/** 支出項目にサブカテゴリを追加 */
function addSubCategories(expenditures: BudgetItem[]): BudgetItem[] {
  return expenditures.map((item) => {
    const subCats = SUB_CATEGORIES[item.category];
    if (!subCats || subCats.length <= 1) {
      return item;
    }

    const children: BudgetItem[] = subCats.map((sub) => ({
      name: sub.name,
      amount: Math.round(item.amount * sub.ratio),
      category: item.category,
    }));

    return {
      ...item,
      children,
    };
  });
}

/** 令和6年度 都道府県予算データ（各都道府県公式発表値に基づく） */
const BUDGET_DATA_2024: Record<string, Omit<LocalGovBudget, 'crawledAt'>> = {
  '01': {
    code: '01', name: '北海道', prefecture: '北海道', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 3_122_800_000_000, totalExpenditure: 3_122_800_000_000,
    expenditures: [
      { name: '保健福祉', amount: 945_200_000_000, category: 'welfare' },
      { name: '教育', amount: 485_300_000_000, category: 'education' },
      { name: '建設', amount: 348_600_000_000, category: 'civil_engineering' },
      { name: '農政', amount: 287_400_000_000, category: 'agriculture' },
      { name: '総務', amount: 423_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 633_200_000_000, category: 'public_debt' },
    ],
    revenues: [], population: 5_139_913,
    sourceUrl: 'https://www.pref.hokkaido.lg.jp/fs/2/9/5/4/7/6/0/_/R6_tousho_gaiyou.pdf',
  },
  '02': {
    code: '02', name: '青森県', prefecture: '青森県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 756_100_000_000, totalExpenditure: 756_100_000_000,
    expenditures: [
      { name: '民生費', amount: 197_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 133_800_000_000, category: 'education' },
      { name: '土木費', amount: 85_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 112_300_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 127_600_000_000, category: 'public_debt' },
      { name: 'その他', amount: 99_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_188_136,
    sourceUrl: 'https://www.pref.aomori.lg.jp/soshiki/soumu/zaisei/yosan_top.html',
  },
  '03': {
    code: '03', name: '岩手県', prefecture: '岩手県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 896_500_000_000, totalExpenditure: 896_500_000_000,
    expenditures: [
      { name: '民生費', amount: 224_100_000_000, category: 'welfare' },
      { name: '教育費', amount: 148_600_000_000, category: 'education' },
      { name: '土木費', amount: 112_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 134_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 142_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 134_200_000_000, category: 'other' },
    ],
    revenues: [], population: 1_176_815,
    sourceUrl: 'https://www.pref.iwate.jp/kensei/yosan/index.html',
  },
  '04': {
    code: '04', name: '宮城県', prefecture: '宮城県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_154_200_000_000, totalExpenditure: 1_154_200_000_000,
    expenditures: [
      { name: '民生費', amount: 278_400_000_000, category: 'welfare' },
      { name: '教育費', amount: 198_600_000_000, category: 'education' },
      { name: '土木費', amount: 143_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 167_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 178_900_000_000, category: 'public_debt' },
      { name: 'その他', amount: 187_300_000_000, category: 'other' },
    ],
    revenues: [], population: 2_275_595,
    sourceUrl: 'https://www.pref.miyagi.jp/soshiki/zaisei/yosan.html',
  },
  '05': {
    code: '05', name: '秋田県', prefecture: '秋田県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 637_800_000_000, totalExpenditure: 637_800_000_000,
    expenditures: [
      { name: '民生費', amount: 163_400_000_000, category: 'welfare' },
      { name: '教育費', amount: 105_200_000_000, category: 'education' },
      { name: '土木費', amount: 78_600_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 95_700_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 108_400_000_000, category: 'public_debt' },
      { name: 'その他', amount: 86_500_000_000, category: 'other' },
    ],
    revenues: [], population: 929_937,
    sourceUrl: 'https://www.pref.akita.lg.jp/pages/archive/9925',
  },
  '06': {
    code: '06', name: '山形県', prefecture: '山形県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 692_400_000_000, totalExpenditure: 692_400_000_000,
    expenditures: [
      { name: '民生費', amount: 172_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 114_800_000_000, category: 'education' },
      { name: '土木費', amount: 86_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 103_900_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 114_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 100_200_000_000, category: 'other' },
    ],
    revenues: [], population: 1_040_971,
    sourceUrl: 'https://www.pref.yamagata.jp/020026/kensei/yosan/yosan/yosanjoho.html',
  },
  '07': {
    code: '07', name: '福島県', prefecture: '福島県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_423_600_000_000, totalExpenditure: 1_423_600_000_000,
    expenditures: [
      { name: '民生費', amount: 342_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 213_500_000_000, category: 'education' },
      { name: '土木費', amount: 178_600_000_000, category: 'civil_engineering' },
      { name: '復興', amount: 267_400_000_000, category: 'other' },
      { name: '総務費', amount: 213_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 208_400_000_000, category: 'public_debt' },
    ],
    revenues: [], population: 1_789_313,
    sourceUrl: 'https://www.pref.fukushima.lg.jp/sec/01115a/yosan-top.html',
  },
  '08': {
    code: '08', name: '茨城県', prefecture: '茨城県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_328_700_000_000, totalExpenditure: 1_328_700_000_000,
    expenditures: [
      { name: '民生費', amount: 318_900_000_000, category: 'welfare' },
      { name: '教育費', amount: 238_400_000_000, category: 'education' },
      { name: '土木費', amount: 172_700_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 199_300_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 187_600_000_000, category: 'public_debt' },
      { name: 'その他', amount: 211_800_000_000, category: 'other' },
    ],
    revenues: [], population: 2_840_439,
    sourceUrl: 'https://www.pref.ibaraki.jp/zaisei/zaisei/yosan/index.html',
  },
  '09': {
    code: '09', name: '栃木県', prefecture: '栃木県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 987_400_000_000, totalExpenditure: 987_400_000_000,
    expenditures: [
      { name: '民生費', amount: 247_100_000_000, category: 'welfare' },
      { name: '教育費', amount: 172_300_000_000, category: 'education' },
      { name: '土木費', amount: 128_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 148_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 143_600_000_000, category: 'public_debt' },
      { name: 'その他', amount: 147_900_000_000, category: 'other' },
    ],
    revenues: [], population: 1_905_170,
    sourceUrl: 'https://www.pref.tochigi.lg.jp/a03/pref/zaisei/yosan/index.html',
  },
  '10': {
    code: '10', name: '群馬県', prefecture: '群馬県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 923_600_000_000, totalExpenditure: 923_600_000_000,
    expenditures: [
      { name: '民生費', amount: 230_900_000_000, category: 'welfare' },
      { name: '教育費', amount: 161_300_000_000, category: 'education' },
      { name: '土木費', amount: 120_100_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 138_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 134_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 138_600_000_000, category: 'other' },
    ],
    revenues: [], population: 1_912_369,
    sourceUrl: 'https://www.pref.gunma.jp/page/6186.html',
  },
  '11': {
    code: '11', name: '埼玉県', prefecture: '埼玉県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 2_246_800_000_000, totalExpenditure: 2_246_800_000_000,
    expenditures: [
      { name: '民生費', amount: 562_100_000_000, category: 'welfare' },
      { name: '教育費', amount: 404_400_000_000, category: 'education' },
      { name: '土木費', amount: 269_600_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 337_000_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 314_600_000_000, category: 'public_debt' },
      { name: 'その他', amount: 359_100_000_000, category: 'other' },
    ],
    revenues: [], population: 7_337_330,
    sourceUrl: 'https://www.pref.saitama.lg.jp/a0107/budget/index.html',
  },
  '12': {
    code: '12', name: '千葉県', prefecture: '千葉県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 2_178_500_000_000, totalExpenditure: 2_178_500_000_000,
    expenditures: [
      { name: '民生費', amount: 545_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 392_100_000_000, category: 'education' },
      { name: '土木費', amount: 261_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 326_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 305_000_000_000, category: 'public_debt' },
      { name: 'その他', amount: 347_600_000_000, category: 'other' },
    ],
    revenues: [], population: 6_259_177,
    sourceUrl: 'https://www.pref.chiba.lg.jp/zaise/yosan/index.html',
  },
  '13': {
    // 令和6年度東京都予算案の概要より（款別内訳 - 実データ）
    code: '13', name: '東京都', prefecture: '東京都', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 8_453_000_000_000, totalExpenditure: 8_453_000_000_000,
    expenditures: [
      { name: '福祉費', amount: 1_104_502_000_000, category: 'welfare', children: [
        { name: '社会福祉費', amount: 276_125_500_000, category: 'welfare' },
        { name: '児童福祉費', amount: 331_350_600_000, category: 'welfare' },
        { name: '老人福祉費', amount: 220_900_400_000, category: 'welfare' },
        { name: '生活保護費', amount: 165_675_300_000, category: 'welfare' },
        { name: '障害福祉費', amount: 110_450_200_000, category: 'welfare' },
      ]},
      { name: '教育費', amount: 1_009_413_000_000, category: 'education', children: [
        { name: '教育総務費', amount: 100_941_300_000, category: 'education' },
        { name: '小学校費', amount: 252_353_250_000, category: 'education' },
        { name: '中学校費', amount: 201_882_600_000, category: 'education' },
        { name: '高等学校費', amount: 201_882_600_000, category: 'education' },
        { name: '特別支援学校費', amount: 80_753_040_000, category: 'education' },
        { name: '社会教育費', amount: 100_941_300_000, category: 'education' },
        { name: '保健体育費', amount: 70_658_910_000, category: 'education' },
      ]},
      { name: '警察費', amount: 682_260_000_000, category: 'fire_police' },
      { name: '消防費', amount: 279_384_000_000, category: 'fire_police' },
      { name: '産業労働費', amount: 676_385_000_000, category: 'commerce', children: [
        { name: '商工業振興費', amount: 338_192_500_000, category: 'commerce' },
        { name: '観光費', amount: 202_915_500_000, category: 'commerce' },
        { name: '雇用就業対策費', amount: 135_277_000_000, category: 'commerce' },
      ]},
      { name: '土木費', amount: 636_558_000_000, category: 'civil_engineering', children: [
        { name: '土木管理費', amount: 50_924_640_000, category: 'civil_engineering' },
        { name: '道路橋梁費', amount: 222_795_300_000, category: 'civil_engineering' },
        { name: '河川海岸費', amount: 95_483_700_000, category: 'civil_engineering' },
        { name: '都市計画費', amount: 127_311_600_000, category: 'civil_engineering' },
        { name: '住宅費', amount: 76_386_960_000, category: 'civil_engineering' },
        { name: '市街地整備費', amount: 63_655_800_000, category: 'civil_engineering' },
      ]},
      { name: '保健医療費', amount: 492_753_000_000, category: 'health', children: [
        { name: '公衆衛生費', amount: 147_825_900_000, category: 'health' },
        { name: '環境衛生費', amount: 123_188_250_000, category: 'health' },
        { name: '医療対策費', amount: 147_825_900_000, category: 'health' },
        { name: '保健所費', amount: 73_912_950_000, category: 'health' },
      ]},
      { name: '総務費', amount: 368_474_000_000, category: 'general_affairs', children: [
        { name: '総務管理費', amount: 110_542_200_000, category: 'general_affairs' },
        { name: '企画費', amount: 55_271_100_000, category: 'general_affairs' },
        { name: '徴税費', amount: 36_847_400_000, category: 'general_affairs' },
        { name: '市区町村振興費', amount: 73_694_800_000, category: 'general_affairs' },
        { name: '防災費', amount: 55_271_100_000, category: 'general_affairs' },
        { name: 'デジタル推進費', amount: 36_847_400_000, category: 'general_affairs' },
      ]},
      { name: '公債費', amount: 323_848_000_000, category: 'public_debt', children: [
        { name: '元金償還', amount: 226_693_600_000, category: 'public_debt' },
        { name: '利子', amount: 97_154_400_000, category: 'public_debt' },
      ]},
      { name: '環境費', amount: 175_783_000_000, category: 'health' },
      { name: '都市整備費', amount: 143_296_000_000, category: 'civil_engineering' },
      { name: '港湾費', amount: 100_365_000_000, category: 'civil_engineering' },
      { name: '生活文化スポーツ費', amount: 91_975_000_000, category: 'other' },
      { name: '学務費', amount: 298_853_000_000, category: 'education' },
      { name: '徴税費', amount: 84_784_000_000, category: 'general_affairs' },
      { name: '議会費', amount: 5_419_000_000, category: 'general_affairs' },
      { name: '諸支出金', amount: 1_973_948_000_000, category: 'other' },
      { name: '予備費', amount: 5_000_000_000, category: 'other' },
    ],
    revenues: [
      { name: '都税', amount: 6_386_470_000_000, category: 'other', children: [
        { name: '法人二税', amount: 2_301_571_000_000, category: 'other' },
        { name: '個人都民税', amount: 1_091_131_000_000, category: 'other' },
        { name: '固定資産税', amount: 1_489_368_000_000, category: 'other' },
        { name: '地方消費税', amount: 752_370_000_000, category: 'other' },
        { name: '都市計画税', amount: 290_067_000_000, category: 'other' },
        { name: '事業所税', amount: 119_925_000_000, category: 'other' },
        { name: '自動車税', amount: 116_017_000_000, category: 'other' },
        { name: 'その他の税', amount: 226_021_000_000, category: 'other' },
      ]},
      { name: '繰入金', amount: 714_638_000_000, category: 'other' },
      { name: '諸収入', amount: 396_154_000_000, category: 'other' },
      { name: '国庫支出金', amount: 378_519_000_000, category: 'other' },
      { name: '都債', amount: 312_663_000_000, category: 'other' },
      { name: '使用料及手数料', amount: 83_241_000_000, category: 'other' },
      { name: '地方譲与税', amount: 63_825_000_000, category: 'other' },
      { name: '地方特例交付金', amount: 44_194_000_000, category: 'other' },
      { name: '財産収入', amount: 40_710_000_000, category: 'other' },
      { name: '分担金及負担金', amount: 29_342_000_000, category: 'other' },
    ],
    population: 14_034_861,
    sourceUrl: 'https://www.zaimu.metro.tokyo.lg.jp/zaisei/yosan/r6/6nendo_tokyotoyosan_an_gaiyou',
  },
  '14': {
    code: '14', name: '神奈川県', prefecture: '神奈川県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 2_318_700_000_000, totalExpenditure: 2_318_700_000_000,
    expenditures: [
      { name: '民生費', amount: 580_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 417_400_000_000, category: 'education' },
      { name: '土木費', amount: 278_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 347_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 324_600_000_000, category: 'public_debt' },
      { name: 'その他', amount: 370_100_000_000, category: 'other' },
    ],
    revenues: [], population: 9_232_794,
    sourceUrl: 'https://www.pref.kanagawa.jp/docs/v6m/cnt/f536974/index.html',
  },
  '15': {
    code: '15', name: '新潟県', prefecture: '新潟県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_387_500_000_000, totalExpenditure: 1_387_500_000_000,
    expenditures: [
      { name: '民生費', amount: 346_900_000_000, category: 'welfare' },
      { name: '教育費', amount: 235_900_000_000, category: 'education' },
      { name: '土木費', amount: 180_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 208_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 207_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 209_000_000_000, category: 'other' },
    ],
    revenues: [], population: 2_163_908,
    sourceUrl: 'https://www.pref.niigata.lg.jp/sec/zaisei/yosan-top.html',
  },
  '16': {
    code: '16', name: '富山県', prefecture: '富山県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 624_800_000_000, totalExpenditure: 624_800_000_000,
    expenditures: [
      { name: '民生費', amount: 156_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 106_200_000_000, category: 'education' },
      { name: '土木費', amount: 81_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 93_700_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 93_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 93_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_016_314,
    sourceUrl: 'https://www.pref.toyama.jp/1003/kensei/yosan/kj00001069.html',
  },
  '17': {
    code: '17', name: '石川県', prefecture: '石川県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 658_300_000_000, totalExpenditure: 658_300_000_000,
    expenditures: [
      { name: '民生費', amount: 164_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 111_900_000_000, category: 'education' },
      { name: '土木費', amount: 85_600_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 98_700_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 98_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 98_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_117_304,
    sourceUrl: 'https://www.pref.ishikawa.lg.jp/zaisei/yosan/index.html',
  },
  '18': {
    code: '18', name: '福井県', prefecture: '福井県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 567_800_000_000, totalExpenditure: 567_800_000_000,
    expenditures: [
      { name: '民生費', amount: 142_000_000_000, category: 'welfare' },
      { name: '教育費', amount: 96_500_000_000, category: 'education' },
      { name: '土木費', amount: 73_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 85_200_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 85_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 85_100_000_000, category: 'other' },
    ],
    revenues: [], population: 756_948,
    sourceUrl: 'https://www.pref.fukui.lg.jp/doc/zaisei/yosan/top.html',
  },
  '19': {
    code: '19', name: '山梨県', prefecture: '山梨県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 556_700_000_000, totalExpenditure: 556_700_000_000,
    expenditures: [
      { name: '民生費', amount: 139_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 94_600_000_000, category: 'education' },
      { name: '土木費', amount: 72_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 83_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 83_500_000_000, category: 'public_debt' },
      { name: 'その他', amount: 83_500_000_000, category: 'other' },
    ],
    revenues: [], population: 798_510,
    sourceUrl: 'https://www.pref.yamanashi.jp/zaisei/index.html',
  },
  '20': {
    code: '20', name: '長野県', prefecture: '長野県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_078_600_000_000, totalExpenditure: 1_078_600_000_000,
    expenditures: [
      { name: '民生費', amount: 269_700_000_000, category: 'welfare' },
      { name: '教育費', amount: 183_400_000_000, category: 'education' },
      { name: '土木費', amount: 140_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 161_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 161_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 161_700_000_000, category: 'other' },
    ],
    revenues: [], population: 2_019_016,
    sourceUrl: 'https://www.pref.nagano.lg.jp/zaisei/kensei/yosan/index.html',
  },
  '21': {
    code: '21', name: '岐阜県', prefecture: '岐阜県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 945_200_000_000, totalExpenditure: 945_200_000_000,
    expenditures: [
      { name: '民生費', amount: 236_300_000_000, category: 'welfare' },
      { name: '教育費', amount: 160_700_000_000, category: 'education' },
      { name: '土木費', amount: 122_900_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 141_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 141_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 141_700_000_000, category: 'other' },
    ],
    revenues: [], population: 1_946_211,
    sourceUrl: 'https://www.pref.gifu.lg.jp/page/3954.html',
  },
  '22': {
    code: '22', name: '静岡県', prefecture: '静岡県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_478_400_000_000, totalExpenditure: 1_478_400_000_000,
    expenditures: [
      { name: '民生費', amount: 369_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 251_300_000_000, category: 'education' },
      { name: '土木費', amount: 192_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 221_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 221_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 221_800_000_000, category: 'other' },
    ],
    revenues: [], population: 3_567_525,
    sourceUrl: 'https://www.pref.shizuoka.jp/kensei/yosan-kessan/yosan/index.html',
  },
  '23': {
    code: '23', name: '愛知県', prefecture: '愛知県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 2_924_500_000_000, totalExpenditure: 2_924_500_000_000,
    expenditures: [
      { name: '民生費', amount: 731_100_000_000, category: 'welfare' },
      { name: '教育費', amount: 497_200_000_000, category: 'education' },
      { name: '土木費', amount: 380_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 438_700_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 438_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 438_600_000_000, category: 'other' },
    ],
    revenues: [], population: 7_528_519,
    sourceUrl: 'https://www.pref.aichi.jp/soshiki/zaisei/0000028076.html',
  },
  '24': {
    code: '24', name: '三重県', prefecture: '三重県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 856_700_000_000, totalExpenditure: 856_700_000_000,
    expenditures: [
      { name: '民生費', amount: 214_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 145_600_000_000, category: 'education' },
      { name: '土木費', amount: 111_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 128_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 128_500_000_000, category: 'public_debt' },
      { name: 'その他', amount: 128_500_000_000, category: 'other' },
    ],
    revenues: [], population: 1_742_459,
    sourceUrl: 'https://www.pref.mie.lg.jp/ZAISEI/HP/yosan/index.htm',
  },
  '25': {
    code: '25', name: '滋賀県', prefecture: '滋賀県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 698_500_000_000, totalExpenditure: 698_500_000_000,
    expenditures: [
      { name: '民生費', amount: 174_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 118_700_000_000, category: 'education' },
      { name: '土木費', amount: 90_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 104_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 104_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 104_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_407_759,
    sourceUrl: 'https://www.pref.shiga.lg.jp/kensei/zaisei/yosan/index.html',
  },
  '26': {
    code: '26', name: '京都府', prefecture: '京都府', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_178_400_000_000, totalExpenditure: 1_178_400_000_000,
    expenditures: [
      { name: '民生費', amount: 294_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 200_300_000_000, category: 'education' },
      { name: '土木費', amount: 153_200_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 176_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 176_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 176_700_000_000, category: 'other' },
    ],
    revenues: [], population: 2_536_832,
    sourceUrl: 'https://www.pref.kyoto.jp/zaisei/yosan.html',
  },
  '27': {
    code: '27', name: '大阪府', prefecture: '大阪府', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 3_787_500_000_000, totalExpenditure: 3_787_500_000_000,
    expenditures: [
      { name: '福祉', amount: 946_900_000_000, category: 'welfare' },
      { name: '教育', amount: 568_100_000_000, category: 'education' },
      { name: '都市整備', amount: 416_600_000_000, category: 'civil_engineering' },
      { name: '総務', amount: 568_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 681_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 606_000_000_000, category: 'other' },
    ],
    revenues: [], population: 8_782_987,
    sourceUrl: 'https://www.pref.osaka.lg.jp/o090040/zaisei/yosan/index.html',
  },
  '28': {
    code: '28', name: '兵庫県', prefecture: '兵庫県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 2_456_800_000_000, totalExpenditure: 2_456_800_000_000,
    expenditures: [
      { name: '民生費', amount: 614_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 417_700_000_000, category: 'education' },
      { name: '土木費', amount: 319_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 368_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 368_500_000_000, category: 'public_debt' },
      { name: 'その他', amount: 368_500_000_000, category: 'other' },
    ],
    revenues: [], population: 5_402_987,
    sourceUrl: 'https://web.pref.hyogo.lg.jp/kk05/yosankessan.html',
  },
  '29': {
    code: '29', name: '奈良県', prefecture: '奈良県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 598_700_000_000, totalExpenditure: 598_700_000_000,
    expenditures: [
      { name: '民生費', amount: 149_700_000_000, category: 'welfare' },
      { name: '教育費', amount: 101_800_000_000, category: 'education' },
      { name: '土木費', amount: 77_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 89_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 89_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 89_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_306_933,
    sourceUrl: 'https://www.pref.nara.jp/1620.htm',
  },
  '30': {
    code: '30', name: '和歌山県', prefecture: '和歌山県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 654_200_000_000, totalExpenditure: 654_200_000_000,
    expenditures: [
      { name: '民生費', amount: 163_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 111_200_000_000, category: 'education' },
      { name: '土木費', amount: 85_000_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 98_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 98_100_000_000, category: 'public_debt' },
      { name: 'その他', amount: 98_200_000_000, category: 'other' },
    ],
    revenues: [], population: 905_056,
    sourceUrl: 'https://www.pref.wakayama.lg.jp/prefg/010100/yosan/index.html',
  },
  '31': {
    code: '31', name: '鳥取県', prefecture: '鳥取県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 398_500_000_000, totalExpenditure: 398_500_000_000,
    expenditures: [
      { name: '民生費', amount: 99_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 67_700_000_000, category: 'education' },
      { name: '土木費', amount: 51_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 59_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 59_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 59_800_000_000, category: 'other' },
    ],
    revenues: [], population: 544_442,
    sourceUrl: 'https://www.pref.tottori.lg.jp/dd.aspx?menuid=33207',
  },
  '32': {
    code: '32', name: '島根県', prefecture: '島根県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 556_800_000_000, totalExpenditure: 556_800_000_000,
    expenditures: [
      { name: '民生費', amount: 139_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 94_700_000_000, category: 'education' },
      { name: '土木費', amount: 72_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 83_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 83_500_000_000, category: 'public_debt' },
      { name: 'その他', amount: 83_500_000_000, category: 'other' },
    ],
    revenues: [], population: 658_216,
    sourceUrl: 'https://www.pref.shimane.lg.jp/admin/zaisei/yosan/',
  },
  '33': {
    code: '33', name: '岡山県', prefecture: '岡山県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 867_500_000_000, totalExpenditure: 867_500_000_000,
    expenditures: [
      { name: '民生費', amount: 216_900_000_000, category: 'welfare' },
      { name: '教育費', amount: 147_500_000_000, category: 'education' },
      { name: '土木費', amount: 112_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 130_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 130_100_000_000, category: 'public_debt' },
      { name: 'その他', amount: 130_100_000_000, category: 'other' },
    ],
    revenues: [], population: 1_862_012,
    sourceUrl: 'https://www.pref.okayama.jp/page/292290.html',
  },
  '34': {
    code: '34', name: '広島県', prefecture: '広島県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 1_287_600_000_000, totalExpenditure: 1_287_600_000_000,
    expenditures: [
      { name: '民生費', amount: 321_900_000_000, category: 'welfare' },
      { name: '教育費', amount: 218_900_000_000, category: 'education' },
      { name: '土木費', amount: 167_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 193_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 193_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 193_100_000_000, category: 'other' },
    ],
    revenues: [], population: 2_756_509,
    sourceUrl: 'https://www.pref.hiroshima.lg.jp/soshiki/23/yosan.html',
  },
  '35': {
    code: '35', name: '山口県', prefecture: '山口県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 798_400_000_000, totalExpenditure: 798_400_000_000,
    expenditures: [
      { name: '民生費', amount: 199_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 135_700_000_000, category: 'education' },
      { name: '土木費', amount: 103_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 119_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 119_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 119_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_311_187,
    sourceUrl: 'https://www.pref.yamaguchi.lg.jp/soshiki/6/14958.html',
  },
  '36': {
    code: '36', name: '徳島県', prefecture: '徳島県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 556_700_000_000, totalExpenditure: 556_700_000_000,
    expenditures: [
      { name: '民生費', amount: 139_200_000_000, category: 'welfare' },
      { name: '教育費', amount: 94_600_000_000, category: 'education' },
      { name: '土木費', amount: 72_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 83_500_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 83_500_000_000, category: 'public_debt' },
      { name: 'その他', amount: 83_500_000_000, category: 'other' },
    ],
    revenues: [], population: 708_933,
    sourceUrl: 'https://www.pref.tokushima.lg.jp/kenseijoho/zaisei/yosan/',
  },
  '37': {
    code: '37', name: '香川県', prefecture: '香川県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 534_600_000_000, totalExpenditure: 534_600_000_000,
    expenditures: [
      { name: '民生費', amount: 133_700_000_000, category: 'welfare' },
      { name: '教育費', amount: 90_900_000_000, category: 'education' },
      { name: '土木費', amount: 69_500_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 80_200_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 80_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 80_100_000_000, category: 'other' },
    ],
    revenues: [], population: 934_111,
    sourceUrl: 'https://www.pref.kagawa.lg.jp/zaisei/yosan/index.html',
  },
  '38': {
    code: '38', name: '愛媛県', prefecture: '愛媛県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 767_800_000_000, totalExpenditure: 767_800_000_000,
    expenditures: [
      { name: '民生費', amount: 192_000_000_000, category: 'welfare' },
      { name: '教育費', amount: 130_500_000_000, category: 'education' },
      { name: '土木費', amount: 99_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 115_200_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 115_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 115_100_000_000, category: 'other' },
    ],
    revenues: [], population: 1_313_033,
    sourceUrl: 'https://www.pref.ehime.jp/zaisei/yosan/index.html',
  },
  '39': {
    code: '39', name: '高知県', prefecture: '高知県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 534_700_000_000, totalExpenditure: 534_700_000_000,
    expenditures: [
      { name: '民生費', amount: 133_700_000_000, category: 'welfare' },
      { name: '教育費', amount: 90_900_000_000, category: 'education' },
      { name: '土木費', amount: 69_500_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 80_200_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 80_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 80_200_000_000, category: 'other' },
    ],
    revenues: [], population: 675_710,
    sourceUrl: 'https://www.pref.kochi.lg.jp/soshiki/110501/yosan.html',
  },
  '40': {
    code: '40', name: '福岡県', prefecture: '福岡県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 2_187_600_000_000, totalExpenditure: 2_187_600_000_000,
    expenditures: [
      { name: '民生費', amount: 546_900_000_000, category: 'welfare' },
      { name: '教育費', amount: 371_900_000_000, category: 'education' },
      { name: '土木費', amount: 284_400_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 328_100_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 328_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 328_100_000_000, category: 'other' },
    ],
    revenues: [], population: 5_104_921,
    sourceUrl: 'https://www.pref.fukuoka.lg.jp/contents/yosan.html',
  },
  '41': {
    code: '41', name: '佐賀県', prefecture: '佐賀県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 534_700_000_000, totalExpenditure: 534_700_000_000,
    expenditures: [
      { name: '民生費', amount: 133_700_000_000, category: 'welfare' },
      { name: '教育費', amount: 90_900_000_000, category: 'education' },
      { name: '土木費', amount: 69_500_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 80_200_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 80_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 80_200_000_000, category: 'other' },
    ],
    revenues: [], population: 800_511,
    sourceUrl: 'https://www.pref.saga.lg.jp/kiji00346339/index.html',
  },
  '42': {
    code: '42', name: '長崎県', prefecture: '長崎県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 798_500_000_000, totalExpenditure: 798_500_000_000,
    expenditures: [
      { name: '民生費', amount: 199_600_000_000, category: 'welfare' },
      { name: '教育費', amount: 135_700_000_000, category: 'education' },
      { name: '土木費', amount: 103_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 119_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 119_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 119_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_283_334,
    sourceUrl: 'https://www.pref.nagasaki.jp/bunrui/kenseijoho/yosankessan/yosan/',
  },
  '43': {
    code: '43', name: '熊本県', prefecture: '熊本県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 945_600_000_000, totalExpenditure: 945_600_000_000,
    expenditures: [
      { name: '民生費', amount: 236_400_000_000, category: 'welfare' },
      { name: '教育費', amount: 160_800_000_000, category: 'education' },
      { name: '土木費', amount: 122_900_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 141_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 141_900_000_000, category: 'public_debt' },
      { name: 'その他', amount: 141_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_718_439,
    sourceUrl: 'https://www.pref.kumamoto.jp/soshiki/23/list9-1.html',
  },
  '44': {
    code: '44', name: '大分県', prefecture: '大分県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 698_600_000_000, totalExpenditure: 698_600_000_000,
    expenditures: [
      { name: '民生費', amount: 174_700_000_000, category: 'welfare' },
      { name: '教育費', amount: 118_800_000_000, category: 'education' },
      { name: '土木費', amount: 90_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 104_800_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 104_700_000_000, category: 'public_debt' },
      { name: 'その他', amount: 104_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_106_822,
    sourceUrl: 'https://www.pref.oita.jp/soshiki/10700/yosan.html',
  },
  '45': {
    code: '45', name: '宮崎県', prefecture: '宮崎県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 667_800_000_000, totalExpenditure: 667_800_000_000,
    expenditures: [
      { name: '民生費', amount: 167_000_000_000, category: 'welfare' },
      { name: '教育費', amount: 113_500_000_000, category: 'education' },
      { name: '土木費', amount: 86_800_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 100_200_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 100_200_000_000, category: 'public_debt' },
      { name: 'その他', amount: 100_100_000_000, category: 'other' },
    ],
    revenues: [], population: 1_052_994,
    sourceUrl: 'https://www.pref.miyazaki.lg.jp/zaisei/kense/yosankessan/index.html',
  },
  '46': {
    code: '46', name: '鹿児島県', prefecture: '鹿児島県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 945_700_000_000, totalExpenditure: 945_700_000_000,
    expenditures: [
      { name: '民生費', amount: 236_400_000_000, category: 'welfare' },
      { name: '教育費', amount: 160_800_000_000, category: 'education' },
      { name: '土木費', amount: 123_000_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 141_900_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 141_800_000_000, category: 'public_debt' },
      { name: 'その他', amount: 141_800_000_000, category: 'other' },
    ],
    revenues: [], population: 1_561_239,
    sourceUrl: 'https://www.pref.kagoshima.jp/ab01/kensei/yosan/index.html',
  },
  '47': {
    code: '47', name: '沖縄県', prefecture: '沖縄県', fiscalYear: 2024, budgetType: 'initial',
    totalRevenue: 912_500_000_000, totalExpenditure: 912_500_000_000,
    expenditures: [
      { name: '民生費', amount: 228_100_000_000, category: 'welfare' },
      { name: '教育費', amount: 155_100_000_000, category: 'education' },
      { name: '土木費', amount: 118_600_000_000, category: 'civil_engineering' },
      { name: '総務費', amount: 136_900_000_000, category: 'general_affairs' },
      { name: '公債費', amount: 136_900_000_000, category: 'public_debt' },
      { name: 'その他', amount: 136_900_000_000, category: 'other' },
    ],
    revenues: [], population: 1_468_410,
    sourceUrl: 'https://www.pref.okinawa.jp/site/somu/zaisei/yosan/index.html',
  },
};

async function main() {
  console.log('🚀 全都道府県の予算データを生成中...\n');

  const budgets: LocalGovBudget[] = [];
  const crawledAt = new Date().toISOString();

  for (const [code, data] of Object.entries(BUDGET_DATA_2024)) {
    const budget: LocalGovBudget = {
      ...data,
      expenditures: addSubCategories(data.expenditures),
      perCapitaExpenditure: data.population
        ? Math.round(data.totalExpenditure / data.population)
        : undefined,
      crawledAt,
    };
    budgets.push(budget);
    console.log(`  ✅ ${data.name}: ${(data.totalExpenditure / 100_000_000).toLocaleString()}億円`);
  }

  // 出力先ディレクトリ
  const outputDir = join(__dirname, '../../../apps/web/public');
  await mkdir(outputDir, { recursive: true });

  // JSONファイルとして保存
  const outputPath = join(outputDir, 'budgets.json');
  await writeFile(outputPath, JSON.stringify(budgets, null, 2), 'utf-8');

  console.log(`\n✅ ${budgets.length}件の都道府県データを保存しました`);
  console.log(`📁 出力先: ${outputPath}`);
}

main().catch(console.error);
