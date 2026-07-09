'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import type { LocalGovBudget, BudgetItem, FiscalIndicator } from '@/types/budget';
import { formatAmount, formatPerPerson } from '@/lib/format';
import { loadAverages, type BudgetAverages } from '@/lib/averages';
import {
  metricDef,
  metricValue,
  formatMetricValue,
  metricDisplayLabel,
  categoryKeys,
  type MapMetricKey,
} from '@/lib/metrics';
import type { MapScale } from '@/types/budget';
import { industryColor } from '@/lib/industry';
import { METRIC_INSIGHTS } from '@/lib/insights';
import { donutSegmentPath, EXPENDITURE_COLORS, REVENUE_COLORS } from '@/lib/donut';
import { BudgetDonut } from './BudgetDonut';
import { TimeSeriesChart } from './TimeSeriesChart';
import { SankeyModal } from './SankeyModal';

/** 産業別就業者の構成比ドーナツグラフ＋凡例（全業種リストを上位5＋その他に畳んで表示） */
function IndustryDonut({ industries: all }: { industries: Array<{ name: string; share: number }> }) {
  const industries = useMemo(() => {
    const top = all.slice(0, 7);
    const rest = 100 - top.reduce((s, i) => s + i.share, 0);
    return rest > 0.05 ? [...top, { name: 'その他', share: Number(rest.toFixed(1)) }] : top;
  }, [all]);
  // 角度は構成比の合計で正規化し、丸め誤差があっても必ず円をぴったり埋める
  const total = industries.reduce((s, i) => s + i.share, 0);
  let angle = 0;
  return (
    <div className="industry-donut" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg viewBox="0 0 120 120" style={{ width: 110, height: 110, flexShrink: 0 }}>
        {industries.map((ind, i) => {
          const a0 = angle;
          // 全周1セグメントでもパスが消えないよう僅かに切る
          const a1 = Math.min(angle + (ind.share / total) * 2 * Math.PI, a0 + 2 * Math.PI - 1e-4);
          angle = a1;
          return (
            <path key={ind.name} d={donutSegmentPath(a0, a1, 32, 56)} fill={industryColor(ind.name)}>
              <title>{`${ind.name} ${ind.share}%`}</title>
            </path>
          );
        })}
      </svg>
      <div style={{ fontSize: 12, lineHeight: 1.7, minWidth: 0 }}>
        {industries.map((ind) => (
          <div key={ind.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                flexShrink: 0,
                background: industryColor(ind.name),
                alignSelf: 'center',
              }}
            />
            <span
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={ind.name}
            >
              {ind.name}
            </span>
            <span style={{ color: '#52514e', flexShrink: 0 }}>{ind.share}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * テーマカード下部の「この団体の◯◯への支出」行。
 * 指定した款の住民1人あたり年額と、全国中央値との差（収支図と同じ「中央値±」、
 * 赤=中央値より多い・青=少ない）を表示する
 */
function SpendingWithMedian({
  budget,
  names,
  subject,
  averages,
}: {
  budget: LocalGovBudget;
  names: string[];
  subject: string;
  averages: BudgetAverages | null;
}) {
  const population = budget.population;
  if (!population) return null;
  const level = budget.code.length === 2 ? 'pref' : 'muni';
  const parts = names
    .map((name) => {
      const item = budget.expenditures.find((e) => e.name === name);
      if (!item) return null;
      const perCapita = item.amount / population;
      const median =
        averages?.[level].perCapita.expenditure[String(budget.fiscalYear)]?.[name] ?? null;
      return { name, perCapita, median };
    })
    .filter((p): p is { name: string; perCapita: number; median: number | null } => p !== null);
  if (parts.length === 0) return null;
  return (
    <p className="attribution" style={{ marginTop: 8 }}>
      この団体の{subject}への支出（住民1人あたり年額）:{' '}
      {parts.map((p, i) => (
        <span key={p.name}>
          {i > 0 && '・'}
          {p.name} {formatPerPerson(p.perCapita)}
          {p.median !== null && (
            <span
              style={{
                color: p.perCapita - p.median >= 0 ? '#c0392b' : '#1e6bb8',
                fontWeight: 600,
              }}
            >
              {' '}
              中央値{p.perCapita - p.median >= 0 ? '+' : '−'}
              {formatPerPerson(Math.abs(p.perCapita - p.median))}/人
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

interface SidebarProps {
  selectedRegion: LocalGovBudget | null;
  /** 選択団体の年度別データ（推移グラフ・前年比に使用） */
  yearlyBudgets: LocalGovBudget[];
  /** 選択年度・現在の表示階層の全団体（未選択時の全国サマリーに使用） */
  regionBudgets: LocalGovBudget[];
  metricKey: MapMetricKey;
  scale: MapScale;
  /** 収支図モーダルの開閉（URL共有・地図ポップアップと連動するためpageが持つ） */
  flowOpen: boolean;
  onFlowOpenChange: (open: boolean) => void;
}

const BUDGET_TYPE_LABELS: Record<LocalGovBudget['budgetType'], string> = {
  initial: '当初予算',
  supplementary: '補正予算',
  final: '決算',
};

function formatIndicator(indicator: FiscalIndicator): string {
  if (indicator.unit === '割合') return `${(indicator.value * 100).toFixed(1)}%`;
  if (indicator.unit === '千円') return formatAmount(indicator.value * 1000);
  return indicator.value.toFixed(2);
}

interface BudgetItemRowProps {
  item: BudgetItem;
  /** 構成比バーの基準額。0以下ならバー非表示 */
  total: number;
  level?: number;
}

function BudgetItemRow({ item, total, level = 0 }: BudgetItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const share = total > 0 ? (item.amount / total) * 100 : 0;
  const showBar = level === 0 && total > 0;

  return (
    <>
      <div
        className={`budget-item ${hasChildren ? 'expandable' : ''} ${expanded ? 'expanded' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="budget-item-head">
          <span>
            {hasChildren && <span className="expand-icon">{expanded ? '▼' : '▶'}</span>}
            {item.name}
          </span>
          <span className="budget-item-value">
            {formatAmount(item.amount)}
            {showBar && <span className="budget-item-share">{share.toFixed(1)}%</span>}
          </span>
        </div>
        {showBar && (
          <div className="budget-bar-track">
            <div className="budget-bar" style={{ width: `${Math.min(share, 100)}%` }} />
          </div>
        )}
      </div>
      {expanded && item.children?.map((child, index) => (
        <BudgetItemRow key={index} item={child} total={0} level={level + 1} />
      ))}
    </>
  );
}

interface BreakdownCardProps {
  title: string;
  items: BudgetItem[];
  total: number;
}

function BreakdownCard({ title, items, total }: BreakdownCardProps) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.amount - a.amount), [items]);
  if (sorted.length === 0) return null;
  return (
    <div className="budget-card">
      <h3>{title}</h3>
      <div className="budget-list">
        {sorted.map((item, index) => (
          <BudgetItemRow key={index} item={item} total={total} />
        ))}
      </div>
    </div>
  );
}

/** ラベルと値の単純な一覧カード */
function StatListCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="budget-card">
      <h3>{title}</h3>
      <div className="budget-list">
        {rows.map(({ label, value }) => (
          <div className="budget-item" key={label}>
            <div className="budget-item-head">
              <span>{label}</span>
              <span className="budget-item-value">{value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sidebar({
  selectedRegion,
  yearlyBudgets,
  regionBudgets,
  metricKey,
  scale,
  flowOpen,
  onFlowOpenChange,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    sidebar.addEventListener('wheel', handleWheel, { passive: false });
    return () => sidebar.removeEventListener('wheel', handleWheel);
  }, []);

  // 支出行の「中央値±」用（結果はモジュール内キャッシュ）
  const [averages, setAverages] = useState<BudgetAverages | null>(null);
  useEffect(() => {
    let mounted = true;
    loadAverages()
      .then((a) => mounted && setAverages(a))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const def = metricDef(metricKey);

  // 選択指標の年度推移
  const series = useMemo(
    () =>
      yearlyBudgets.map((b) => ({
        year: b.fiscalYear,
        value: metricValue(b, metricKey, scale),
      })),
    [yearlyBudgets, metricKey, scale]
  );

  if (!selectedRegion) {
    // 未選択時: 選択中の指標の全国サマリーと見方のヒントを表示する
    const level = regionBudgets[0]?.code.length === 2 ? '都道府県' : '市区町村';
    const medianOf = (s: MapScale): number | null => {
      const values = regionBudgets
        .map((b) => metricValue(b, metricKey, s))
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
      if (values.length === 0) return null;
      return values.length % 2 === 1
        ? values[(values.length - 1) / 2]
        : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    };
    const statRows: Array<{ label: string; value: string }> = [];
    if (def.kind === 'money') {
      // 金額指標はスケール切替によらず総額・1人あたりを併記する
      const total = regionBudgets
        .map((b) => metricValue(b, metricKey, 'total'))
        .filter((v): v is number => v !== null)
        .reduce((sum, v) => sum + v, 0);
      const medianTotal = medianOf('total');
      const medianPerCapita = medianOf('perCapita');
      statRows.push({ label: `全${level}の合計`, value: formatAmount(total) });
      if (medianTotal !== null) {
        statRows.push({ label: `${level}の中央値（総額）`, value: formatAmount(medianTotal) });
      }
      if (medianPerCapita !== null) {
        statRows.push({
          label: `${level}の中央値（1人あたり）`,
          value: formatAmount(medianPerCapita),
        });
      }
    } else {
      const median = medianOf(scale);
      if (median !== null) {
        statRows.push({ label: `${level}の中央値`, value: formatMetricValue(median, metricKey) });
      }
    }

    // 歳出系の指標は、性質別（人件費・扶助費など）のおおよその内訳を全団体の加重集計で併記する
    // （各団体の上位区分のみの概算。全国市区町村ビューの軽量データには性質がないため出ない）
    let natureLine: string | null = null;
    if (metricKey === 'expenditure' || def.budgetItem?.list === 'expenditures') {
      const natureTotals = new Map<string, number>();
      let amountTotal = 0;
      for (const b of regionBudgets) {
        const items = def.budgetItem
          ? b.expenditures.filter((e) => e.name === def.budgetItem!.name)
          : b.expenditures;
        for (const item of items) {
          amountTotal += item.amount;
          for (const n of item.natures ?? []) {
            natureTotals.set(n.name, (natureTotals.get(n.name) ?? 0) + (item.amount * n.share) / 100);
          }
        }
      }
      if (amountTotal > 0 && natureTotals.size > 0) {
        const top = Array.from(natureTotals.entries())
          .map(([name, weight]) => ({ name, share: weight / amountTotal }))
          .filter((n) => n.share >= 0.03)
          .sort((a, b) => b.share - a.share)
          .slice(0, 4);
        if (top.length > 0) {
          natureLine = top
            .map((n) => `${n.name} ${Math.round(n.share * 100)}%`)
            .join('・');
        }
      }
    }

    return (
      <aside className="sidebar" ref={sidebarRef}>
        <div className="budget-card">
          <h3>地域を選択</h3>
          <p>地図上の自治体をクリックすると詳細が表示されます</p>
        </div>
        <div className="budget-card">
          <h3>{def.label}とは</h3>
          {def.description && <p className="attribution">{def.description}</p>}
          {natureLine && (
            <p className="attribution">
              主な内訳（全{level}の概算）: {natureLine}
            </p>
          )}
          {statRows.length > 0 && (
            <div className="budget-list">
              {statRows.map(({ label, value }) => (
                <div className="budget-item" key={label}>
                  <div className="budget-item-head">
                    <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
                    <span className="budget-item-value">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="budget-card">
          <h3>見方のヒント</h3>
          <p className="attribution">{METRIC_INSIGHTS[metricKey]}</p>
        </div>
      </aside>
    );
  }

  const heroValue = metricValue(selectedRegion, metricKey, scale);
  const previous = yearlyBudgets.find(
    (b) => b.fiscalYear === selectedRegion.fiscalYear - 1
  );
  const prevValue = previous ? metricValue(previous, metricKey, scale) : null;
  const yoy =
    !def.yearIndependent && heroValue !== null && prevValue !== null && prevValue !== 0
      ? ((heroValue - prevValue) / Math.abs(prevValue)) * 100
      : null;

  const showChart =
    !def.yearIndependent && series.filter((p) => p.value !== null).length >= 2;

  // 人口統計カードの行（人口カテゴリの全指標＋面積）
  const populationRows = categoryKeys('population')
    .map((key) => {
      const value = metricValue(selectedRegion, key, scale);
      return value !== null
        ? { label: metricDef(key).label, value: formatMetricValue(value, key) }
        : null;
    })
    .filter((row): row is { label: string; value: string } => row !== null);
  if (selectedRegion.demographics?.areaKm2) {
    populationRows.push({
      label: '面積',
      value: `${selectedRegion.demographics.areaKm2.toLocaleString()}km²`,
    });
  }

  return (
    <aside className="sidebar" ref={sidebarRef}>
      <div className="budget-card">
        <h3>{selectedRegion.name}</h3>
        <p>
          {selectedRegion.fiscalYear}年度 {BUDGET_TYPE_LABELS[selectedRegion.budgetType]}
        </p>
      </div>

      {/* 選択中の指標 */}
      <div className="budget-card">
        <h3>{metricDisplayLabel(metricKey, scale)}</h3>
        <div className="budget-amount">
          {heroValue !== null ? formatMetricValue(heroValue, metricKey) : 'データなし'}
        </div>
        {yoy !== null && (
          <p>
            前年度比: {yoy >= 0 ? '+' : ''}
            {yoy.toFixed(1)}%
          </p>
        )}
        {def.description && <p className="attribution">{def.description}</p>}
      </div>

      {showChart && (
        <div className="budget-card">
          <h3>推移</h3>
          <TimeSeriesChart series={series} metricKey={metricKey} />
        </div>
      )}

      {def.category === 'money' && (
        <>
          <div className="budget-card">
            <div className="card-head">
              <h3>収支サマリー</h3>
              <button className="text-button" onClick={() => onFlowOpenChange(true)}>
                収支図
              </button>
            </div>
            <p>歳出総額: {formatAmount(selectedRegion.totalExpenditure)}</p>
            <p>歳入総額: {formatAmount(selectedRegion.totalRevenue)}</p>
            {selectedRegion.population && (
              <p>人口: {selectedRegion.population.toLocaleString()}人</p>
            )}
            <BudgetDonut
              title="歳出"
              items={selectedRegion.expenditures}
              total={selectedRegion.totalExpenditure}
              colors={EXPENDITURE_COLORS}
              avgTable="expenditure"
              level={selectedRegion.code.length === 2 ? 'pref' : 'muni'}
              fiscalYear={selectedRegion.fiscalYear}
              population={selectedRegion.population}
            />
            <BudgetDonut
              title="歳入"
              items={selectedRegion.revenues}
              total={selectedRegion.totalRevenue}
              colors={REVENUE_COLORS}
              avgTable="revenue"
              level={selectedRegion.code.length === 2 ? 'pref' : 'muni'}
              fiscalYear={selectedRegion.fiscalYear}
              population={selectedRegion.population}
            />
            <p className="attribution">
              内側は大分類、外側はその内訳。タップ／ホバーで金額を表示。
              「中央値±」は住民1人あたり額の全国中央値との差（赤=多い・青=少ない）
            </p>
          </div>
          <BreakdownCard
            title="歳出内訳（目的別）"
            items={selectedRegion.expenditures}
            total={selectedRegion.totalExpenditure}
          />
          {selectedRegion.expendituresByNature && (
            <BreakdownCard
              title="歳出内訳（性質別）"
              items={selectedRegion.expendituresByNature}
              total={selectedRegion.totalExpenditure}
            />
          )}
          <BreakdownCard
            title="歳入内訳"
            items={selectedRegion.revenues}
            total={selectedRegion.totalRevenue}
          />
        </>
      )}

      {def.category === 'population' && (
        <StatListCard title="人口統計" rows={populationRows} />
      )}

      {def.category === 'labor' && selectedRegion.employment && (
        <div className="budget-card">
          <h3>就労・産業</h3>
          {selectedRegion.employment.avgIncome !== undefined && (
            <p>
              平均所得: {Math.round(selectedRegion.employment.avgIncome / 10_000).toLocaleString()}
              万円
              {selectedRegion.employment.taxpayers !== undefined &&
                `（納税義務者 ${selectedRegion.employment.taxpayers.toLocaleString()}人）`}
            </p>
          )}
          {selectedRegion.employment.industries && (
            <>
              <p style={{ marginBottom: 4 }}>働く人の産業（就業者の割合）:</p>
              <IndustryDonut industries={selectedRegion.employment.industries} />
            </>
          )}
          <SpendingWithMedian
            budget={selectedRegion}
            names={['商工費', '労働費']}
            subject="産業"
            averages={averages}
          />
        </div>
      )}

      {def.category === 'infra' && selectedRegion.infrastructure && (
        <div className="budget-card">
          <h3>インフラ</h3>
          <div className="budget-list">
            {(() => {
              const infra = selectedRegion.infrastructure;
              const pop = selectedRegion.population;
              const fmt = (key: MapMetricKey) => {
                const v = metricValue(selectedRegion, key, scale);
                return v !== null ? formatMetricValue(v, key) : null;
              };
              const rows: Array<{ label: string; value: string }> = [];
              if (infra.roadLengthM !== undefined) {
                rows.push({
                  label: '道路の長さ',
                  value: `${Math.round(infra.roadLengthM / 1000).toLocaleString()}km${
                    fmt('roadPerCapita') ? `（1人あたり ${fmt('roadPerCapita')}）` : ''
                  }`,
                });
              }
              if (infra.parkAreaM2 !== undefined) {
                rows.push({
                  label: '公園',
                  value: `${Math.round(infra.parkAreaM2 / 10_000).toLocaleString()}ha${
                    fmt('parkPerCapita') ? `（1人あたり ${fmt('parkPerCapita')}）` : ''
                  }`,
                });
              }
              if (infra.publicHousingUnits !== undefined) {
                rows.push({
                  label: '公営住宅等',
                  value: `${infra.publicHousingUnits.toLocaleString()}戸${
                    fmt('publicHousingRate') ? `（千人あたり ${fmt('publicHousingRate')}）` : ''
                  }`,
                });
              }
              if (infra.seweragePopulation !== undefined && pop) {
                rows.push({ label: '下水道普及率', value: fmt('sewerageRatio') ?? 'データなし' });
              }
              if (infra.waterPipeAgingRatio !== undefined) {
                rows.push({
                  label: '水道管の老朽化',
                  value: `${fmt('waterPipeAging') ?? ''}（法定耐用年数40年超え）`,
                });
              }
              if (infra.hospitals !== undefined) {
                rows.push({
                  label: '病院',
                  value: `${infra.hospitals.toLocaleString()}施設${
                    fmt('hospitals') ? `（10万人あたり ${fmt('hospitals')}）` : ''
                  }`,
                });
              }
              if (infra.hospitalBeds !== undefined) {
                rows.push({
                  label: '病床数',
                  value: `${infra.hospitalBeds.toLocaleString()}床${
                    fmt('hospitalBeds') ? `（10万人あたり ${fmt('hospitalBeds')}）` : ''
                  }`,
                });
              }
              return rows.map(({ label, value }) => (
                <div className="budget-item" key={label}>
                  <div className="budget-item-head">
                    <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
                    <span className="budget-item-value" style={{ whiteSpace: 'normal', textAlign: 'right' }}>
                      {value}
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
          <SpendingWithMedian
            budget={selectedRegion}
            names={['土木費']}
            subject="インフラ"
            averages={averages}
          />
        </div>
      )}

      {def.category === 'safety' && selectedRegion.safety && (
        <div className="budget-card">
          <h3>安全（{selectedRegion.fiscalYear}年中）</h3>
          <div className="budget-list">
            {(() => {
              const safety = selectedRegion.safety;
              const rows: Array<{ label: string; value: string }> = [];
              const per = (key: MapMetricKey) => {
                const v = metricValue(selectedRegion, key, scale);
                return v !== null ? formatMetricValue(v, key) : null;
              };
              if (safety.accidents !== undefined) {
                rows.push({
                  label: '人身事故',
                  value: `${safety.accidents.toLocaleString()}件${
                    per('trafficAccidents') ? `（千人あたり ${per('trafficAccidents')}）` : ''
                  }`,
                });
              }
              if (safety.fatalities !== undefined) {
                rows.push({
                  label: '死者数',
                  value: `${safety.fatalities.toLocaleString()}人${
                    per('trafficFatalities') ? `（10万人あたり ${per('trafficFatalities')}）` : ''
                  }`,
                });
              }
              if (safety.injuries !== undefined) {
                rows.push({ label: '負傷者数', value: `${safety.injuries.toLocaleString()}人` });
              }
              // 犯罪統計（都道府県のみ付与される）
              if (safety.penalCodeOffenses !== undefined) {
                rows.push({
                  label: '刑法犯',
                  value: `${safety.penalCodeOffenses.toLocaleString()}件${
                    per('penalCodeOffenses') ? `（千人あたり ${per('penalCodeOffenses')}）` : ''
                  }`,
                });
              }
              for (const [key, label, count] of [
                ['homicides', '殺人', safety.homicides],
                ['robberies', '強盗', safety.robberies],
                ['burglaries', '侵入盗', safety.burglaries],
                ['sexualAssaults', '不同意性交等', safety.sexualAssaults],
              ] as Array<[MapMetricKey, string, number | undefined]>) {
                if (count !== undefined) {
                  rows.push({
                    label,
                    value: `${count.toLocaleString()}件${
                      per(key) ? `（10万人あたり ${per(key)}）` : ''
                    }`,
                  });
                }
              }
              return rows.map(({ label, value }) => (
                <div className="budget-item" key={label}>
                  <div className="budget-item-head">
                    <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
                    <span className="budget-item-value" style={{ whiteSpace: 'normal', textAlign: 'right' }}>
                      {value}
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
          {/* 警察費は都道府県のみ計上（市区町村の予算データには款がない） */}
          <SpendingWithMedian
            budget={selectedRegion}
            names={['警察費']}
            subject="安全"
            averages={averages}
          />
        </div>
      )}

      {def.category === 'fiscal' &&
        selectedRegion.fiscalIndicators &&
        selectedRegion.fiscalIndicators.length > 0 && (
          <div className="budget-card">
            <h3>財政指標</h3>
            <div className="budget-list">
              {selectedRegion.fiscalIndicators.map((indicator) => (
                <div className="budget-item" key={indicator.name}>
                  <div className="budget-item-head">
                    <span>{indicator.name}</span>
                    <span className="budget-item-value">{formatIndicator(indicator)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="budget-card">
        <h3>データソース</h3>
        <p className="attribution">
          出典: Japan Dashboard 地方財政（都道府県ごと・市町村ごと）／デジタル庁・総務省
          <br />
          人口統計: 住民基本台帳に基づく人口（総務省・各年1月1日）／全国都道府県市区町村別面積調（国土地理院）
          <br />
          就労: 市町村税課税状況等の調（総務省・令和7年度）／令和2年国勢調査 就業状態等基本集計（総務省）
          <br />
          インフラ: 公共施設状況調（総務省・各年度期首＝前年度末時点）／水道管・病院は内閣府「見える化DB」（地方公営企業決算・医療施設調査、各年度）
          <br />
          安全: 交通事故統計情報オープンデータ／犯罪統計（警察庁・各年）
          <br />
          市区町村境界: 国土交通省 国土数値情報（行政区域）
        </p>
        {selectedRegion.sourceUrl && (
          <a href={selectedRegion.sourceUrl} target="_blank" rel="noopener noreferrer">
            元データを見る
          </a>
        )}
      </div>

      {flowOpen && selectedRegion.expenditures.length > 0 && (
        <SankeyModal budget={selectedRegion} onClose={() => onFlowOpenChange(false)} />
      )}
    </aside>
  );
}
