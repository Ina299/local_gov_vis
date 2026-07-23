'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LocalGovBudget, MapScale } from '@/types/budget';
import { formatAmount, formatPerPerson } from '@/lib/format';
import {
  buildBudgetComparisonRows,
  closestPopulationBudget,
  type BudgetComparisonSide,
} from '@/lib/budgetComparison';
import { EXPENDITURE_COLORS, REVENUE_COLORS } from '@/lib/donut';

interface BudgetComparisonModalProps {
  budget: LocalGovBudget;
  candidates: LocalGovBudget[];
  onClose: () => void;
}

function displayValue(value: number | null, scale: MapScale): string {
  if (value === null) return '人口データなし';
  return scale === 'perCapita' ? `${formatPerPerson(value)}/人` : formatAmount(value);
}

function totalValue(
  budget: LocalGovBudget,
  side: BudgetComparisonSide,
  scale: MapScale
): number | null {
  const total = side === 'expenditure' ? budget.totalExpenditure : budget.totalRevenue;
  if (scale === 'total') return total;
  return budget.population && budget.population > 0 ? total / budget.population : null;
}

/** 選択中の団体と同年度・同階層の団体を、歳入／歳出の大分類ごとに比較する */
export function BudgetComparisonModal({
  budget,
  candidates,
  onClose,
}: BudgetComparisonModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<BudgetComparisonSide>('expenditure');
  const [scale, setScale] = useState<MapScale>('perCapita');

  const eligible = useMemo(
    () =>
      candidates
        .filter(
          (candidate) =>
            candidate.code !== budget.code &&
            candidate.code.length === budget.code.length &&
            candidate.fiscalYear === budget.fiscalYear &&
            candidate.expenditures.length > 0 &&
            candidate.revenues.length > 0
        )
        .sort(
          (a, b) =>
            a.prefecture.localeCompare(b.prefecture, 'ja') ||
            a.name.localeCompare(b.name, 'ja')
        ),
    [budget.code, budget.fiscalYear, candidates]
  );
  const initialComparison = useMemo(
    () => closestPopulationBudget(budget, eligible),
    [budget, eligible]
  );
  const [comparisonCode, setComparisonCode] = useState(initialComparison?.code ?? '');

  useEffect(() => {
    if (!eligible.some((candidate) => candidate.code === comparisonCode)) {
      setComparisonCode(initialComparison?.code ?? '');
    }
  }, [comparisonCode, eligible, initialComparison]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const comparison = eligible.find((candidate) => candidate.code === comparisonCode) ?? null;
  const rows = useMemo(
    () =>
      comparison ? buildBudgetComparisonRows(budget, comparison, side, scale) : [],
    [budget, comparison, scale, side]
  );
  const colors = side === 'expenditure' ? EXPENDITURE_COLORS : REVENUE_COLORS;
  const primaryTotal = totalValue(budget, side, scale);
  const comparisonTotal = comparison ? totalValue(comparison, side, scale) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal budget-comparison-modal"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${budget.name}の予算比較`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3>予算比較（{budget.fiscalYear}年度）</h3>
            <p>{budget.name}と別の自治体の予算内訳を比べます</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="budget-comparison-controls">
          <label className="budget-comparison-select">
            <span>比較先</span>
            <select
              value={comparisonCode}
              onChange={(event) => setComparisonCode(event.target.value)}
              disabled={eligible.length === 0}
            >
              {eligible.length === 0 && <option value="">比較できる団体がありません</option>}
              {eligible.map((candidate) => (
                <option key={candidate.code} value={candidate.code}>
                  {candidate.code.length === 5 ? `${candidate.prefecture} ` : ''}
                  {candidate.name}
                </option>
              ))}
            </select>
            {initialComparison?.code === comparisonCode && (
              <small>人口規模が最も近い団体を初期表示</small>
            )}
          </label>
          <div className="budget-comparison-toggles">
            <div className="comparison-segmented" role="group" aria-label="予算区分">
              <button
                className={side === 'expenditure' ? 'active' : ''}
                onClick={() => setSide('expenditure')}
                aria-pressed={side === 'expenditure'}
              >
                歳出
              </button>
              <button
                className={side === 'revenue' ? 'active' : ''}
                onClick={() => setSide('revenue')}
                aria-pressed={side === 'revenue'}
              >
                歳入
              </button>
            </div>
            <div className="comparison-segmented" role="group" aria-label="金額スケール">
              <button
                className={scale === 'perCapita' ? 'active' : ''}
                onClick={() => setScale('perCapita')}
                aria-pressed={scale === 'perCapita'}
              >
                一人当たり
              </button>
              <button
                className={scale === 'total' ? 'active' : ''}
                onClick={() => setScale('total')}
                aria-pressed={scale === 'total'}
              >
                総額
              </button>
            </div>
          </div>
        </div>

        {comparison ? (
          <>
            <div className="budget-comparison-summary">
              <div>
                <strong>{budget.name}</strong>
                <span>{budget.population?.toLocaleString() ?? '—'}人</span>
                <b>{displayValue(primaryTotal, scale)}</b>
              </div>
              <span className="budget-comparison-versus">比較</span>
              <div>
                <strong>{comparison.name}</strong>
                <span>{comparison.population?.toLocaleString() ?? '—'}人</span>
                <b>{displayValue(comparisonTotal, scale)}</b>
              </div>
            </div>

            <div className="budget-comparison-list">
              {rows.map((row) => {
                const primaryWidth =
                  row.primaryValue !== null && row.maxValue > 0
                    ? (row.primaryValue / row.maxValue) * 100
                    : 0;
                const comparisonWidth =
                  row.comparisonValue !== null && row.maxValue > 0
                    ? (row.comparisonValue / row.maxValue) * 100
                    : 0;
                const difference =
                  row.primaryValue !== null && row.comparisonValue !== null
                    ? row.comparisonValue - row.primaryValue
                    : null;
                const color = colors[row.name] ?? '#8f8d86';
                return (
                  <div className="budget-comparison-row" key={row.name}>
                    <div className="budget-comparison-row-head">
                      <strong>{row.name}</strong>
                      {difference !== null && (
                        <span className={difference >= 0 ? 'positive' : 'negative'}>
                          比較先が{difference >= 0 ? '+' : '−'}
                          {displayValue(Math.abs(difference), scale)}
                        </span>
                      )}
                    </div>
                    <div className="budget-comparison-pair">
                      <span title={budget.name}>{budget.name}</span>
                      <div className="budget-comparison-track">
                        <i style={{ width: `${primaryWidth}%`, background: color }} />
                      </div>
                      <b>{displayValue(row.primaryValue, scale)}</b>
                    </div>
                    <div className="budget-comparison-pair">
                      <span title={comparison.name}>{comparison.name}</span>
                      <div className="budget-comparison-track">
                        <i
                          style={{
                            width: `${comparisonWidth}%`,
                            background: color,
                            opacity: 0.58,
                          }}
                        />
                      </div>
                      <b>{displayValue(row.comparisonValue, scale)}</b>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="attribution budget-comparison-note">
              棒の長さは項目ごとに2団体の大きい方を100%として比較しています。
              一人当たり額は各年度の人口で計算しています。
            </p>
          </>
        ) : (
          <p className="budget-comparison-empty">
            同じ年度・同じ階層で内訳のある比較対象がありません。
          </p>
        )}
      </div>
    </div>
  );
}
