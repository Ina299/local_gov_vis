import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EvaluationBrowser } from '@/components/EvaluationBrowser';

export const metadata: Metadata = {
  title: '事務事業評価を読む | 地方自治体予算マップ',
  description: '自治体の事業ごとの目的・成果・コスト・評価を、原資料と取得範囲を確認しながら探せます。',
};

export default function Page() {
  return (
    <Suspense fallback={<main className="evaluation-page"><p role="status">事務事業評価を読み込んでいます…</p></main>}>
      <EvaluationBrowser />
    </Suspense>
  );
}
