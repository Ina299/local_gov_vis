import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EvaluationBrowser } from '@/components/EvaluationBrowser';

export const metadata: Metadata = {
  title: '事務事業評価を読む | 地方自治体予算マップ',
  description: '47都道府県・1,741市区町村の公式評価ページ・資料・取得テキストを探せます。整理済み事業票と資料の収録範囲を区別して表示します。',
};

export default function Page() {
  return (
    <Suspense fallback={<main className="evaluation-page"><p role="status">事務事業評価を読み込んでいます…</p></main>}>
      <EvaluationBrowser />
    </Suspense>
  );
}
