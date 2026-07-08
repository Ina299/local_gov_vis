/**
 * data/geo のGeoJSON（ソース）をTopoJSONへ変換して apps/web/public に出力する。
 * 隣接ポリゴンが共有する境界線をarcとして1本化し、座標を量子化することで
 * GeoJSON比で生サイズを約9割削減する（web側は topojson-client の feature() で復元）。
 *
 * 実行: npm run -w @local-gov/crawler build:topo
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { topology } from 'topojson-server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const GEO_DIR = join(REPO_ROOT, 'data', 'geo');
const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');

/** GeoJSONを読み、オブジェクト名 `geo` のTopoJSONとして書き出す */
function convert(src: string, dest: string, quantization: number): void {
  const geojson = JSON.parse(readFileSync(src, 'utf-8'));
  const topo = topology({ geo: geojson }, quantization);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(topo));
  const mb = (path: string) => (statSync(path).size / 1024 / 1024).toFixed(2);
  console.log(`${src} ${mb(src)}MB -> ${dest} ${mb(dest)}MB`);
}

// 全国都道府県（初回ロード）。日本全域で1e5格子 ≒ 30m精度
convert(join(GEO_DIR, 'japan.geojson'), join(WEB_PUBLIC, 'japan.topo.json'), 1e5);
// 全国市区町村。境界が細かいので1e6格子 ≒ 3m精度
convert(
  join(GEO_DIR, 'municipal-all.json'),
  join(WEB_PUBLIC, 'geo', 'municipal-all.topo.json'),
  1e6
);
// 都道府県別市区町村。県域で1e5格子 ≒ 数m精度
for (const file of readdirSync(join(GEO_DIR, 'municipal')).filter((f) => /^\d{2}\.json$/.test(f))) {
  convert(
    join(GEO_DIR, 'municipal', file),
    join(WEB_PUBLIC, 'geo', 'municipal', file.replace('.json', '.topo.json')),
    1e5
  );
}
