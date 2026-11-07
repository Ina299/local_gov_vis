'use client';

import { useState } from 'react';
import type { LocalGovBudget } from '@/types/budget';
import { budgetYearChanges, yearChange, type YearChangeRow } from '@/lib/budgetYearChanges';

const amount = (value: number | null) => value === null ? '—' : (value / 1_000_000).toLocaleString('ja-JP', { maximumFractionDigits: 2 });
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${amount(Math.abs(value))}`;

export function BudgetYearChanges({ budget, yearlyBudgets }: { budget: LocalGovBudget; yearlyBudgets: LocalGovBudget[] }) {
  const [targetYear, setTargetYear] = useState(budget.fiscalYear);
  const [baseYear, setBaseYear] = useState<number | null>(null);
  const [side, setSide] = useState<'expenditures' | 'revenues'>('expenditures');
  const records = new Map(yearlyBudgets.filter(b => b.code === budget.code).map(b => [b.fiscalYear, b]));
  records.set(budget.fiscalYear, budget);
  const years = Array.from(records.keys()).sort((a,b) => b-a);
  const current = records.get(targetYear) ?? budget;
  const comparisonYear = baseYear ?? current.fiscalYear - 1;
  const previous = records.get(comparisonYear);
  const comparisonYears = Array.from(new Set([current.fiscalYear - 1, ...years.filter(y => y < current.fiscalYear)])).sort((a,b) => b-a);
  const rows = previous ? budgetYearChanges(current, previous, side) : [];
  const totalKey = side === 'expenditures' ? 'totalExpenditure' : 'totalRevenue';
  const total = yearChange('合計', current[totalKey], previous?.[totalKey] ?? null);
  const renderRow = (row: YearChangeRow, isTotal = false) => <tr key={row.name} className={isTotal ? 'year-change-total' : undefined}>
    <th scope="row">{row.name}</th><td>{amount(row.previous)}</td><td>{amount(row.current)}</td>
    <td className={row.difference === null || row.difference === 0 ? '' : row.difference > 0 ? 'year-change-increase' : 'year-change-decrease'}>{row.difference === null ? '—' : signed(row.difference)}</td>
    <td>{row.rate === null ? '—' : `${row.rate > 0 ? '+' : ''}${row.rate.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}%`}</td>
  </tr>;

  return <section className="year-changes" aria-label="年度別の収支増減">
    <div className="year-change-controls">
      <div className="comparison-segmented" role="group" aria-label="増減を比較する区分">
        <button type="button" aria-pressed={side === 'expenditures'} className={side === 'expenditures' ? 'active' : ''} onClick={() => setSide('expenditures')}>歳出</button>
        <button type="button" aria-pressed={side === 'revenues'} className={side === 'revenues' ? 'active' : ''} onClick={() => setSide('revenues')}>歳入</button>
      </div>
      <label>比較元 <select value={comparisonYear} onChange={e => setBaseYear(Number(e.target.value))}>{comparisonYears.map(y => <option key={y} value={y}>{y}年度{records.has(y) ? '' : '（データなし）'}</option>)}</select></label>
      <span aria-hidden="true">→</span>
      <label>比較先 <select value={current.fiscalYear} onChange={e => { setTargetYear(Number(e.target.value)); setBaseYear(null); }}>{years.map(y => <option key={y} value={y}>{y}年度</option>)}</select></label>
    </div>
    <p className="attribution">{current.name}の{side === 'expenditures' ? '歳出' : '歳入'}決算を比較。増減額の大きい項目から表示しています。単位：百万円。</p>
    {!previous ? <p role="status" className="year-change-empty">{comparisonYear}年度のデータがないため比較できません。別の年度を選択してください。</p> : <>
      <div className="year-change-scroll" role="region" aria-label="年度増減表（横スクロールできます）" tabIndex={0}>
        <table className="year-change-table">
          <caption>{comparisonYear}年度 → {current.fiscalYear}年度の{side === 'expenditures' ? '歳出' : '歳入'}増減（決算・百万円）</caption>
          <thead><tr><th scope="col">項目</th><th scope="col">{comparisonYear}年度</th><th scope="col">{current.fiscalYear}年度</th><th scope="col">増減額</th><th scope="col">増減率</th></tr></thead>
          <tbody>{renderRow(total, true)}{rows.map(row => renderRow(row))}</tbody>
        </table>
      </div>
      {rows.length === 0 && <p role="status">この年度の項目別内訳は収録されていません。</p>}
      <p className="attribution">増減額＝比較先−比較元。比較元が0円の場合は増減率を「—」と表示します。一方の年度にない項目は未収録として扱います。項目の名称・分類が変わった場合も自動で合算しません。</p>
    </>}
    <p className="attribution">出典：Japan Dashboard 地方財政／デジタル庁・総務省（地方財政状況調査）。当初予算との比較ではありません。</p>
  </section>;
}
