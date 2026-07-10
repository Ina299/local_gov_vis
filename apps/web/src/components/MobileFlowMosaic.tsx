'use client';

import { useMemo, useState } from 'react';
import type { LocalGovBudget } from '@/types/budget';
import { formatAmount } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import {
  buildFlowMosaicData,
  detailItems,
  layoutMosaic,
  type FlowMosaicItem,
} from '@/lib/flowMosaic';
import { GENERAL_SOURCES } from '@/lib/sankey';

interface MobileFlowMosaicProps {
  budget: LocalGovBudget;
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function MobileFlowMosaic({ budget }: MobileFlowMosaicProps) {
  const data = useMemo(() => buildFlowMosaicData(budget), [budget]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected =
    data.expenditures.find((item) => item.name === selectedName) ?? data.expenditures[0] ?? null;
  const rects = useMemo(
    () => layoutMosaic(data.expenditures, (item) => item.amount),
    [data.expenditures]
  );
  const children = useMemo(() => (selected ? detailItems(selected) : []), [selected]);
  const childRects = useMemo(() => layoutMosaic(children, (item) => item.amount), [children]);
  const perPerson = (amount: number) =>
    budget.population ? `${Math.round(amount / budget.population).toLocaleString()}円/人` : null;

  return (
    <div className="mobile-flow" aria-label="モバイル収支図">
      <section className="flow-stage">
        <div className="flow-stage-head">
          <span className="flow-stage-index">01</span>
          <div>
            <h4>歳入の構成</h4>
            <p>自治体に入ったお金</p>
          </div>
          <strong>{formatAmount(budget.totalRevenue)}</strong>
        </div>
        <div className="revenue-spectrum" role="img" aria-label="歳入項目の構成比">
          {data.revenues.map((item) => {
            const share = item.amount / budget.totalRevenue;
            const general = GENERAL_SOURCES.has(item.name);
            return (
              <div
                key={item.name}
                className={`revenue-spectrum-segment ${general ? 'general' : 'specific'}`}
                style={{ width: `${share * 100}%` }}
                title={`${item.name} ${formatAmount(item.amount)}（${pct(share)}）`}
              >
                {share >= 0.12 && <span>{item.name}</span>}
              </div>
            );
          })}
        </div>
        <div className="flow-stage-caption">
          {data.revenues.slice(0, 3).map((item) => (
            <span key={item.name}>
              <i className={GENERAL_SOURCES.has(item.name) ? 'general' : 'specific'} />
              {item.name} {pct(item.amount / budget.totalRevenue)}
            </span>
          ))}
        </div>
      </section>

      <div className="flow-axis" aria-hidden="true"><span>↓</span></div>

      <section className="flow-stage">
        <div className="flow-stage-head">
          <span className="flow-stage-index">02</span>
          <div>
            <h4>財源の性質</h4>
            <p>{data.estimated ? '歳入構成からの推計' : '使途への充当実績'}</p>
          </div>
        </div>
        <div className="funding-bridge">
          <div
            className="funding-bridge-general"
            style={{ width: `${(data.generalAmount / budget.totalExpenditure) * 100}%` }}
          >
            <strong>一般財源</strong>
            <span>{pct(data.generalAmount / budget.totalExpenditure)}</span>
          </div>
          <div className="funding-bridge-specific">
            <strong>特定財源等</strong>
            <span>{pct(data.specificAmount / budget.totalExpenditure)}</span>
          </div>
        </div>
        <p className="flow-explainer">
          一般財源は使い道を自治体が比較的決めやすい財源。特定財源等は国庫支出金など、使途が定められた財源です。
        </p>
      </section>

      <div className="flow-axis" aria-hidden="true"><span>↓</span></div>

      <section className="flow-stage">
        <div className="flow-stage-head">
          <span className="flow-stage-index">03</span>
          <div>
            <h4>歳出モザイク</h4>
            <p>面積が支出額、濃淡が財源構成</p>
          </div>
          <strong>{formatAmount(budget.totalExpenditure)}</strong>
        </div>
        <div className="expenditure-mosaic" role="group" aria-label="目的別歳出。項目を選ぶと詳細を表示">
          {rects.map(({ item, x, y, width, height }) => {
            const share = item.amount / budget.totalExpenditure;
            const generalShare = item.amount > 0 ? item.generalAmount / item.amount : 0;
            const roomy = width >= 19 && height >= 17;
            return (
              <button
                key={item.name}
                type="button"
                className={`mosaic-tile ${selected?.name === item.name ? 'selected' : ''}`}
                style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` }}
                onClick={() => setSelectedName(item.name)}
                aria-pressed={selected?.name === item.name}
                aria-label={`${item.name} ${formatAmount(item.amount)}、歳出の${pct(share)}`}
              >
                <span className="mosaic-funding-general" style={{ height: `${generalShare * 100}%` }} />
                <span className="mosaic-funding-specific" />
                {roomy && (
                  <span className="mosaic-label">
                    <strong>{item.name}</strong>
                    <small>{pct(share)}</small>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mosaic-legend">
          <span><i className="general" />一般財源</span>
          <span><i className="specific" />特定財源等</span>
          <span>タップして内訳を見る</span>
        </div>
      </section>

      {selected && (
        <section className="flow-focus" aria-live="polite">
          <div className="flow-focus-head">
            <div>
              <span>FOCUS</span>
              <h4>{selected.name}</h4>
            </div>
            <div className="flow-focus-value">
              <strong>{formatAmount(selected.amount)}</strong>
              <span>{pct(selected.amount / budget.totalExpenditure)}</span>
              {perPerson(selected.amount) && <span>{perPerson(selected.amount)}</span>}
            </div>
          </div>
          <div className="focus-funding" aria-label={`${selected.name}の財源構成`}>
            <div style={{ width: `${(selected.generalAmount / selected.amount) * 100}%` }}>
              一般 {pct(selected.generalAmount / selected.amount)}
            </div>
            <div>特定 {pct(selected.specificAmount / selected.amount)}</div>
          </div>
          {GLOSSARY[selected.name] && <p className="flow-focus-description">{GLOSSARY[selected.name]}</p>}
          {children.length > 0 && (
            <>
              <h5>この中で何に使ったか</h5>
              <div className="detail-mosaic" role="img" aria-label={`${selected.name}の内訳`}>
                {childRects.map(({ item, x, y, width, height }, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="detail-mosaic-tile"
                    style={{
                      left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%`,
                      background: `hsl(${13 + index * 5} 68% ${52 + (index % 3) * 7}%)`,
                    }}
                    title={`${item.name} ${formatAmount(item.amount)}`}
                  >
                    {width >= 22 && height >= 22 && (
                      <span><strong>{item.name}</strong><small>{pct(item.amount / selected.amount)}</small></span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {selected.natures && selected.natures.length > 1 && (
            <p className="flow-focus-natures">
              性質別: {selected.natures.map((item) => `${item.name} ${item.share}%`).join('・')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
