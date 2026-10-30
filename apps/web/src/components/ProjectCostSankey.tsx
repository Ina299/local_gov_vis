'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectEvaluation } from '@/types/evaluation';
import { formatAmount } from '@/lib/format';
import { EXP_COLOR, ribbonPath } from '@/lib/sankey';
import { COST_FLOW_ANCHOR, loadBudgetTotals } from '@/lib/evaluationCoverage';
import { FLOW, budgetContext, costFlowLayout, costFlowYears, defaultFlowYear, type FlowNode } from '@/lib/projectCostFlow';

const LABEL_SPACING = 13;
const shorten = (s: string, n: number) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n - 1).join('')}…` : s);

/** ラベルが重ならないよう、ノード中心から下方向にだけずらした y 座標 */
function labelYs(nodes: FlowNode[]): Map<string, number> {
  const out = new Map<string, number>(); let last = -Infinity;
  for (const n of nodes) { const y = Math.max(n.y + n.h / 2, last + LABEL_SPACING); out.set(n.key, y); last = y; }
  return out;
}

/** 収録できた事業の決算額 → 部局 → 事業。合計は歳出総額ではない */
const REST_COLOR = '#d9dde3';

export function ProjectCostSankey({ projects, municipalityCode, municipalityName, onSelectProject }: {
  projects: ProjectEvaluation[]; municipalityCode: string; municipalityName: string; onSelectProject: (name: string) => void;
}) {
  // 全体の規模（歳出総額・決算）。取れなければ全体の棒を出さず、事業の流れだけを描く
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [totalsFailed, setTotalsFailed] = useState(false);
  useEffect(() => {
    let live = true;
    // 歳出総額は都道府県を 2 桁コードで持つ（評価データでは 13000 の形）
    const key = /^\d{2}000$/.test(municipalityCode) ? municipalityCode.slice(0, 2) : municipalityCode;
    loadBudgetTotals().then((file) => { if (live) setTotals(file.totals[key] ?? {}); }).catch(() => { if (live) setTotalsFailed(true); });
    return () => { live = false; };
  }, [municipalityCode]);
  const years = useMemo(() => costFlowYears(projects), [projects]);
  const [chosen, setChosen] = useState<number | null>(null);
  const fiscalYear = chosen ?? defaultFlowYear(years);
  const year = years.find((y) => y.fiscalYear === fiscalYear) ?? null;
  const layout = useMemo(() => (year ? costFlowLayout(year) : null), [year]);
  const [hover, setHover] = useState<{ key: string; x: number; y: number; text: string } | null>(null);
  // 収支図などから #evaluation-cost-flow 付きで来たとき、読み込み後に図の位置へ移る（ブラウザのアンカー移動は描画前で効かない）
  const sectionRef = useRef<HTMLElement>(null);
  const hasFlow = Boolean(year && layout);
  useEffect(() => {
    if (hasFlow && window.location.hash === `#${COST_FLOW_ANCHOR}`) sectionRef.current?.scrollIntoView({ block: 'start' });
  }, [hasFlow]);
  if (!year || !layout) return null;

  const byKey = new Map(layout.nodes.map((n) => [n.key, n]));
  const mids = layout.nodes.filter((n) => n.column === 1);
  const rights = layout.nodes.filter((n) => n.column === 2);
  const midY = labelYs(mids); const rightY = labelYs(rights);
  const height = Math.max(layout.height, ...Array.from(rightY.values()).map((y) => y + 16), ...Array.from(midY.values()).map((y) => y + 16));
  const context = budgetContext(year.total, totals?.[String(fiscalYear)]);
  const totalYears = totals ? Object.keys(totals).map(Number).sort((a, b) => a - b) : [];
  // 歳出総額の棒: 収録できた事業の分（上端）を色付きで、残りを灰色で。細すぎて見えないときは 2px にする
  const barH = layout ? layout.nodes[0].h : FLOW.plot; // 全体の棒は「収録できた事業」と同じ高さに描き、その中の割合で収録分を示す
  const slice = context ? Math.max(2, barH * context.ratio) : 0;
  const pct = (r: number) => `${(r * 100).toLocaleString('ja-JP', { maximumFractionDigits: r < 0.1 ? 1 : 0 })}%`;
  const share = (amount: number) => `${((amount / year.total) * 100).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}%`;
  const describe = (n: FlowNode) => `${n.label}\n${formatAmount(n.amount)}（収録合計の${share(n.amount)}）・${n.count.toLocaleString()}事業`;
  const related = (key: string) => hover && (hover.key === key || hover.key.split('>').includes(key));
  const show = (key: string, text: string) => (e: React.MouseEvent) => {
    const box = (e.currentTarget.closest('.evaluation-cost-flow-chart') ?? e.currentTarget).getBoundingClientRect();
    setHover({ key, x: e.clientX - box.left, y: e.clientY - box.top, text });
  };
  const select = (n: FlowNode) => { if (n.projectName) onSelectProject(n.projectName); };

  return (
    <section id={COST_FLOW_ANCHOR} ref={sectionRef} className="evaluation-cost-flow" aria-labelledby="evaluation-cost-flow-title">
      <div className="evaluation-section-heading">
        <h3 id="evaluation-cost-flow-title">事業コストの流れ（{fiscalYear}年度決算）</h3>
        <label className="evaluation-cost-flow-year">年度
          <select value={fiscalYear ?? ''} onChange={(e) => setChosen(Number(e.target.value))}>
            {years.map((y) => <option key={y.fiscalYear} value={y.fiscalYear}>{y.fiscalYear}年度（{y.projects.length.toLocaleString()}事業）</option>)}
          </select>
        </label>
      </div>
      <p className="evaluation-muted">
        {municipalityName}の評価資料から決算額を読み取れた{year.projects.length.toLocaleString()}事業の合計 {formatAmount(year.total)} を、所管の部局ごとに分けています。
        <strong>歳出総額ではありません。</strong>収録できた事業だけの合計で、人件費等の別建ての費用は含みません。地図の収支図（款・項）とは別の集計で、対応関係はありません。
        {(year.conflicting > 0 || year.ambiguous > 0) && <> 同じ事業の再掲で金額が食い違う{year.conflicting}事業と、同じ年度の決算額が一つに決まらない{year.ambiguous}件は除いています。</>}
      </p>
      {context ? <p className="evaluation-muted">
        全体の規模として、{fiscalYear}年度の歳出総額（決算）{formatAmount(context.total)}を左端に置いています。収録できた事業はその{pct(context.ratio)}で、色付きの部分を右に拡大して描いています（拡大の前後で縮尺は異なります）。
      </p> : (totals || totalsFailed) && <p className="evaluation-muted">
        {totalsFailed ? '歳出総額（決算）を読み込めなかったため、全体の規模は表示していません。'
          : year.total > (totals?.[String(fiscalYear)] ?? Infinity) ? `収録できた事業の合計が${fiscalYear}年度の歳出総額（決算）を上回るため、全体との比較は表示していません（年度の対応が資料とずれている可能性があります）。`
          : `${fiscalYear}年度の歳出総額（決算）はまだ収録していないため、全体の規模は表示していません${totalYears.length ? `（収録は${totalYears[0]}〜${totalYears[totalYears.length - 1]}年度）` : ''}。`}
      </p>}
      <div className="evaluation-cost-flow-chart" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${FLOW.width} ${height}`} role="img" aria-label={`${municipalityName}の${fiscalYear}年度 事業コストの流れ`}>
          {context && <g>
            {/* 拡大の扇: 歳出総額の中の収録分を、右の「収録できた事業」の高さに引き伸ばして見せる（同じ縮尺ではない） */}
            <path d={`M${FLOW.budgetX + FLOW.nodeW},${FLOW.top} L${FLOW.x[0]},${FLOW.top} L${FLOW.x[0]},${layout.nodes[0].y + layout.nodes[0].h} L${FLOW.budgetX + FLOW.nodeW},${FLOW.top + slice} Z`}
              fill={EXP_COLOR} opacity={0.1} stroke={EXP_COLOR} strokeOpacity={0.5} strokeDasharray="3 3" />
            <rect x={FLOW.budgetX} y={FLOW.top + slice} width={FLOW.nodeW} height={barH - slice} fill={REST_COLOR} rx={2}
              onMouseMove={show('budget', `歳出総額（${fiscalYear}年度決算）
${formatAmount(context.total)}
うち評価資料から事業別の決算額を読み取れたのは ${formatAmount(year.total)}（${pct(context.ratio)}）`)} />
            <rect x={FLOW.budgetX} y={FLOW.top} width={FLOW.nodeW} height={slice} fill={EXP_COLOR} rx={1}
              onMouseMove={show('budget', `収録できた事業 ${formatAmount(year.total)}
歳出総額 ${formatAmount(context.total)} の ${pct(context.ratio)}`)} />
            <text x={FLOW.budgetX + FLOW.nodeW + 6} y={FLOW.top + barH - 34} fontSize={12} fill="#1a1a2e" fontWeight={600}>歳出総額（決算）</text>
            <text x={FLOW.budgetX + FLOW.nodeW + 6} y={FLOW.top + barH - 18} fontSize={12} fill="#1a1a2e">{formatAmount(context.total)}</text>
            <text x={FLOW.budgetX + FLOW.nodeW + 6} y={FLOW.top + barH - 3} fontSize={10} fill="#65666b">うち収録 {pct(context.ratio)}</text>
            <text x={(FLOW.budgetX + FLOW.x[0]) / 2 + 20} y={FLOW.top + barH * 0.42} fontSize={10} fill="#65666b" textAnchor="middle">拡大</text>
          </g>}
          {layout.ribbons.map((r) => {
            const from = byKey.get(r.from)!; const to = byKey.get(r.to)!;
            const x0 = FLOW.x[from.column] + FLOW.nodeW; const x1 = FLOW.x[to.column];
            return <path key={r.key} d={ribbonPath(x0, r.y0, x1, r.y1, Math.max(r.h, 0.5))} fill={EXP_COLOR}
              opacity={hover ? (related(r.key) || related(r.from) || related(r.to) ? 0.55 : 0.12) : 0.3}
              onMouseMove={show(r.key, `${from.label} → ${to.label}\n${formatAmount(r.amount)}（${share(r.amount)}）`)} />;
          })}
          {layout.nodes.map((n) => (
            <rect key={n.key} x={FLOW.x[n.column]} y={n.y} width={FLOW.nodeW} height={Math.max(n.h, 1)} rx={2}
              fill={n.column === 0 ? '#52514e' : EXP_COLOR} className={n.projectName ? 'evaluation-cost-flow-clickable' : undefined}
              tabIndex={n.projectName ? 0 : undefined} role={n.projectName ? 'button' : undefined}
              aria-label={n.projectName ? `${n.label}の事業カードを表示` : undefined}
              onMouseMove={show(n.key, describe(n))} onClick={() => select(n)}
              onKeyDown={(e) => { if (n.projectName && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(n); } }} />
          ))}
          <text x={FLOW.x[0] - 8} y={FLOW.top + 4} textAnchor="end" fontSize={12} fill="#1a1a2e" fontWeight={600}>収録できた事業</text>
          <text x={FLOW.x[0] - 8} y={FLOW.top + 20} textAnchor="end" fontSize={12} fill="#1a1a2e">{formatAmount(year.total)}</text>
          <text x={FLOW.x[0] - 8} y={FLOW.top + 35} textAnchor="end" fontSize={10} fill="#65666b">{year.projects.length.toLocaleString()}事業</text>
          {mids.map((n) => (
            <text key={n.key} x={FLOW.x[1] + FLOW.nodeW + 6} y={midY.get(n.key)! + 4} fontSize={11} fill="#1a1a2e"
              stroke="#fff" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
              {shorten(n.label, 14)}<tspan fill="#65666b" fontSize={10} dx={4}>{share(n.amount)}</tspan>
            </text>
          ))}
          {rights.map((n) => (
            <text key={n.key} x={FLOW.x[2] + FLOW.nodeW + 6} y={rightY.get(n.key)! + 4} fontSize={11}
              fill={n.projectName ? '#1a1a2e' : '#65666b'} className={n.projectName ? 'evaluation-cost-flow-clickable' : undefined}
              onClick={() => select(n)} onMouseMove={show(n.key, describe(n))}>
              {n.projectName ? shorten(n.label, 18) : `${shorten(n.key.slice(5), 8)}：他${n.count.toLocaleString()}事業`}
              <tspan fill="#65666b" fontSize={10} dx={4}>{formatAmount(n.amount)}</tspan>
            </text>
          ))}
        </svg>
        {hover && <div className="evaluation-cost-flow-tooltip" role="tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          {hover.text.split('\n').map((line, i) => <div key={i} className={i === 0 ? 'evaluation-cost-flow-tooltip-title' : undefined}>{line}</div>)}
          {byKey.get(hover.key)?.projectName && <div className="evaluation-muted">クリックで事業カードを表示</div>}
        </div>}
      </div>
      <details className="evaluation-cost-flow-table">
        <summary>表で見る（部局別・上位事業）</summary>
        <table>
          <thead><tr><th scope="col">部局・事業</th><th scope="col">決算額</th><th scope="col">構成比</th><th scope="col">事業数</th></tr></thead>
          <tbody>
            {mids.map((m) => <tr key={m.key}><th scope="row">{m.label}</th><td>{formatAmount(m.amount)}</td><td>{share(m.amount)}</td><td>{m.count.toLocaleString()}</td></tr>)}
          </tbody>
          <tbody>
            {year.projects.slice(0, 30).map((p) => <tr key={p.key}><th scope="row">{p.name}<span className="evaluation-muted">（{p.department}）</span></th><td>{formatAmount(p.amount)}</td><td>{share(p.amount)}</td><td>1</td></tr>)}
          </tbody>
        </table>
        {year.projects.length > 30 && <p className="evaluation-muted">上位30事業を表示しています。全{year.projects.length.toLocaleString()}事業は下の事業カードで確認できます。</p>}
      </details>
    </section>
  );
}
