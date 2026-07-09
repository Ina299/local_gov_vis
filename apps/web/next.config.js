// GitHub Pagesなどサブパス配信用（例: /local_gov_vis）。未設定ならルート配信
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 静的エクスポートを有効化（サーバー不要）
  output: 'export',
  basePath,
  // /p/{県コード}/ を p/{code}/index.html として出力し、GitHub Pagesで直接開けるようにする
  trailingSlash: true,
  // 画像最適化は静的エクスポートでは無効
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
