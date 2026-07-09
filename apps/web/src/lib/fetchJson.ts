/**
 * データ取得の共通ヘルパー。res.okを検証し、失敗時はステータスとURLを含む
 * エラーを投げる（呼び出し側でエラーバナー表示・再試行に使う）
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`データ取得に失敗しました (${res.status} ${res.statusText}) ${url}`);
  }
  return (await res.json()) as T;
}
