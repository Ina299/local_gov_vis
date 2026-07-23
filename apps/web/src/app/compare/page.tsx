import type { Metadata } from 'next';
import Home from '@/components/Home';

const title = '指標比較 | 地方自治体予算マップ';
const description =
  '47都道府県・約1,700市区町村の人口、財政、所得、インフラ、安全などの指標を散布図と相関係数で比較できます。';

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    url: 'https://ina299.github.io/local_gov_vis/compare/',
    siteName: '地方自治体予算マップ',
    locale: 'ja_JP',
    type: 'website',
  },
};

export default function Page() {
  return <Home initialView="comparison" />;
}
