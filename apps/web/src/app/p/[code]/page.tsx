/**
 * 都道府県ごとの共有用ページ（/p/13/ など47ページを事前ビルド）。
 * 中身はトップと同じアプリだが、県別のOGPタイトル・説明文を
 * ビルド時に budgets.json から焼き込むため、共有時に「どこの何か」が伝わる。
 * 選択状態の復元は Home がURLパス（/p/{code}）から行う。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Metadata } from 'next';
import Home from '@/components/Home';
import { formatAmount } from '@/lib/format';
import type { LocalGovBudget } from '@/types/budget';

const SITE_URL = 'https://ina299.github.io/local_gov_vis/';
const BASE_TITLE = '地方自治体予算マップ';

// 静的エクスポートでは事前生成した47県以外のパスは存在しない
export const dynamicParams = false;

function loadBudgets(): LocalGovBudget[] {
  const path = join(process.cwd(), 'public', 'budgets.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as LocalGovBudget[];
}

export function generateStaticParams(): Array<{ code: string }> {
  const codes = new Set(loadBudgets().map((b) => b.code));
  return Array.from(codes)
    .filter((code) => /^\d{2}$/.test(code))
    .sort()
    .map((code) => ({ code }));
}

export function generateMetadata({ params }: { params: { code: string } }): Metadata {
  const budgets = loadBudgets().filter((b) => b.code === params.code);
  const latest = budgets.reduce<LocalGovBudget | null>(
    (acc, b) => (acc === null || b.fiscalYear > acc.fiscalYear ? b : acc),
    null
  );
  if (!latest) return {};

  const title = `${latest.name}の財政 | ${BASE_TITLE}`;
  const perCapita = latest.population
    ? `・住民1人あたり${formatAmount(Math.round(latest.totalExpenditure / latest.population))}`
    : '';
  const description =
    `${latest.name}の${latest.fiscalYear}年度決算は歳出${formatAmount(latest.totalExpenditure)}` +
    `${perCapita}。どの財源が何に使われたかを収支図と地図で見られます。`;
  const url = `${SITE_URL}p/${params.code}/`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: BASE_TITLE,
      locale: 'ja_JP',
      type: 'website',
      images: [{ url: 'og.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['og.png'],
    },
  };
}

export default function Page() {
  return <Home />;
}
