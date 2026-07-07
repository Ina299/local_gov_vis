'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';
import { SearchBox, type SearchEntry } from '@/components/SearchBox';
import { MetricMenu, metricCategory, type MetricCategory } from '@/components/MetricMenu';
import { metricDef, type MapMetricKey } from '@/lib/metrics';
import type { LocalGovBudget, GeoFeature, BudgetBasis, MapScale } from '@/types/budget';

// Leafletはクライアントサイドでのみ動作
const BudgetMap = dynamic(() => import('@/components/BudgetMap'), {
  ssr: false,
  loading: () => <div className="map-container">地図を読み込み中...</div>,
});

const BASIS_LABELS: Record<BudgetBasis, string> = {
  expenditure: '歳出',
  revenue: '歳入',
};

const SCALE_LABELS: Record<MapScale, string> = {
  total: '総額',
  perCapita: '一人当たり',
};

const INDICATOR_KEYS: MapMetricKey[] = [
  'fiscalIndex',
  'currentBalanceRatio',
  'debtServiceRatio',
  'futureBurdenRatio',
];

/** カテゴリ切替時のデフォルト指標 */
const CATEGORY_DEFAULT_KEY: Record<MetricCategory, MapMetricKey> = {
  money: 'expenditure',
  population: 'population',
  fiscal: 'fiscalIndex',
};

/** 表示階層: 全国（都道府県） / 全国（市区町村） / 特定都道府県内の市区町村 */
type ViewState =
  | { level: 'nation' }
  | { level: 'nationMuni' }
  | { level: 'municipal'; prefCode: string; prefName: string };

interface RegionData {
  budgets: LocalGovBudget[];
  features: GeoFeature[];
}

export default function Home() {
  const [national, setNational] = useState<RegionData | null>(null);
  const [municipal, setMunicipal] = useState<RegionData | null>(null);
  // 全国市区町村ビュー用の軽量データ（総額・人口・指標のみ。初回切替時に遅延ロード）
  const [nationMuni, setNationMuni] = useState<RegionData | null>(null);
  // 全国市区町村ビューで選択した団体の詳細（内訳）。県単位でキャッシュ
  const [muniDetail, setMuniDetail] = useState<{
    prefCode: string;
    budgets: LocalGovBudget[];
  } | null>(null);
  const [view, setView] = useState<ViewState>({ level: 'nation' });
  const [year, setYear] = useState<number | null>(null);
  const [metricKey, setMetricKey] = useState<MapMetricKey>('expenditure');
  const [scale, setScale] = useState<MapScale>('total');
  const category = metricCategory(metricKey);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [focusTarget, setFocusTarget] = useState<
    { code: string; seq: number; zoom?: boolean } | null
  >(null);
  const focusSeqRef = useRef(0);

  const focusOn = useCallback((code: string, zoom = true) => {
    focusSeqRef.current += 1;
    setFocusTarget({ code, seq: focusSeqRef.current, zoom });
  }, []);

  useEffect(() => {
    fetch('/search-index.json')
      .then((res) => res.json())
      .then(setSearchEntries)
      .catch((err) => console.error('検索インデックス読み込みエラー:', err));

    Promise.all([
      fetch('/budgets.json').then((res) => res.json()),
      fetch('/japan.geojson').then((res) => res.json()),
    ])
      .then(([budgets, geoJson]: [LocalGovBudget[], { features: any[] }]) => {
        const features: GeoFeature[] = geoJson.features.map((feature: any) => ({
          type: 'Feature',
          properties: {
            code: String(feature.properties.id).padStart(2, '0'),
            name: feature.properties.nam_ja,
          },
          geometry: feature.geometry,
        }));
        setNational({ budgets, features });
        setYear(Math.max(...budgets.map((b) => b.fiscalYear)));
      })
      .catch((err) => console.error('データ読み込みエラー:', err));
  }, []);

  const active =
    view.level === 'municipal' ? municipal : view.level === 'nationMuni' ? nationMuni : national;

  const years = useMemo(
    () => (national ? Array.from(new Set(national.budgets.map((b) => b.fiscalYear))).sort() : []),
    [national]
  );

  // 選択年度の 自治体コード → 予算データ
  const budgetsByCode = useMemo(() => {
    const map = new Map<string, LocalGovBudget>();
    if (active) {
      for (const b of active.budgets) {
        if (b.fiscalYear === year) map.set(b.code, b);
      }
    }
    return map;
  }, [active, year]);

  // 選択年度の全国（都道府県）データ。市区町村ビューの背景着色に使う
  const nationalBudgetsByCode = useMemo(() => {
    const map = new Map<string, LocalGovBudget>();
    if (national) {
      for (const b of national.budgets) {
        if (b.fiscalYear === year) map.set(b.code, b);
      }
    }
    return map;
  }, [national, year]);

  // 選択コードから予算データを引く。市区町村ビューで隣県（2桁コード）を
  // 選択した場合は全国データから引く。全国市区町村ビューでは軽量データに
  // 内訳がないため、遅延ロード済みの詳細（県別JSON）があればそちらを優先
  const lookupBudget = useCallback(
    (code: string, fiscalYear: number | null): LocalGovBudget | null => {
      if (fiscalYear === null) return null;
      if (
        view.level === 'nationMuni' &&
        code.length === 5 &&
        muniDetail?.prefCode === code.slice(0, 2)
      ) {
        return (
          muniDetail.budgets.find((b) => b.code === code && b.fiscalYear === fiscalYear) ?? null
        );
      }
      const source = code.length === 2 ? national : active;
      return (
        source?.budgets.find((b) => b.code === code && b.fiscalYear === fiscalYear) ?? null
      );
    },
    [national, active, view, muniDetail]
  );

  // 全国市区町村ビューで団体を選択したら、内訳表示用に県別の詳細JSONを取得
  useEffect(() => {
    if (view.level !== 'nationMuni' || !selectedCode || selectedCode.length !== 5) return;
    const prefCode = selectedCode.slice(0, 2);
    if (muniDetail?.prefCode === prefCode) return;
    fetch(`/budgets/municipal/${prefCode}.json`)
      .then((res) => res.json())
      .then((budgets: LocalGovBudget[]) => setMuniDetail({ prefCode, budgets }))
      .catch((err) => console.error('市区町村詳細データ読み込みエラー:', err));
  }, [view, selectedCode, muniDetail]);

  const selectedRegion = selectedCode ? lookupBudget(selectedCode, year) : null;

  // 前年度の同一団体データ（前年比表示用）
  const previousYearRegion = useMemo(
    () => (selectedCode && year !== null ? lookupBudget(selectedCode, year - 1) : null),
    [selectedCode, year, lookupBudget]
  );

  // 地図に渡すフィーチャー。市区町村ビューでは周辺県をグレー地として重ねる
  // （背景を先に置き、市区町村ポリゴンを上に描画する）
  const mapFeatures = useMemo(() => {
    if (view.level === 'nationMuni') {
      return nationMuni?.features ?? [];
    }
    if (view.level !== 'municipal' || !municipal || !national) {
      return national?.features ?? [];
    }
    const background = national.features.filter(
      (f) => f.properties.code !== view.prefCode
    );
    return [...background, ...municipal.features];
  }, [view, municipal, national, nationMuni]);

  // 全国表示の粒度切替（都道府県 ⇔ 市区町村）。ドリルダウン中の切替も全国へ戻す
  const setGranularity = useCallback(
    (granularity: 'pref' | 'muni') => {
      if (granularity === 'pref') {
        if (view.level === 'nation') return;
        setView({ level: 'nation' });
        setMunicipal(null);
        // 市区町村を選択したままだと都道府県ビューで引けないので解除
        setSelectedCode((c) => (c && c.length === 5 ? null : c));
        return;
      }
      if (view.level === 'nationMuni') return;
      if (nationMuni) {
        setView({ level: 'nationMuni' });
        setMunicipal(null);
        return;
      }
      setLoadingDrilldown(true);
      Promise.all([
        fetch('/budgets/municipal-all.json').then((res) => res.json()),
        fetch('/geo/municipal-all.json').then((res) => res.json()),
      ])
        .then(([budgets, geo]: [LocalGovBudget[], { features: GeoFeature[] }]) => {
          setNationMuni({ budgets, features: geo.features });
          setView({ level: 'nationMuni' });
          setMunicipal(null);
        })
        .catch((err) => console.error('全国市区町村データ読み込みエラー:', err))
        .finally(() => setLoadingDrilldown(false));
    },
    [view, nationMuni]
  );

  // 都道府県 → 市区町村ビューへドリルダウン。selectCode指定時はその団体を選択して移動
  const drillDown = useCallback((prefCode: string, selectCode?: string) => {
    const prefName =
      national?.budgets.find((b) => b.code === prefCode)?.name ?? '';
    setLoadingDrilldown(true);
    Promise.all([
      fetch(`/budgets/municipal/${prefCode}.json`).then((res) => res.json()),
      fetch(`/geo/municipal/${prefCode}.json`).then((res) => res.json()),
    ])
      .then(([budgets, geo]: [LocalGovBudget[], { features: GeoFeature[] }]) => {
        setMunicipal({ budgets, features: geo.features });
        setView({ level: 'municipal', prefCode, prefName });
        setSelectedCode(selectCode ?? null);
        if (selectCode) focusOn(selectCode);
      })
      .catch((err) => console.error('市区町村データ読み込みエラー:', err))
      .finally(() => setLoadingDrilldown(false));
  }, [national, focusOn]);

  // 「全国に戻る」ポップアップから全国ビューへ復帰
  // （表示していた県を選択状態にし、ドリルダウン用ポップアップも出す）
  const backToNation = useCallback(() => {
    if (view.level === 'municipal') {
      setSelectedCode(view.prefCode);
      focusOn(view.prefCode, false);
    } else {
      setSelectedCode(null);
    }
    setView({ level: 'nation' });
    setMunicipal(null);
  }, [view, focusOn]);

  // 選択の反映。市区町村ビューで他県（2桁コード）を選択したら
  // 市区町村レイヤーを閉じて全国ビューに戻る（選択は維持）
  const handleSelectCode = useCallback(
    (code: string | null) => {
      setSelectedCode(code);
      if (
        code !== null &&
        code.length === 2 &&
        view.level === 'municipal' &&
        code !== view.prefCode
      ) {
        setView({ level: 'nation' });
        setMunicipal(null);
      }
    },
    [view]
  );

  // 検索結果の選択
  const handleSearchSelect = useCallback(
    (entry: SearchEntry) => {
      if (!entry.prefCode) {
        // 都道府県: 選択して移動（市区町村ビュー中なら全国ビューへ戻る）
        if (view.level === 'nationMuni') setView({ level: 'nation' });
        handleSelectCode(entry.code);
        focusOn(entry.code);
      } else if (view.level === 'nationMuni') {
        // 全国市区町村ビュー中: そのまま選択して移動
        setSelectedCode(entry.code);
        focusOn(entry.code);
      } else if (view.level === 'municipal' && view.prefCode === entry.prefCode) {
        // 表示中の県内の市区町村: 選択して移動
        setSelectedCode(entry.code);
        focusOn(entry.code);
      } else {
        // 他県の市区町村: その県にドリルダウンして選択
        drillDown(entry.prefCode, entry.code);
      }
    },
    [view, handleSelectCode, drillDown, focusOn]
  );

  const viewKey =
    view.level === 'municipal'
      ? `municipal-${view.prefCode}`
      : view.level === 'nationMuni'
        ? 'nation-muni'
        : 'nation';

  return (
    <div className="container">
      <header className="header">
        <h1>
          地方自治体予算マップ
          {view.level === 'municipal' && (
            <span className="header-breadcrumb">{view.prefName}</span>
          )}
        </h1>
        <div className="header-controls">
          <div className="metric-toggle" role="group" aria-label="年度">
            {years.map((y) => (
              <button
                key={y}
                className={`metric-toggle-button ${year === y ? 'active' : ''}`}
                onClick={() => setYear(y)}
                aria-pressed={year === y}
              >
                {y}
              </button>
            ))}
          </div>
          {category === 'money' && (
            <>
              <div className="metric-toggle" role="group" aria-label="集計対象">
                {(Object.keys(BASIS_LABELS) as BudgetBasis[]).map((b) => (
                  <button
                    key={b}
                    className={`metric-toggle-button ${metricKey === b ? 'active' : ''}`}
                    onClick={() => setMetricKey(b)}
                    aria-pressed={metricKey === b}
                  >
                    {BASIS_LABELS[b]}
                  </button>
                ))}
              </div>
              <div className="metric-toggle" role="group" aria-label="表示スケール">
                {(Object.keys(SCALE_LABELS) as MapScale[]).map((s) => (
                  <button
                    key={s}
                    className={`metric-toggle-button ${scale === s ? 'active' : ''}`}
                    onClick={() => setScale(s)}
                    aria-pressed={scale === s}
                  >
                    {SCALE_LABELS[s]}
                  </button>
                ))}
              </div>
            </>
          )}
          {category === 'fiscal' && (
            <div className="metric-toggle" role="group" aria-label="財政指標">
              {INDICATOR_KEYS.map((key) => {
                const def = metricDef(key);
                return (
                  <button
                    key={key}
                    className={`metric-toggle-button ${metricKey === key ? 'active' : ''}`}
                    onClick={() => setMetricKey(key)}
                    aria-pressed={metricKey === key}
                    title={def.description}
                  >
                    {def.label}
                  </button>
                );
              })}
            </div>
          )}
          <MetricMenu
            metricKey={metricKey}
            onSelectCategory={(c) => setMetricKey(CATEGORY_DEFAULT_KEY[c])}
          />
        </div>
      </header>
      <main className="main">
        <div className="map-container">
          <BudgetMap
            viewKey={viewKey}
            features={mapFeatures}
            focusFeatures={active?.features ?? []}
            budgetsByCode={budgetsByCode}
            backgroundBudgetsByCode={
              view.level === 'municipal' ? nationalBudgetsByCode : undefined
            }
            metricKey={metricKey}
            scale={scale}
            selectedCode={selectedCode}
            onSelectCode={handleSelectCode}
            onDrillDown={drillDown}
            onBack={view.level === 'municipal' ? backToNation : undefined}
            focusTarget={focusTarget}
            borderFeatures={view.level === 'nationMuni' ? national?.features : undefined}
          />
          <SearchBox entries={searchEntries} onSelect={handleSearchSelect} />
          <div className="granularity-toggle" role="group" aria-label="表示単位">
            <button
              className={`granularity-button ${view.level !== 'nationMuni' ? 'active' : ''}`}
              onClick={() => setGranularity('pref')}
              aria-pressed={view.level !== 'nationMuni'}
            >
              都道府県
            </button>
            <button
              className={`granularity-button ${view.level === 'nationMuni' ? 'active' : ''}`}
              onClick={() => setGranularity('muni')}
              aria-pressed={view.level === 'nationMuni'}
            >
              市区町村
            </button>
          </div>
          {loadingDrilldown && <div className="map-loading">市区町村データを読み込み中...</div>}
        </div>
        <Sidebar selectedRegion={selectedRegion} previousYearRegion={previousYearRegion} />
      </main>
    </div>
  );
}
