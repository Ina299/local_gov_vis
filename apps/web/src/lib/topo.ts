/**
 * TopoJSON（build-topo.tsがオブジェクト名`geo`で生成）を取得し、
 * Leafletが扱えるGeoJSON FeatureCollectionへ復元する
 */
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

export async function fetchTopoFeatures<F>(url: string): Promise<{ features: F[] }> {
  const topo: Topology = await fetch(url).then((res) => res.json());
  return feature(topo, topo.objects.geo) as unknown as { features: F[] };
}
