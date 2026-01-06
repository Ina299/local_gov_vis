/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 静的エクスポートを有効化（サーバー不要）
  output: 'export',
  // 画像最適化は静的エクスポートでは無効
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
