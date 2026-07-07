'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Layer, Path } from 'leaflet';
import type { LocalGovBudget, GeoFeature, BudgetBasis, MapScale } from '@/types/budget';
import { formatAmount } from '@/lib/format';

interface BudgetMapProps {
  /** 選択年度の 自治体コード → 予算データ */
  budgetsByCode: Map<string, LocalGovBudget>;
  basis: BudgetBasis;
  scale: MapScale;
  onSelectCode: (code: string | null) => void;
}

// 検証済みパレットのシーケンシャル（blue）ランプ: steps 100/250/400/550/700
const SEQUENTIAL_BLUES = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
const NO_DATA_COLOR = '#e0e0e0';

/** 指標の表示名（例: 歳出総額 / 一人当たり歳入） */
function metricLabel(basis: BudgetBasis, scale: MapScale): string {
  const basisLabel = basis === 'revenue' ? '歳入' : '歳出';
  return scale === 'perCapita' ? `一人当たり${basisLabel}` : `${basisLabel}総額`;
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

// 指標値を取得（データなしは null）
function getMetricValue(
  budget: LocalGovBudget | undefined,
  basis: BudgetBasis,
  scale: MapScale
): number | null {
  if (!budget) return null;
  const amount = basis === 'revenue' ? budget.totalRevenue : budget.totalExpenditure;
  if (scale === 'perCapita') {
    if (!budget.population) return null;
    return amount / budget.population;
  }
  return amount;
}

// 分位点ベースで階級の境界値を計算（5階級 → 境界4つ）
function computeBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return [0.2, 0.4, 0.6, 0.8].map((q) => {
    const pos = q * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  });
}

function getClassColor(value: number | null, breaks: number[]): string {
  if (value === null) return NO_DATA_COLOR;
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return SEQUENTIAL_BLUES[i];
}

/** 地図の何もない場所（海など）のクリックを拾う */
function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export default function BudgetMap({ budgetsByCode, basis, scale, onSelectCode }: BudgetMapProps) {
  const [geoData, setGeoData] = useState<GeoFeature[] | null>(null);
  const selectedLayerRef = useRef<Path | null>(null);
  const layerMapRef = useRef<Map<string, { layer: Path; feature: GeoFeature }>>(new Map());

  useEffect(() => {
    fetch('/japan.geojson')
      .then((res) => res.json())
      .then((geoJson: { features: any[] }) => {
        const features = geoJson.features.map((feature) => ({
          ...feature,
          properties: {
            code: String(feature.properties.id).padStart(2, '0'),
            name: feature.properties.nam_ja,
            center: getLargestPolygonCenter(feature.geometry),
          },
        }));
        setGeoData(features as GeoFeature[]);
      })
      .catch((err) => console.error('地図データ読み込みエラー:', err));
  }, []);

  const breaks = useMemo(() => {
    const values = Array.from(budgetsByCode.values())
      .map((b) => getMetricValue(b, basis, scale))
      .filter((v): v is number => v !== null);
    return computeBreaks(values);
  }, [budgetsByCode, basis, scale]);

  const getDefaultStyle = useCallback((feature: GeoFeature) => ({
    fillColor: getClassColor(
      getMetricValue(budgetsByCode.get(feature.properties.code), basis, scale),
      breaks
    ),
    weight: 0,
    fillOpacity: 0.7,
  }), [budgetsByCode, basis, scale, breaks]);

  const getSelectedStyle = useCallback(() => ({
    fillColor: '#ffd700',
    weight: 2,
    color: '#333',
    fillOpacity: 0.9,
  }), []);

  // イベントハンドラのクロージャから常に最新のスタイル/指標/データを参照できるようにする
  const getDefaultStyleRef = useRef(getDefaultStyle);
  getDefaultStyleRef.current = getDefaultStyle;
  const basisRef = useRef(basis);
  basisRef.current = basis;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const budgetsRef = useRef(budgetsByCode);
  budgetsRef.current = budgetsByCode;

  // 選択を解除して通常スタイルに戻す（海クリック時）
  const clearSelection = useCallback(() => {
    if (!selectedLayerRef.current) return;
    const prevEntry = Array.from(layerMapRef.current.values()).find(
      (entry) => entry.layer === selectedLayerRef.current
    );
    if (prevEntry) {
      prevEntry.layer.setStyle(getDefaultStyleRef.current(prevEntry.feature));
    }
    selectedLayerRef.current = null;
    onSelectCode(null);
  }, [onSelectCode]);

  // 指標・年度切替時に選択中以外のレイヤーを塗り直す
  useEffect(() => {
    for (const { layer, feature } of Array.from(layerMapRef.current.values())) {
      if (layer !== selectedLayerRef.current) {
        layer.setStyle(getDefaultStyle(feature));
      }
    }
  }, [getDefaultStyle]);

  const onEachFeature = useCallback((feature: GeoFeature, layer: Layer) => {
    const pathLayer = layer as Path;
    const code = feature.properties.code;

    // レイヤーを保存
    layerMapRef.current.set(code, { layer: pathLayer, feature });

    const center = feature.properties.center as [number, number] | undefined;

    const tooltipContent = () => {
      const name = feature.properties.name ?? '';
      const value = getMetricValue(budgetsRef.current.get(code), basisRef.current, scaleRef.current);
      if (value === null) return name;
      return `<strong>${name}</strong><br>${metricLabel(basisRef.current, scaleRef.current)}: ${formatAmount(value)}`;
    };

    // 県の中心に被らないよう上方向にずらす
    const tooltipOffset = L.point(0, -56);

    // ホバー用ツールチップを作成
    const hoverTooltip = feature.properties.name
      ? L.tooltip({
          permanent: false,
          direction: 'center',
          offset: tooltipOffset,
          className: 'prefecture-tooltip',
        })
      : null;

    pathLayer.on({
      click: (e) => {
        // 地図側のクリック（選択解除）に伝播させない。
        // Leafletイベントごと渡さないと内部の _stopped フラグが立たない
        L.DomEvent.stopPropagation(e as any);

        // 前の選択のハイライトを戻す
        if (selectedLayerRef.current) {
          const prevEntry = Array.from(layerMapRef.current.values()).find(
            (entry) => entry.layer === selectedLayerRef.current
          );
          if (prevEntry) {
            selectedLayerRef.current.setStyle(getDefaultStyleRef.current(prevEntry.feature));
          }
        }

        // 新しい選択をハイライト
        pathLayer.setStyle(getSelectedStyle());
        selectedLayerRef.current = pathLayer;

        onSelectCode(code);
      },
      mouseover: (e) => {
        const map = e.target._map;

        // ホバー時に枠線を表示（選択中でなければ）
        if (selectedLayerRef.current !== pathLayer) {
          pathLayer.setStyle({
            ...getDefaultStyleRef.current(feature),
            weight: 2,
            color: '#333',
          });
        }
        // ホバー用ツールチップを表示
        if (hoverTooltip && center) {
          hoverTooltip.setContent(tooltipContent());
          hoverTooltip.setLatLng(center);
          map.openTooltip(hoverTooltip);
        }
      },
      mouseout: (e) => {
        const map = e.target._map;

        // ホバー解除時に枠線を消す（選択中でなければ）
        if (selectedLayerRef.current !== pathLayer) {
          pathLayer.setStyle(getDefaultStyleRef.current(feature));
        }
        // ホバー用ツールチップを閉じる
        if (hoverTooltip) {
          map.closeTooltip(hoverTooltip);
        }
      },
    });
  }, [onSelectCode, getSelectedStyle]);

  const style = useCallback((feature: GeoFeature | undefined) => {
    if (!feature) return {};
    return getDefaultStyle(feature);
  }, [getDefaultStyle]);

  // 凡例の階級ラベルを生成
  const legendItems = useMemo(() => {
    if (breaks.length === 0) return [];
    return SEQUENTIAL_BLUES.map((color, i) => {
      let label: string;
      if (i === 0) {
        label = `${formatAmount(breaks[0])}未満`;
      } else if (i === breaks.length) {
        label = `${formatAmount(breaks[breaks.length - 1])}以上`;
      } else {
        label = `${formatAmount(breaks[i - 1])}〜${formatAmount(breaks[i])}`;
      }
      return { color, label };
    });
  }, [breaks]);

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
        <MapClickHandler onClick={clearSelection} />
        {geoData && (
          <GeoJSON
            data={{ type: 'FeatureCollection', features: geoData } as any}
            style={style as any}
            onEachFeature={onEachFeature as any}
          />
        )}
      </MapContainer>
      {legendItems.length > 0 && (
        <div className="legend">
          <div className="legend-title">{metricLabel(basis, scale)}（5分位）</div>
          {legendItems.map(({ color, label }) => (
            <div className="legend-item" key={color}>
              <div className="legend-color" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
