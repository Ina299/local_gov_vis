/**
 * 指標ごとの共有用ページ（/m/population/ など指標分を事前ビルド）。
 * 中身はトップと同じアプリだが、指標名入りのOGPタイトル・説明・
 * 指標別コロプレス画像（og/{指標}.png、build:ogで生成）をビルド時に焼き込むため、
 * 「人口」「財政力指数」などの地図を共有した時に何の地図かが伝わる。
 * 選択状態の復元は Home がURLパス（/m/{指標}）から行う。
 * デフォルト指標の歳出はトップ（/）のOGPと同じため事前生成しない。
 */
import type { Metadata } from 'next';
import Home from '@/components/Home';
import { METRICS } from '@/lib/metrics';

const SITE_URL = 'https://ina299.github.io/local_gov_vis/';
const BASE_TITLE = '地方自治体予算マップ';

// 静的エクスポートでは事前生成した指標以外のパスは存在しない
export const dynamicParams = false;

export function generateStaticParams(): Array<{ metric: string }> {
  return METRICS.filter((m) => m.key !== 'expenditure').map((m) => ({ metric: m.key }));
}

export function generateMetadata({ params }: { params: { metric: string } }): Metadata {
  const def = METRICS.find((m) => m.key === params.metric);
  if (!def) return {};

  const title = `全国の${def.label}マップ | ${BASE_TITLE}`;
  const scope = def.prefOnly ? '47都道府県' : '47都道府県・約1,700市区町村';
  const description = `${def.description ?? def.label}。${scope}を色分け地図で比較できます。`;
  const url = `${SITE_URL}m/${def.key}/`;
  const image = `og/${def.key}.png`;

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
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function Page() {
  return <Home />;
}
