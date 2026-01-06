'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { Layer, Path } from 'leaflet';
import type { LocalGovBudget, GeoFeature } from '@/types/budget';

interface BudgetMapProps {
  onSelectRegion: (region: LocalGovBudget | null) => void;
}

// ポリゴンの面積を計算（符号付き）
function calcPolygonArea(coords: number[][]): number {
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i + 1][1];
    area -= coords[i + 1][0] * coords[i][1];
  }
  return Math.abs(area / 2);
}

// ポリゴンの重心を計算
function calcPolygonCentroid(coords: number[][]): [number, number] {
  let cx = 0, cy = 0, area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const cross = coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
    cx += (coords[i][0] + coords[i + 1][0]) * cross;
    cy += (coords[i][1] + coords[i + 1][1]) * cross;
    area += cross;
  }
  area /= 2;
  cx /= (6 * area);
  cy /= (6 * area);
  return [cy, cx]; // [lat, lng]
}

// 最大ポリゴンの重心を取得
function getLargestPolygonCenter(geometry: any): [number, number] | null {
  if (geometry.type === 'Polygon') {
    return calcPolygonCentroid(geometry.coordinates[0]);
  }

  if (geometry.type === 'MultiPolygon') {
    let maxArea = 0;
    let largestCoords: number[][] | null = null;

    for (const polygon of geometry.coordinates) {
      const area = calcPolygonArea(polygon[0]);
      if (area > maxArea) {
        maxArea = area;
        largestCoords = polygon[0];
      }
    }

    if (largestCoords) {
      return calcPolygonCentroid(largestCoords);
    }
  }

  return null;
}

// 予算額に応じた色を返す
function getBudgetColor(amount: number): string {
  if (amount === 0) return '#e0e0e0';
  if (amount < 100_000_000_000) return '#c6dbef';      // 1000億未満
  if (amount < 500_000_000_000) return '#6baed6';      // 5000億未満
  if (amount < 1_000_000_000_000) return '#2171b5';    // 1兆未満
  return '#084594';                                     // 1兆以上
}

export default function BudgetMap({ onSelectRegion }: BudgetMapProps) {
  const [geoData, setGeoData] = useState<GeoFeature[] | null>(null);
  const selectedLayerRef = useRef<Path | null>(null);
  const layerMapRef = useRef<Map<string, { layer: Path; feature: GeoFeature }>>(new Map());

  useEffect(() => {
    Promise.all([
      fetch('/japan.geojson').then((res) => res.json()),
      fetch('/budgets.json').then((res) => res.json()),
    ])
      .then(([geoJson, budgets]: [{ features: any[] }, LocalGovBudget[]]) => {
        const budgetMap = new Map(budgets.map((b) => [b.code, b]));

        const featuresWithBudget = geoJson.features.map((feature) => {
          const code = String(feature.properties.id).padStart(2, '0');
          const center = getLargestPolygonCenter(feature.geometry);
          return {
            ...feature,
            properties: {
              code,
              name: feature.properties.nam_ja,
              budget: budgetMap.get(code),
              center,
            },
          };
        });

        setGeoData(featuresWithBudget as GeoFeature[]);
      })
      .catch((err) => console.error('データ読み込みエラー:', err));
  }, []);

  const getDefaultStyle = useCallback((feature: GeoFeature) => {
    const budget = feature.properties.budget;
    return {
      fillColor: getBudgetColor(budget?.totalExpenditure ?? 0),
      weight: 0,
      fillOpacity: 0.7,
    };
  }, []);

  const getSelectedStyle = useCallback(() => ({
    fillColor: '#ffd700',
    weight: 2,
    color: '#333',
    fillOpacity: 0.9,
  }), []);

  const onEachFeature = useCallback((feature: GeoFeature, layer: Layer) => {
    const pathLayer = layer as Path;
    const code = feature.properties.code;

    // レイヤーを保存
    layerMapRef.current.set(code, { layer: pathLayer, feature });

    const center = feature.properties.center as [number, number] | undefined;

    // ホバー用ツールチップを作成
    const hoverTooltip = feature.properties.name
      ? L.tooltip({
          permanent: false,
          direction: 'center',
          className: 'prefecture-tooltip',
        }).setContent(feature.properties.name)
      : null;

    // 選択用ツールチップを作成
    const selectTooltip = feature.properties.name
      ? L.tooltip({
          permanent: false,
          direction: 'center',
          className: 'prefecture-tooltip',
        }).setContent(feature.properties.name)
      : null;

    pathLayer.on({
      click: (e) => {
        const map = e.target._map;

        // 前の選択のツールチップを閉じる
        if (selectedLayerRef.current) {
          const prevEntry = Array.from(layerMapRef.current.values()).find(
            (entry) => entry.layer === selectedLayerRef.current
          );
          if (prevEntry) {
            selectedLayerRef.current.setStyle(getDefaultStyle(prevEntry.feature));
            // 前の選択のツールチップを閉じる
            const prevTooltip = (selectedLayerRef.current as any)._selectTooltip;
            if (prevTooltip) {
              map.closeTooltip(prevTooltip);
            }
          }
        }

        // 新しい選択をハイライト
        pathLayer.setStyle(getSelectedStyle());
        selectedLayerRef.current = pathLayer;
        (pathLayer as any)._selectTooltip = selectTooltip;

        // 選択用ツールチップを表示
        if (selectTooltip && center) {
          selectTooltip.setLatLng(center);
          map.openTooltip(selectTooltip);
        }

        if (feature.properties.budget) {
          onSelectRegion(feature.properties.budget);
        }
      },
      mouseover: (e) => {
        const map = e.target._map;

        // ホバー時に枠線を表示（選択中でなければ）
        if (selectedLayerRef.current !== pathLayer) {
          pathLayer.setStyle({
            ...getDefaultStyle(feature),
            weight: 2,
            color: '#333',
          });
          // ホバー用ツールチップを表示（選択中でなければ）
          if (hoverTooltip && center) {
            hoverTooltip.setLatLng(center);
            map.openTooltip(hoverTooltip);
          }
        }
      },
      mouseout: (e) => {
        const map = e.target._map;

        // ホバー解除時に枠線を消す（選択中でなければ）
        if (selectedLayerRef.current !== pathLayer) {
          pathLayer.setStyle(getDefaultStyle(feature));
          // ホバー用ツールチップを閉じる
          if (hoverTooltip) {
            map.closeTooltip(hoverTooltip);
          }
        }
      },
    });
  }, [onSelectRegion, getDefaultStyle, getSelectedStyle]);

  const style = useCallback((feature: GeoFeature | undefined) => {
    if (!feature) return {};
    return getDefaultStyle(feature);
  }, [getDefaultStyle]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={[36.5, 138]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoData && (
          <GeoJSON
            data={{ type: 'FeatureCollection', features: geoData } as any}
            style={style as any}
            onEachFeature={onEachFeature as any}
          />
        )}
      </MapContainer>
      <div className="legend">
        <div className="legend-title">歳出規模</div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#c6dbef' }} />
          <span>1000億円未満</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#6baed6' }} />
          <span>1000億〜5000億円</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#2171b5' }} />
          <span>5000億〜1兆円</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#084594' }} />
          <span>1兆円以上</span>
        </div>
      </div>
    </div>
  );
}
