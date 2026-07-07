/**
 * GitHub Pagesなどサブパス配信時のデータURL解決。
 * NEXT_PUBLIC_BASE_PATH はビルド時に埋め込まれる（next.config.js の basePath と揃える）
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function dataUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
