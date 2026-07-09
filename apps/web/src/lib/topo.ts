/**
 * TopoJSON（build-topo.tsがオブジェクト名`geo`で生成）を取得し、
 * Leafletが扱えるGeoJSON FeatureCollectionへ復元する
 */
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { fetchJson } from './fetchJson';

export async function fetchTopoFeatures<F>(url: string): Promise<{ features: F[] }> {
  const topo = await fetchJson<Topology>(url);
  return feature(topo, topo.objects.geo) as unknown as { features: F[] };
}
