import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = 'https://ina299.github.io/local_gov_vis/';
const TITLE = '地方自治体予算マップ';
const DESCRIPTION =
  '47都道府県・約1,700市区町村の歳出・歳入・人口・財政指標を地図で可視化。収支図で「どの財源が何に使われたか」を住民1人あたりの金額と全国平均との差で追えます。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: TITLE,
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: 'og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
