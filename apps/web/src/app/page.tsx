'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/Sidebar';
import { SearchBox, type SearchEntry } from '@/components/SearchBox';
import { MetricMenu } from '@/components/MetricMenu';
import { RankingModal } from '@/components/RankingModal';
import {
  METRICS,
  metricDef,
  metricCategory,
  categoryKeys,
  type MapMetricKey,
  type MetricCategory,
} from '@/lib/metrics';
import { dataUrl } from '@/lib/paths';
import { fetchJson } from '@/lib/fetchJson';
import { fetchTopoFeatures } from '@/lib/topo';
import type { RegionScope } from '@/components/Sidebar';
import type { LocalGovBudget, GeoFeature, MapScale } from '@/types/budget';

// Leafletはクライアントサイドでのみ動作
const BudgetMap = dynamic(() => import('@/components/BudgetMap'), {
  ssr: false,
  loading: () => <div className="map-container">地図を読み込み中...</div>,
});

const SCALE_LABELS: Record<MapScale, string> = {
  total: '総額',
  perCapita: '一人当たり',
};

/** カテゴリ切替時のデフォルト指標 */
const CATEGORY_DEFAULT_KEY: Record<MetricCategory, MapMetricKey> = {
  money: 'expenditure',
  population: 'population',
  fiscal: 'fiscalIndex',
  labor: 'avgIncome',
  infra: 'roadPerCapita',
  safety: 'trafficAccidents',
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
  // 初期表示は「歳出・一人当たり」。総額は人口マップと化して情報量が乏しく、
  // 一人当たりなら収支図の「あなたの1人分」の世界観ともつながる
  const [scale, setScale] = useState<MapScale>('perCapita');
  const category = metricCategory(metricKey);
  const yearIndependent = metricDef(metricKey).yearIndependent ?? false;
  // 都道府県別のみの指標（犯罪統計等）では市区町村ビューを使わせない
  const prefOnly = metricDef(metricKey).prefOnly ?? false;
  // 公表が遅れる統計はデータのある年度までしか選ばせない
  const maxYear = metricDef(metricKey).maxYear;
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  // 収支図モーダルの開閉（URL共有・地図ポップアップからも開くためpageが持つ）
  const [flowOpen, setFlowOpen] = useState(false);
  // ランキングモーダルの開閉
  const [rankingOpen, setRankingOpen] = useState(false);
  // データ取得失敗時のエラーバナー（再試行コールバック付き）
  const [loadError, setLoadError] = useState<{ message: string; retry: () => void } | null>(null);

  // 連続呼び出しで古い応答が新しい状態を上書きしないよう、要求ごとに採番して照合する
  const drillReqRef = useRef(0);
  const nationMuniReqRef = useRef(0);
  const muniDetailReqRef = useRef(0);
  // 全国市区町村ビューの詳細JSON（県別・約1.8MB）を県コードごとにキャッシュし、
  // 県を切り替えるたびの再ダウンロードを防ぐ
  const muniDetailCacheRef = useRef(new Map<string, LocalGovBudget[]>());
  // 全国市区町村データ（municipal-all/{年度}.json・年度別分割）の取得状況。
  // Mapは取得中含む重複リクエスト防止用、Setはロード完了済み年度（表示のフォールバック判定用）
  const nationMuniLoadsRef = useRef(new Map<number, Promise<boolean>>());
  const nationMuniFgReqRef = useRef(0);
  const [nationMuniYears, setNationMuniYears] = useState<ReadonlySet<number>>(new Set());

  // 選択が解除されたら収支図も閉じる
  useEffect(() => {
    if (!selectedCode) setFlowOpen(false);
  }, [selectedCode]);


  // モバイルではトグル群が横スクロールするため、指標切替時に
  // 選択中の指標ボタンが見える位置までスクロールする（デスクトップでは何もしない）。
  // 年度・スケールのトグルは対象外（そちらに合わせると指標が画面外に流れる）
  useEffect(() => {
    document
      .querySelector('[aria-label="表示指標"] .metric-toggle-button.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [metricKey]);

  // カテゴリごとに最後に選んだ指標を覚え、ハンバーガーで戻ってきたときに復元する
  // （例: 教育費→人口の出生数→歳入・歳出に戻ると教育費のまま）
  const lastKeyByCategoryRef = useRef<Partial<Record<MetricCategory, MapMetricKey>>>({});
  useEffect(() => {
    lastKeyByCategoryRef.current[metricCategory(metricKey)] = metricKey;
  }, [metricKey]);
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [focusTarget, setFocusTarget] = useState<
    { code: string; seq: number; zoom?: boolean } | null
  >(null);
  const focusSeqRef = useRef(0);

  const focusOn = useCallback((code: string, zoom = true) => {
    focusSeqRef.current += 1;
    setFocusTarget({ code, seq: focusSeqRef.current, zoom });
  }, []);

  // 全国（都道府県）データと境界の初回ロード。失敗時はバナーから再試行できる
  const loadCoreData = useCallback(() => {
    setLoadError(null);
    Promise.all([
      fetchJson<LocalGovBudget[]>(dataUrl('/budgets.json')),
      fetchTopoFeatures<any>(dataUrl('/japan.topo.json')),
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
        // URLの年度指定があれば優先（StrictModeの二重フェッチでも同じ結果になるようここで解決）
        const urlYear = Number(new URLSearchParams(window.location.search).get('y'));
        const available = new Set(budgets.map((b) => b.fiscalYear));
        setYear(available.has(urlYear) ? urlYear : Math.max(...Array.from(available)));
      })
      .catch((err) => {
        console.error('データ読み込みエラー:', err);
        setLoadError({ message: 'データの読み込みに失敗しました', retry: loadCoreData });
      });
  }, []);

  useEffect(() => {
    fetchJson<SearchEntry[]>(dataUrl('/search-index.json'))
      .then(setSearchEntries)
      .catch((err) => console.error('検索インデックス読み込みエラー:', err));
    loadCoreData();
  }, [loadCoreData]);

  const active =
    view.level === 'municipal' ? municipal : view.level === 'nationMuni' ? nationMuni : national;

  const years = useMemo(
    () => (national ? Array.from(new Set(national.budgets.map((b) => b.fiscalYear))).sort() : []),
    [national]
  );

  // 地図・一覧の表示に使う年度。全国市区町村ビューで未ロードの年度を選んでいる間は、
  // 全団体が「データなし」で塗られるのを避けるため、直近のロード済み年度の表示を維持する
  // （ロード完了で選択年度に切り替わる。ロード中はオーバーレイで明示）
  const dataYear = useMemo(() => {
    if (view.level !== 'nationMuni' || year === null || nationMuniYears.has(year)) return year;
    let nearest: number | null = null;
    nationMuniYears.forEach((y) => {
      if (nearest === null || Math.abs(y - year) < Math.abs(nearest - year)) nearest = y;
    });
    return nearest ?? year;
  }, [view, year, nationMuniYears]);

  // 選択年度の 自治体コード → 予算データ
  const budgetsByCode = useMemo(() => {
    const map = new Map<string, LocalGovBudget>();
    if (active) {
      for (const b of active.budgets) {
        if (b.fiscalYear === dataYear) map.set(b.code, b);
      }
    }
    return map;
  }, [active, dataYear]);

  // 未選択時サイドバーの全国サマリー用（選択年度・現在の表示階層の全団体）
  const regionBudgets = useMemo(() => Array.from(budgetsByCode.values()), [budgetsByCode]);

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

  // 全国市区町村ビューで内訳表示用に県別の詳細JSONを取得（県ごとにキャッシュ）
  const loadMuniDetail = useCallback((prefCode: string) => {
    const cached = muniDetailCacheRef.current.get(prefCode);
    if (cached) {
      setMuniDetail({ prefCode, budgets: cached });
      return;
    }
    const reqId = ++muniDetailReqRef.current;
    fetchJson<LocalGovBudget[]>(dataUrl(`/budgets/municipal/${prefCode}.json`))
      .then((budgets) => {
        muniDetailCacheRef.current.set(prefCode, budgets);
        // 取得中に別の県へ切り替わっていたら破棄
        if (reqId === muniDetailReqRef.current) setMuniDetail({ prefCode, budgets });
      })
      .catch((err) => {
        console.error('市区町村詳細データ読み込みエラー:', err);
        setLoadError({
          message: '詳細データの読み込みに失敗しました',
          retry: () => loadMuniDetail(prefCode),
        });
      });
  }, []);

  // 全国市区町村ビューで団体を選択したら、内訳表示用に県別の詳細JSONを取得
  useEffect(() => {
    if (view.level !== 'nationMuni' || !selectedCode || selectedCode.length !== 5) return;
    const prefCode = selectedCode.slice(0, 2);
    if (muniDetail?.prefCode === prefCode) return;
    loadMuniDetail(prefCode);
  }, [view, selectedCode, muniDetail, loadMuniDetail]);

  // 選択団体の詳細。選択年度がまだなければ表示中の年度（dataYear）にフォールバック
  const selectedRegion = selectedCode
    ? (lookupBudget(selectedCode, year) ?? lookupBudget(selectedCode, dataYear))
    : null;

  // タブ・履歴・共有時に場所が分かるよう、タイトルを表示中の自治体に追従させる
  // （OGスクレイパーは静的HTMLを読むためSNSカードには効かないが、ブラウザ経由の共有には効く）
  useEffect(() => {
    const base = '地方自治体予算マップ';
    const place =
      selectedRegion?.name ?? (view.level === 'municipal' ? view.prefName : null);
    document.title = place ? `${place}の財政 | ${base}` : base;
  }, [selectedRegion, view]);

  // 選択団体の全年度データ（サイドバーの推移グラフ・前年比用）
  const yearlyBudgets = useMemo(
    () =>
      selectedCode
        ? years
            .map((y) => lookupBudget(selectedCode, y))
            .filter((b): b is LocalGovBudget => b !== null)
        : [],
    [selectedCode, years, lookupBudget]
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

  // 全国市区町村データ（年度別分割）を追加ロードする。取得中・取得済みなら同じPromiseを返す。
  // 失敗はfalseで返す（エラーバナーは前面ロード側が出す。先読みは静かに諦める）
  const loadNationMuniYear = useCallback((y: number): Promise<boolean> => {
    const existing = nationMuniLoadsRef.current.get(y);
    if (existing) return existing;
    const p = fetchJson<LocalGovBudget[]>(dataUrl(`/budgets/municipal-all/${y}.json`))
      .then((budgets) => {
        setNationMuni((prev) =>
          prev ? { ...prev, budgets: [...prev.budgets, ...budgets] } : prev
        );
        setNationMuniYears((prev) => new Set(prev).add(y));
        return true;
      })
      .catch((err) => {
        nationMuniLoadsRef.current.delete(y);
        console.error('全国市区町村データ読み込みエラー:', err);
        return false;
      });
    nationMuniLoadsRef.current.set(y, p);
    return p;
  }, []);

  // 表示中の年度のロード（ローディング表示・失敗時のエラーバナー付き）
  const loadNationMuniYearFg = useCallback(
    (y: number) => {
      const reqId = ++nationMuniFgReqRef.current;
      setLoadError(null);
      setLoadingDrilldown(true);
      void loadNationMuniYear(y).then((ok) => {
        if (reqId !== nationMuniFgReqRef.current) return;
        setLoadingDrilldown(false);
        if (!ok) {
          setLoadError({
            message: 'データの読み込みに失敗しました',
            retry: () => loadNationMuniYearFg(y),
          });
        }
      });
    },
    [loadNationMuniYear]
  );

  // 全国市区町村ビューで未ロードの年度に切り替えたら、その年度のデータをロードする
  useEffect(() => {
    if (view.level !== 'nationMuni' || year === null || !nationMuni) return;
    if (nationMuniYears.has(year)) return;
    loadNationMuniYearFg(year);
  }, [view.level, year, nationMuni, nationMuniYears, loadNationMuniYearFg]);

  // 初回表示後、残りの年度を新しい順に裏で先読みし、年度切替を待たせない
  useEffect(() => {
    if (view.level !== 'nationMuni' || !nationMuni || years.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const y of [...years].sort((a, b) => b - a)) {
        if (cancelled) return;
        await loadNationMuniYear(y);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view.level, nationMuni, years, loadNationMuniYear]);

  // 全国市区町村ビューへ切り替える（境界と表示年度のデータは初回のみフェッチ。
  // 他年度は年度切替時に遅延ロード）。selectCode指定時はその団体を選択して移動（URL復元用）
  const enterNationMuni = useCallback(
    (selectCode?: string) => {
      const apply = () => {
        setView({ level: 'nationMuni' });
        setMunicipal(null);
        if (selectCode) {
          setSelectedCode(selectCode);
          focusOn(selectCode);
        } else {
          // 都道府県を選択したままだと市区町村ビューで引けないので解除
          setSelectedCode((c) => (c && c.length === 2 ? null : c));
        }
      };
      if (nationMuni) {
        apply();
        return;
      }
      if (year === null) return;
      const firstYear = year;
      const reqId = ++nationMuniReqRef.current;
      setLoadError(null);
      setLoadingDrilldown(true);
      Promise.all([
        fetchJson<LocalGovBudget[]>(dataUrl(`/budgets/municipal-all/${firstYear}.json`)),
        fetchTopoFeatures<GeoFeature>(dataUrl('/geo/municipal-all.topo.json')),
      ])
        .then(([budgets, geo]: [LocalGovBudget[], { features: GeoFeature[] }]) => {
          if (reqId !== nationMuniReqRef.current) return;
          // 先読みループが同じ年度を二重取得しないよう、取得済みとして登録する
          nationMuniLoadsRef.current.set(firstYear, Promise.resolve(true));
          setNationMuniYears((prev) => new Set(prev).add(firstYear));
          setNationMuni({ budgets, features: geo.features });
          apply();
        })
        .catch((err) => {
          if (reqId !== nationMuniReqRef.current) return;
          console.error('全国市区町村データ読み込みエラー:', err);
          setLoadError({
            message: 'データの読み込みに失敗しました',
            retry: () => enterNationMuni(selectCode),
          });
        })
        .finally(() => {
          if (reqId === nationMuniReqRef.current) setLoadingDrilldown(false);
        });
    },
    [nationMuni, year, focusOn]
  );

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
      enterNationMuni();
    },
    [view, enterNationMuni]
  );

  // 都道府県別のみの指標が選ばれたら市区町村ビュー（全国・ドリルダウンとも）を閉じる
  useEffect(() => {
    if (prefOnly) setGranularity('pref');
  }, [prefOnly, setGranularity]);

  // データのない年度を選んでいたら、その指標の最新年度へ丸める
  useEffect(() => {
    if (maxYear !== undefined && year !== null && year > maxYear) setYear(maxYear);
  }, [maxYear, year]);

  // 都道府県 → 市区町村ビューへドリルダウン。selectCode指定時はその団体を選択して移動
  const drillDown = useCallback((prefCode: string, selectCode?: string) => {
    const prefName =
      national?.budgets.find((b) => b.code === prefCode)?.name ?? '';
    const reqId = ++drillReqRef.current;
    setLoadError(null);
    setLoadingDrilldown(true);
    Promise.all([
      fetchJson<LocalGovBudget[]>(dataUrl(`/budgets/municipal/${prefCode}.json`)),
      fetchTopoFeatures<GeoFeature>(dataUrl(`/geo/municipal/${prefCode}.topo.json`)),
    ])
      .then(([budgets, geo]: [LocalGovBudget[], { features: GeoFeature[] }]) => {
        // 別の県へ連続ドリルダウンしていたら古い応答は破棄
        if (reqId !== drillReqRef.current) return;
        // 詳細JSONは全国市区町村ビューの内訳表示にも使えるためキャッシュへ入れる
        muniDetailCacheRef.current.set(prefCode, budgets);
        setMunicipal({ budgets, features: geo.features });
        setView({ level: 'municipal', prefCode, prefName });
        setSelectedCode(selectCode ?? null);
        if (selectCode) focusOn(selectCode);
      })
      .catch((err) => {
        if (reqId !== drillReqRef.current) return;
        console.error('市区町村データ読み込みエラー:', err);
        setLoadError({
          message: 'データの読み込みに失敗しました',
          retry: () => drillDown(prefCode, selectCode),
        });
      })
      .finally(() => {
        if (reqId === drillReqRef.current) setLoadingDrilldown(false);
      });
  }, [national, focusOn]);

  // --- URL共有: 表示状態（年度・指標・粒度・選択）をクエリに反映・復元 ---
  const urlRestoredRef = useRef(false);

  // 初回ロード時にクエリから状態を復元する
  useEffect(() => {
    if (!national || urlRestoredRef.current) return;
    urlRestoredRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const m = params.get('m');
    if (m && METRICS.some((d) => d.key === m)) setMetricKey(m as MapMetricKey);
    const s = params.get('s');
    if (s === 'total' || s === 'perCapita') setScale(s);

    const sel = params.get('sel');
    const muniSel = sel && /^\d{5}$/.test(sel) ? sel : undefined;
    const prefSel = sel && /^\d{2}$/.test(sel) ? sel : undefined;
    const drillPref = params.get('v');

    if (drillPref && /^\d{2}$/.test(drillPref)) {
      drillDown(drillPref, muniSel);
    } else if (params.get('g') === 'muni') {
      enterNationMuni(muniSel);
    } else if (prefSel) {
      setSelectedCode(prefSel);
      focusOn(prefSel);
    }
    if (params.get('f') === '1' && (muniSel || prefSel)) setFlowOpen(true);
  }, [national, drillDown, enterNationMuni, focusOn]);

  // 状態が変わるたびにURLへ書き出す（復元前は書かない）
  useEffect(() => {
    if (!urlRestoredRef.current) return;
    const params = new URLSearchParams();
    if (year !== null) params.set('y', String(year));
    if (metricKey !== 'expenditure') params.set('m', metricKey);
    if (scale !== 'perCapita') params.set('s', scale);
    if (view.level === 'nationMuni') params.set('g', 'muni');
    if (view.level === 'municipal') params.set('v', view.prefCode);
    if (selectedCode) params.set('sel', selectedCode);
    if (flowOpen && selectedCode) params.set('f', '1');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [year, metricKey, scale, view, selectedCode, flowOpen]);

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
        // ビュー切替でクリック時のポップアップが閉じるため、全国ビュー側で出し直す
        focusOn(code, false);
      }
    },
    [view, focusOn]
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

  // サイドバーの中央値・合計ラベルの母集団（全国／県内）と単位を、
  // regionBudgetsの中身ではなく現在の表示階層から決める（ロード中の取り違え防止）
  const regionScope = useMemo<RegionScope>(() => {
    if (view.level === 'municipal') {
      return { kind: 'municipal', unit: '市区町村', prefName: view.prefName };
    }
    if (view.level === 'nationMuni') return { kind: 'nationMuni', unit: '市区町村' };
    return { kind: 'nation', unit: '都道府県' };
  }, [view]);

  return (
    <div className="container">
      <header className="header">
        <h1>地方自治体予算マップ</h1>
        <div className="header-controls">
          <div className="header-toggles">
            {/* 単年公表の統計（課税状況調・国勢調査）では年度切替に意味がないので出さない */}
            {!yearIndependent && (
              <div className="metric-toggle" role="group" aria-label="年度">
                {years.filter((y) => maxYear === undefined || y <= maxYear).map((y) => (
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
            )}
            <div
              className={`metric-toggle ${categoryKeys(category).length > 5 ? 'compact' : ''}`}
              role="group"
              aria-label="表示指標"
            >
              {categoryKeys(category).map((key) => {
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
            {category === 'money' && (
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
            )}
          </div>
          <MetricMenu
            metricKey={metricKey}
            onSelectCategory={(c) =>
              setMetricKey(lastKeyByCategoryRef.current[c] ?? CATEGORY_DEFAULT_KEY[c])
            }
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
            onDrillDown={prefOnly ? undefined : drillDown}
            onBack={view.level === 'municipal' ? backToNation : undefined}
            focusTarget={focusTarget}
            borderFeatures={view.level === 'nationMuni' ? national?.features : undefined}
            onShowFlow={() => setFlowOpen(true)}
          />
          <SearchBox entries={searchEntries} onSelect={handleSearchSelect} />
          <button className="ranking-toggle" onClick={() => setRankingOpen(true)}>
            ランキング
          </button>
          {/* 都道府県別のみの指標では表示単位の切替を出さない */}
          {!prefOnly && (
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
          )}
          {loadingDrilldown && <div className="map-loading">市区町村データを読み込み中...</div>}
          {loadError && (
            <div className="load-error-banner" role="alert">
              <span>{loadError.message}</span>
              <button
                className="load-error-retry"
                onClick={() => {
                  const retry = loadError.retry;
                  setLoadError(null);
                  retry();
                }}
              >
                再試行
              </button>
              <button
                className="load-error-dismiss"
                aria-label="閉じる"
                onClick={() => setLoadError(null)}
              >
                ×
              </button>
            </div>
          )}
          {rankingOpen && (
            <RankingModal
              budgets={regionBudgets}
              metricKey={metricKey}
              scale={scale}
              year={yearIndependent ? null : dataYear}
              selectedCode={selectedCode}
              granularity={view.level === 'nationMuni' ? 'muni' : 'pref'}
              onGranularityChange={setGranularity}
              prefOnly={prefOnly}
              loading={loadingDrilldown}
              onSelect={(code) => {
                setRankingOpen(false);
                setSelectedCode(code);
                focusOn(code);
              }}
              onClose={() => setRankingOpen(false)}
            />
          )}
        </div>
        <Sidebar
          selectedRegion={selectedRegion}
          yearlyBudgets={yearlyBudgets}
          regionBudgets={regionBudgets}
          regionScope={regionScope}
          metricKey={metricKey}
          scale={scale}
          flowOpen={flowOpen}
          onFlowOpenChange={setFlowOpen}
        />
      </main>
    </div>
  );
}
