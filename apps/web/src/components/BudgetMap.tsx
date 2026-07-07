'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Layer, Path } from 'leaflet';
import type { LocalGovBudget, GeoFeature, BudgetBasis, MapScale } from '@/types/budget';
import { formatAmount } from '@/lib/format';

interface BudgetMapProps {
  /** ビュー識別子（変わるとレイヤーを作り直す） */
  viewKey: string;
  features: GeoFeature[];
  /**
   * 表示範囲合わせに使う主役のフィーチャー。
   * 市区町村ビューではfeaturesに周辺県の背景も含まれるため分けて渡す。
   * 省略時はfeatures全体
   */
  focusFeatures?: GeoFeature[];
  /** 選択年度の 自治体コード → 予算データ（現在の階層） */
  budgetsByCode: Map<string, LocalGovBudget>;
  /**
   * 市区町村ビューで背景の都道府県（2桁コード）を塗るための
   * 全国データ。全国モードの濃淡がそのまま維持される
   */
  backgroundBudgetsByCode?: Map<string, LocalGovBudget>;
  basis: BudgetBasis;
  scale: MapScale;
  /** 選択中の自治体コード（pageが管理し、ビュー切替をまたいで維持される） */
  selectedCode: string | null;
  onSelectCode: (code: string | null) => void;
  /** 都道府県（2桁コード）クリック時にドリルダウン用ポップアップを出す */
  onDrillDown?: (code: string) => void;
  /** 市区町村ビューでのみ渡される。県域の近くに「全国に戻る」ポップアップを出す */
  onBack?: () => void;
  /** 検索などで特定の自治体へ地図を移動させる。seqが変わるたびに実行される */
  focusTarget?: { code: string; seq: number } | null;
}

// 検証済みパレットのシーケンシャル（blue）ランプ: steps 100/250/400/550/700
const SEQUENTIAL_BLUES = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
const NO_DATA_COLOR = '#e0e0e0';

const NATION_CENTER: [number, number] = [36.5, 138];
const NATION_ZOOM = 5;

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

function breaksFor(budgets: Map<string, LocalGovBudget>, basis: BudgetBasis, scale: MapScale): number[] {
  const values = Array.from(budgets.values())
    .map((b) => getMetricValue(b, basis, scale))
    .filter((v): v is number => v !== null);
  return computeBreaks(values);
}

/** 地図の何もない場所（海など）のクリックを拾う */
function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

/** 地図インスタンスを親コンポーネントへ渡す */
function MapRef({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

/** ジオメトリ中の最大リング（本体）のバウンディングボックス */
function largestRingBounds(geometry: any): L.LatLngBounds | null {
  let ring: number[][] | null = null;
  let best = 0;
  const consider = (r: number[][]) => {
    const a = calcPolygonArea(r);
    if (a > best) {
      best = a;
      ring = r;
    }
  };
  if (geometry.type === 'Polygon') {
    consider(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) consider(polygon[0]);
  }
  if (!ring) return null;
  return L.latLngBounds((ring as number[][]).map(([lng, lat]) => [lat, lng] as [number, number]));
}

/** 市区町村ビューへ入ったとき県全体に表示範囲を合わせる */
function FitView({ viewKey, features }: { viewKey: string; features: GeoFeature[] }) {
  const map = useMap();
  useEffect(() => {
    if (viewKey === 'nation') return;
    if (features.length > 0) {
      // 離島（小笠原など）まで含めると本土が豆粒になるため、本土クラスタに合わせる
      const result = mainClusterBounds(features);
      if (result) {
        const { cluster } = result;
        const bounds = L.latLngBounds([cluster.s, cluster.w], [cluster.n, cluster.e]);
        // 既に県全体より深くズームしている場合は、ズームアウトになるので表示範囲を変えない
        // （同ズームなら位置合わせのパンだけ行われるので実行する）
        const targetZoom = map.getBoundsZoom(bounds, false, L.point(40, 40));
        if (map.getZoom() > targetZoom) return;
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, map]);
  return null;
}

interface SimpleBounds {
  s: number;
  w: number;
  n: number;
  e: number;
}

/**
 * 県の「本土」（最大の連結クラスタ）のバウンディングボックスを求める。
 * 全フィーチャーのバウンディングボックスだと離島（小笠原・北方領土など）まで
 * 含んでしまい、ポップアップが本土から非常に遠い位置に出るため。
 * members はクラスタに含まれる各フィーチャーのバウンディングボックス。
 */
function mainClusterBounds(
  features: GeoFeature[]
): { cluster: SimpleBounds; members: SimpleBounds[] } | null {
  const GAP = 0.6; // これ以上（度）離れたフィーチャーは別クラスタ＝離島とみなす

  // フィーチャー内で最大のリングの実面積。バウンディングボックス面積だと
  // 離島が点在するMultiPolygon（小笠原村など）が最大になってしまう
  const largestRingArea = (geometry: any): number => {
    if (geometry.type === 'Polygon') return calcPolygonArea(geometry.coordinates[0]);
    if (geometry.type === 'MultiPolygon') {
      return Math.max(...geometry.coordinates.map((p: number[][][]) => calcPolygonArea(p[0])));
    }
    return 0;
  };

  const boxes: Array<SimpleBounds & { ringArea: number }> = [];
  for (const feature of features) {
    const b = L.geoJSON(feature as any).getBounds();
    if (b.isValid()) {
      boxes.push({
        s: b.getSouth(),
        w: b.getWest(),
        n: b.getNorth(),
        e: b.getEast(),
        ringArea: largestRingArea(feature.geometry),
      });
    }
  }
  if (boxes.length === 0) return null;

  const seed = boxes.reduce((a, b) => (b.ringArea > a.ringArea ? b : a));

  let cluster: SimpleBounds = { s: seed.s, w: seed.w, n: seed.n, e: seed.e };
  const members: SimpleBounds[] = [seed];
  const remaining = boxes.filter((b) => b !== seed);
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const b = remaining[i];
      const near =
        b.w <= cluster.e + GAP &&
        b.e >= cluster.w - GAP &&
        b.s <= cluster.n + GAP &&
        b.n >= cluster.s - GAP;
      if (near) {
        cluster = {
          s: Math.min(cluster.s, b.s),
          w: Math.min(cluster.w, b.w),
          n: Math.max(cluster.n, b.n),
          e: Math.max(cluster.e, b.e),
        };
        members.push(b);
        remaining.splice(i, 1);
        merged = true;
      }
    }
  }
  return { cluster, members };
}

/** 市区町村ビューで県域の近くに「全国に戻る」ポップアップを常時表示する */
function BackPopup({
  viewKey,
  features,
  onBack,
}: {
  viewKey: string;
  features: GeoFeature[];
  onBack?: () => void;
}) {
  const map = useMap();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!onBackRef.current || features.length === 0) return;

    const result = mainClusterBounds(features);
    if (!result) return;
    const { cluster, members } = result;

    const container = document.createElement('div');
    container.className = 'drill-popup';
    const button = document.createElement('button');
    button.className = 'drill-popup-button';
    button.textContent = '← 全国に戻る';
    // 縮尺・位置は変えず、市区町村レイヤーを閉じて全国表示に戻すだけ
    button.onclick = () => onBackRef.current?.();
    container.appendChild(button);

    // 中央直上ではなく、東寄り（中央と東端の中間）に置く。
    // 緯度はバウンディングボックス北端ではなく「その経度に実在する自治体の北端」を使う
    // （横長の県だとボックス北端は県境からかなり浮いてしまうため）
    const centerLng = (cluster.w + cluster.e) / 2;
    const anchorLng = centerLng + (cluster.e - centerLng) * 0.5;
    const atLng = members.filter((b) => b.w <= anchorLng && anchorLng <= b.e);
    const anchorLat = atLng.length > 0 ? Math.max(...atLng.map((b) => b.n)) : cluster.n;
    const anchor = L.latLng(anchorLat, anchorLng);

    const popup = L.popup({
      closeButton: false,
      autoClose: false,
      closeOnClick: false,
      autoPan: false,
      offset: L.point(0, -4),
    })
      .setLatLng(anchor)
      .setContent(container)
      .addTo(map);

    // 深いズームで県北端が画面外になっても戻れるよう、常に表示範囲内へクランプする
    const clampIntoView = () => {
      const view = map.getBounds().pad(-0.08);
      popup.setLatLng(
        L.latLng(
          Math.min(Math.max(anchor.lat, view.getSouth()), view.getNorth()),
          Math.min(Math.max(anchor.lng, view.getWest()), view.getEast())
        )
      );
    };
    clampIntoView();
    map.on('moveend', clampIntoView);

    return () => {
      map.off('moveend', clampIntoView);
      map.removeLayer(popup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, map]);
  return null;
}

export default function BudgetMap({
  viewKey,
  features,
  focusFeatures,
  budgetsByCode,
  backgroundBudgetsByCode,
  basis,
  scale,
  selectedCode,
  onSelectCode,
  onDrillDown,
  onBack,
  focusTarget,
}: BudgetMapProps) {
  // 同一コードが複数ポリゴンを持つ（政令市の区）ため、レイヤーは配列で持つ
  const layersRef = useRef<Array<{ layer: Path; feature: GeoFeature }>>([]);
  const mapRef = useRef<L.Map | null>(null);
  // 選択状態はpageが持ち、refは常にプロパティを反映する（ビュー切替でも維持）
  const selectedCodeRef = useRef<string | null>(selectedCode);
  selectedCodeRef.current = selectedCode;

  // 各featureに重心（ツールチップ位置）を付与
  const preparedFeatures = useMemo(
    () =>
      features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          center: getLargestPolygonCenter(feature.geometry),
        },
      })),
    [features]
  );

  // コードから予算データを引く。背景の都道府県（2桁コード）は全国データから
  const budgetFor = useCallback(
    (code: string): LocalGovBudget | undefined =>
      code.length === 2 && backgroundBudgetsByCode
        ? backgroundBudgetsByCode.get(code)
        : budgetsByCode.get(code),
    [budgetsByCode, backgroundBudgetsByCode]
  );

  // 現在階層の分位（凡例にも使用）
  const breaks = useMemo(
    () => breaksFor(budgetsByCode, basis, scale),
    [budgetsByCode, basis, scale]
  );
  // 背景の都道府県用の分位（全国モードと同じ濃淡になる）
  const backgroundBreaks = useMemo(
    () => (backgroundBudgetsByCode ? breaksFor(backgroundBudgetsByCode, basis, scale) : []),
    [backgroundBudgetsByCode, basis, scale]
  );

  const getDefaultStyle = useCallback((feature: GeoFeature) => {
    const code = feature.properties.code;
    const isBackground = code.length === 2 && backgroundBudgetsByCode !== undefined;
    return {
      fillColor: getClassColor(
        getMetricValue(budgetFor(code), basis, scale),
        isBackground ? backgroundBreaks : breaks
      ),
      weight: viewKey === 'nation' || isBackground ? 0 : 1,
      color: '#ffffff',
      fillOpacity: 0.7,
    };
  }, [budgetFor, backgroundBudgetsByCode, basis, scale, breaks, backgroundBreaks, viewKey]);

  const getSelectedStyle = useCallback(() => ({
    fillColor: '#ffd700',
    weight: 2,
    color: '#333',
    fillOpacity: 0.9,
  }), []);

  // イベントハンドラのクロージャから常に最新のスタイル/指標/データを参照できるようにする
  const getDefaultStyleRef = useRef(getDefaultStyle);
  getDefaultStyleRef.current = getDefaultStyle;
  const getSelectedStyleRef = useRef(getSelectedStyle);
  getSelectedStyleRef.current = getSelectedStyle;
  const basisRef = useRef(basis);
  basisRef.current = basis;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const budgetForRef = useRef(budgetFor);
  budgetForRef.current = budgetFor;
  const onDrillDownRef = useRef(onDrillDown);
  onDrillDownRef.current = onDrillDown;

  // 全レイヤーを現在の選択状態に合わせて塗る
  const applyStyles = useCallback(() => {
    for (const { layer, feature } of layersRef.current) {
      layer.setStyle(
        feature.properties.code === selectedCodeRef.current
          ? getSelectedStyleRef.current()
          : getDefaultStyleRef.current(feature)
      );
    }
  }, []);

  // ビュー切替時にレイヤー参照をリセット
  // （effectだと新レイヤーの登録後に走ってしまうため、render中に同期で行う）
  const prevViewKeyRef = useRef(viewKey);
  if (prevViewKeyRef.current !== viewKey) {
    prevViewKeyRef.current = viewKey;
    layersRef.current = [];
  }

  // 指標・年度・ビュー切替時に塗り直す（選択ハイライトも復元される）
  useEffect(() => {
    applyStyles();
  }, [getDefaultStyle, selectedCode, applyStyles]);

  const clearSelection = useCallback(() => {
    if (selectedCodeRef.current === null) return;
    selectedCodeRef.current = null;
    applyStyles();
    onSelectCode(null);
  }, [onSelectCode, applyStyles]);

  // ドリルダウン用ポップアップ（県名＋市区町村を表示ボタン）を開く
  const openDrillPopup = useCallback(
    (map: L.Map, code: string, name: string, latlng: L.LatLngExpression) => {
      if (!onDrillDownRef.current) return;
      const container = document.createElement('div');
      container.className = 'drill-popup';
      const title = document.createElement('div');
      title.className = 'drill-popup-title';
      title.textContent = name;
      const button = document.createElement('button');
      button.className = 'drill-popup-button';
      button.textContent = '市区町村を表示';
      button.onclick = () => {
        map.closePopup();
        onDrillDownRef.current?.(code);
      };
      container.appendChild(title);
      container.appendChild(button);

      L.popup({ closeButton: false, autoPan: false, offset: L.point(0, -4) })
        .setLatLng(latlng)
        .setContent(container)
        .openOn(map);
    },
    []
  );

  // 検索などからの自治体フォーカス
  useEffect(() => {
    if (!focusTarget) return;
    const map = mapRef.current;
    if (!map) return;
    const matched = layersRef.current.filter(
      ({ feature }) => feature.properties.code === focusTarget.code
    );
    if (matched.length === 0) return;

    // 離島を含む全域ではなく本体（最大リング）に合わせる
    let bounds: L.LatLngBounds | null = null;
    for (const { feature } of matched) {
      const b = largestRingBounds(feature.geometry);
      if (b) bounds = bounds ? bounds.extend(b) : b;
    }
    if (!bounds) return;

    const isPref = focusTarget.code.length === 2;
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: isPref ? 9 : 11 });
    if (isPref) {
      const center = matched[0].feature.properties.center as [number, number] | undefined;
      openDrillPopup(
        map,
        focusTarget.code,
        matched[0].feature.properties.name ?? '',
        center ?? bounds.getCenter()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  const onEachFeature = useCallback((feature: GeoFeature, layer: Layer) => {
    const pathLayer = layer as Path;
    const code = feature.properties.code;

    layersRef.current.push({ layer: pathLayer, feature });

    const center = feature.properties.center as [number, number] | undefined;

    const tooltipContent = () => {
      const name = feature.properties.name ?? '';
      const value = getMetricValue(budgetForRef.current(code), basisRef.current, scaleRef.current);
      if (value === null) return name;
      return `<strong>${name}</strong><br>${metricLabel(basisRef.current, scaleRef.current)}: ${formatAmount(value)}`;
    };

    // 自治体の中心に被らないよう上方向にずらす
    const hoverTooltip = L.tooltip({
      permanent: false,
      direction: 'center',
      offset: L.point(0, -56),
      className: 'prefecture-tooltip',
    });

    pathLayer.on({
      click: (e) => {
        // 地図側のクリック（選択解除）に伝播させない。
        // Leafletイベントごと渡さないと内部の _stopped フラグが立たない
        L.DomEvent.stopPropagation(e as any);

        const map = e.target._map;

        selectedCodeRef.current = code;
        applyStyles();
        onSelectCode(code);

        // 選択と同時にホバーツールチップを閉じる
        map.closeTooltip(hoverTooltip);

        // 都道府県（2桁コード）ならドリルダウン用ポップアップを表示
        if (code.length === 2) {
          openDrillPopup(map, code, feature.properties.name ?? '', e.latlng);
        }
      },
      mouseover: (e) => {
        const map = e.target._map;

        // 選択中の自治体には枠線もツールチップも出さない
        if (selectedCodeRef.current !== code) {
          pathLayer.setStyle({
            ...getDefaultStyleRef.current(feature),
            weight: 2,
            color: '#333',
          });
          if (center) {
            hoverTooltip.setContent(tooltipContent());
            hoverTooltip.setLatLng(center);
            map.openTooltip(hoverTooltip);
          }
        }
      },
      mouseout: (e) => {
        const map = e.target._map;

        // ホバー解除時に枠線を消す（選択中でなければ）
        if (selectedCodeRef.current !== code) {
          pathLayer.setStyle(getDefaultStyleRef.current(feature));
        }
        // ホバー用ツールチップを閉じる
        map.closeTooltip(hoverTooltip);
      },
    });
  }, [onSelectCode, applyStyles, openDrillPopup]);

  const style = useCallback((feature: GeoFeature | undefined) => {
    if (!feature) return {};
    if (feature.properties.code === selectedCodeRef.current) return getSelectedStyle();
    return getDefaultStyle(feature);
  }, [getDefaultStyle, getSelectedStyle]);

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
        center={NATION_CENTER}
        zoom={NATION_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapRef mapRef={mapRef} />
        <MapClickHandler onClick={clearSelection} />
        <FitView viewKey={viewKey} features={focusFeatures ?? features} />
        <BackPopup viewKey={viewKey} features={focusFeatures ?? features} onBack={onBack} />
        {preparedFeatures.length > 0 && (
          <GeoJSON
            key={viewKey}
            data={{ type: 'FeatureCollection', features: preparedFeatures } as any}
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
