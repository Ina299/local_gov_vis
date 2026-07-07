import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Category mapping for budget items
const categoryMap: Record<string, string> = {
  '議会費': 'legislature',
  '総務費': 'general_affairs',
  '徴税費': 'general_affairs',
  '民生費': 'welfare',
  '福祉費': 'welfare',
  '社会福祉費': 'welfare',
  '障がい者福祉費': 'welfare',
  '高齢者福祉費': 'welfare',
  '児童福祉費': 'welfare',
  '生活保護費': 'welfare',
  '衛生費': 'health',
  '保健医療費': 'health',
  '労働費': 'labor',
  '農林水産業費': 'agriculture',
  '商工費': 'commerce',
  '産業労働費': 'commerce',
  '土木費': 'civil_engineering',
  '都市整備費': 'civil_engineering',
  '警察費': 'police',
  '消防費': 'fire',
  '教育費': 'education',
  '公債費': 'debt',
  '諸支出金': 'other',
  '予備費': 'reserve',
  '財務管理費': 'general_affairs',
  'スマートシティ戦略費': 'general_affairs',
  '副首都推進費': 'general_affairs',
  '政策企画費': 'general_affairs',
  '万博推進費': 'general_affairs',
  'IR推進費': 'general_affairs',
  '防災費': 'disaster_prevention',
  '統計調査費': 'general_affairs',
  '人事委員会費': 'general_affairs',
  '監査委員費': 'general_affairs',
  '市町村振興費': 'general_affairs',
  '選挙費': 'general_affairs',
  '府民文化費': 'culture',
  '環境費': 'environment',
};

interface ExtractedItem {
  款番号: string;
  款名: string;
  予算額: number;
}

interface ExtractedData {
  prefecture: string;
  code: string;
  source_url: string;
  categories: ExtractedItem[];
}

interface BudgetItem {
  name: string;
  amount: number;
  category: string;
  children?: BudgetItem[];
}

interface PrefectureBudget {
  code: string;
  name: string;
  prefecture: string;
  fiscalYear: number;
  budgetType: string;
  totalRevenue: number;
  totalExpenditure: number;
  expenditures: BudgetItem[];
  sourceUrl: string;
  perCapitaExpenditure?: number;
  crawledAt: string;
}

function convertExtractedToBudget(extracted: ExtractedData): BudgetItem[] {
  const mainCategories: BudgetItem[] = [];
  const categoryGroups: Map<string, ExtractedItem[]> = new Map();

  // Group items by category type
  for (const item of extracted.categories) {
    const name = item.款名;
    const cat = categoryMap[name] || 'other';

    if (!categoryGroups.has(cat)) {
      categoryGroups.set(cat, []);
    }
    categoryGroups.get(cat)!.push(item);
  }

  // Convert to budget items
  for (const [category, items] of categoryGroups) {
    // For simplicity, treat each item as a main category with its amount
    for (const item of items) {
      // Amount in extracted data is in thousands (千円), convert to yen
      const amountInYen = item.予算額 * 1000;

      mainCategories.push({
        name: item.款名,
        amount: amountInYen,
        category: categoryMap[item.款名] || 'other',
      });
    }
  }

  return mainCategories;
}

async function main() {
  const baseDir = path.resolve(__dirname, '../output/prefectures');
  const budgetsPath = path.resolve(__dirname, '../../web/public/budgets.json');

  // Read current budgets
  const budgetsRaw = fs.readFileSync(budgetsPath, 'utf-8');
  const budgets: PrefectureBudget[] = JSON.parse(budgetsRaw);

  // Process extracted prefecture data
  const prefectureDirs = fs.readdirSync(baseDir);

  for (const dir of prefectureDirs) {
    const dataPath = path.join(baseDir, dir, 'budget_data.json');

    if (!fs.existsSync(dataPath)) {
      continue;
    }

    console.log(`Processing: ${dir}`);

    const extractedRaw = fs.readFileSync(dataPath, 'utf-8');
    const extracted: ExtractedData = JSON.parse(extractedRaw);

    // Find matching budget entry
    const budgetIndex = budgets.findIndex(b => b.code === extracted.code);

    if (budgetIndex === -1) {
      console.log(`  No matching budget entry for code ${extracted.code}`);
      continue;
    }

    // Convert extracted data to budget format
    const expenditures = convertExtractedToBudget(extracted);

    if (expenditures.length > 0) {
      // Calculate total from extracted data
      const totalExpenditure = expenditures.reduce((sum, item) => sum + item.amount, 0);

      // Update the budget entry
      budgets[budgetIndex].expenditures = expenditures;
      budgets[budgetIndex].totalExpenditure = totalExpenditure;
      budgets[budgetIndex].totalRevenue = totalExpenditure;
      budgets[budgetIndex].sourceUrl = extracted.source_url;
      budgets[budgetIndex].crawledAt = new Date().toISOString();

      console.log(`  Updated ${extracted.prefecture} with ${expenditures.length} categories`);
      console.log(`  Total expenditure: ${(totalExpenditure / 1e9).toFixed(2)}B yen`);
    }
  }

  // Save updated budgets
  fs.writeFileSync(budgetsPath, JSON.stringify(budgets, null, 2), 'utf-8');
  console.log('\nSaved updated budgets.json');
}

main().catch(console.error);
