'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { dataUrl } from '@/lib/paths';
import {
  EVALUATION_STATUS_LABELS,
  evaluationMunicipalities,
  evaluationYearOptions,
  filterEvaluations,
  filterEvaluationSources,
  formatEvaluationAmount,
  formatEvaluationTimestamp,
  formatEvaluationYear,
  parseEvaluationDataset,
  safeEvaluationUrl,
} from '@/lib/evaluations';
import type {
  AcquisitionStatus,
  EvaluationAmount,
  EvaluationDataset,
  EvaluationEvidence,
  EvaluationSourceStatus,
  ProjectEvaluation,
} from '@/types/evaluation';

const PAGE_SIZE = 20;
const COST_LABELS: Record<EvaluationAmount['kind'], string> = {
  budget: '予算額', actual: '決算額', personnel: '人件費', fullCost: 'フルコスト',
};
const COST_KINDS = ['budget', 'actual', 'personnel', 'fullCost'] as const;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; dataset: EvaluationDataset };

function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  const href = safeEvaluationUrl(url);
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}<span aria-label="新しいタブで開く"> ↗</span></a>
    : <span>{children}（リンクなし）</span>;
}

function StatusBadge({ status }: { status: AcquisitionStatus }) {
  return <span className={`evaluation-badge evaluation-badge-${status}`}>{EVALUATION_STATUS_LABELS[status]}</span>;
}

function Evidence({ evidence, label = '抽出箇所・原文を確認' }: { evidence: EvaluationEvidence; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details className="evaluation-evidence" onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>{label}</summary>
      {expanded && <div className="evaluation-evidence-body">
        <div className="evaluation-inline-links">
          <SourceLink url={evidence.sourceUrl}>原資料（{evidence.format.toUpperCase()}）</SourceLink>
          <SourceLink url={evidence.sourcePageUrl}>自治体の公開ページ</SourceLink>
        </div>
        <dl className="evaluation-provenance">
          <div><dt>ページ</dt><dd>{evidence.page === null ? '該当なし・未記録' : `${evidence.page}ページ`}</dd></div>
          <div><dt>シート</dt><dd>{evidence.sheet || '該当なし・未記録'}</dd></div>
          <div><dt>セル</dt><dd>{evidence.cell || '該当なし・未記録'}</dd></div>
          <div><dt>取得日時</dt><dd>{formatEvaluationTimestamp(evidence.fetchedAt)}</dd></div>
          <div className="evaluation-wide"><dt>SHA-256</dt><dd className="evaluation-hash">{evidence.sha256 || '未記録'}</dd></div>
        </dl>
        <p className="evaluation-label">抽出原文</p>
        <pre className="evaluation-raw-text">{evidence.rawText || '原文の記録なし'}</pre>
      </div>}
    </details>
  );
}

function CoverageCard({ source }: { source: EvaluationSourceStatus }) {
  return (
    <article className="evaluation-source-card">
      <div className="evaluation-card-title">
        <h3>{source.municipalityName} <span className="evaluation-muted">取得対象の評価年度：{formatEvaluationYear(source.evaluationYear)}</span></h3>
        <StatusBadge status={source.status} />
      </div>
      <p>{source.scope}</p>
      <p className={source.status === 'failed' || source.status === 'partial' ? 'evaluation-warning-text' : 'evaluation-muted'}>{source.message}</p>
      <p className="evaluation-source-counts">
        発見資料 {source.discoveredDocuments}件 ／ 取得資料 {source.fetchedDocuments}件 ／ 抽出事業 {source.extractedProjects}件
      </p>
      <SourceLink url={source.sourcePageUrl}>自治体の公開ページ</SourceLink>
      <details className="evaluation-evidence">
        <summary>取得履歴・資料別の状況（{source.documents.length}件）</summary>
        <div className="evaluation-evidence-body">
          <p>最終取得試行：{formatEvaluationTimestamp(source.lastAttemptAt)}</p>
          <p>最終成功：{formatEvaluationTimestamp(source.lastSuccessAt)}</p>
          {source.documents.length === 0 && <p className="evaluation-muted">資料別の記録はありません。</p>}
          <ul className="evaluation-document-list">
            {source.documents.map((document, index) => (
              <li key={`${document.url}-${index}`}>
                <div className="evaluation-inline-links">
                  <SourceLink url={document.url}>資料 {index + 1}（{document.format.toUpperCase()}）</SourceLink>
                  <StatusBadge status={document.status} />
                  <span>抽出事業 {document.projectCount}件</span>
                </div>
                <p>{document.message}</p>
                <p className="evaluation-muted">取得：{formatEvaluationTimestamp(document.fetchedAt)}</p>
                <p className="evaluation-hash">SHA-256：{document.sha256 || '未記録'}</p>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </article>
  );
}

function ProjectCard({ project }: { project: ProjectEvaluation }) {
  const [expanded, setExpanded] = useState(false);
  const sources = Array.from(new Map(project.evidence.map((evidence) => [evidence.sourceUrl, evidence])).values());
  return (
    <article className="evaluation-project-card">
      <div className="evaluation-card-title">
        <p className="evaluation-eyebrow">{project.municipalityName} <span>自治体コード {project.municipalityCode}</span></p>
        {project.extractionStatus === 'partial' && <span className="evaluation-badge evaluation-badge-partial">一部抽出</span>}
      </div>
      <h3>{project.projectName}</h3>
      <div className="evaluation-project-meta">
        <span><strong>評価年度（資料表記）</strong> {formatEvaluationYear(project.evaluationYear)}</span>
        <span><strong>評価対象年度</strong> {formatEvaluationYear(project.evaluatedFiscalYear)}</span>
        <span><strong>担当</strong> {project.department || '記載なし・未取得'}</span>
        {project.projectCode !== null && <span><strong>事業番号</strong> {project.projectCode}</span>}
      </div>
      <p className="evaluation-purpose">{project.purpose || '事業目的は未取得です。原資料を確認してください。'}</p>
      <div className="evaluation-inline-links">
        {sources.map((evidence, index) => (
          <SourceLink key={evidence.sourceUrl} url={evidence.sourceUrl}>
            原資料{sources.length > 1 ? ` ${index + 1}` : ''}（{evidence.format.toUpperCase()}）
          </SourceLink>
        ))}
        {sources.length === 0 && <span className="evaluation-muted">原資料のリンクは未記録です。</span>}
      </div>
      {project.warnings.length > 0 && (
        <ul className="evaluation-warning-list">{project.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      )}
      <details className="evaluation-project-details" onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>活動・成果・コストと評価を読む</summary>
        {expanded && <div className="evaluation-detail-body">
          <section>
            <h4>活動と成果</h4>
            <dl className="evaluation-narratives">
              <div><dt>事業内容・活動</dt><dd>{project.activities || '記載なし・未取得'}</dd></div>
              <div><dt>成果</dt><dd>{project.outcomes || '記載なし・未取得'}</dd></div>
            </dl>
          </section>
          <section>
            <h4>コスト</h4>
            <p className="evaluation-muted">原資料の金額を円で表示します。費用区分は原資料に従い、欠損を0円に置き換えたり、フルコストを推計したりしません。各行の年度も確認してください。</p>
            <div className="evaluation-cost-grid">
              {COST_KINDS.map((kind) => {
                const amounts = project.amounts.filter((amount) => amount.kind === kind);
                return (
                  <div className="evaluation-cost-item" key={kind}>
                    <h5>{COST_LABELS[kind]}</h5>
                    {amounts.length === 0 && <p className="evaluation-missing">記載なし・未取得</p>}
                    {amounts.map((amount, index) => (
                      <div className="evaluation-cost-value" key={index}>
                        <p className="evaluation-muted">{formatEvaluationYear(amount.fiscalYear)}</p>
                        <p className="evaluation-amount">{formatEvaluationAmount(amount.amountYen)}</p>
                        <p className="evaluation-muted">原表記：{amount.rawValue || '記録なし'}{amount.rawUnit && `（${amount.rawUnit}）`}</p>
                        <Evidence evidence={amount.evidence} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
          <section>
            <h4>指標・目標・実績</h4>
            {project.indicators.length === 0 ? <p className="evaluation-missing">指標は記載なし・未取得です。</p> : (
              <div className="evaluation-table-scroll" tabIndex={0} role="region" aria-label={`${project.projectName}の指標表`}>
                <table className="evaluation-table">
                  <thead><tr><th scope="col">指標</th><th scope="col">対象年度</th><th scope="col">目標</th><th scope="col">実績</th><th scope="col">単位</th><th scope="col">根拠</th></tr></thead>
                  <tbody>{project.indicators.map((indicator, index) => (
                    <tr key={index}>
                      <th scope="row">{indicator.name}</th>
                      <td>{formatEvaluationYear(indicator.fiscalYear)}</td>
                      <td>{indicator.target ?? '記載なし・未取得'}</td>
                      <td>{indicator.actual ?? '記載なし・未取得'}</td>
                      <td>{indicator.unit ?? '記載なし・未取得'}</td>
                      <td><Evidence evidence={indicator.evidence} label="原文を確認" /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h4>自治体の評価</h4>
            <p className="evaluation-muted">自治体ごとの原表記と尺度をそのまま示します。自己評価と外部評価は別に表示し、共通順位や他自治体との優劣には換算しません。</p>
            {project.ratings.length === 0 ? <p className="evaluation-missing">評価は記載なし・未取得です。</p> : (
              <div className="evaluation-rating-list">{project.ratings.map((rating, index) => (
                <div className="evaluation-rating" key={index}>
                  <p className="evaluation-label">{rating.kind === 'self' ? '自己評価' : '外部評価'} · {rating.label}</p>
                  <p className="evaluation-rating-value">{rating.value}</p>
                  <p className="evaluation-preserve-text">尺度・定義：{rating.scale || '未取得。原資料で確認してください。'}</p>
                  <Evidence evidence={rating.evidence} />
                </div>
              ))}</div>
            )}
          </section>
          <section>
            <h4>事業全体の出典・抽出原文</h4>
            {project.evidence.map((evidence, index) => (
              <Evidence key={index} evidence={evidence} label={`出典 ${index + 1} · ${evidence.format.toUpperCase()} · ${evidence.page === null ? evidence.sheet || '原文' : `${evidence.page}ページ`}`} />
            ))}
            {project.evidence.length === 0 && <p className="evaluation-missing">出典の記録はありません。</p>}
          </section>
        </div>}
      </details>
    </article>
  );
}

export function EvaluationBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const municipality = searchParams.get('municipality') ?? '';
  const [evaluationYear, setEvaluationYear] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    setLoad({ status: 'loading' });
    fetch(dataUrl('/evaluations.json'), { signal: controller.signal, cache: 'no-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`データを取得できませんでした（HTTP ${response.status}）。`);
        return parseEvaluationDataset(await response.json());
      })
      .then((dataset) => {
        window.clearTimeout(timeout);
        if (active) setLoad({ status: 'ready', dataset });
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeout);
        if (active && (!controller.signal.aborted || timedOut)) {
          setLoad({ status: 'error', message: timedOut ? 'データの読み込みがタイムアウトしました。' : error instanceof Error ? error.message : '読み込みに失敗しました。' });
        }
      });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [retry]);

  // A different municipality link (including Back/Forward) starts a fresh local search.
  useEffect(() => {
    setEvaluationYear('');
    setFiscalYear('');
    setQuery('');
    setVisibleCount(PAGE_SIZE);
  }, [municipality]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [evaluationYear, fiscalYear, query]);

  const dataset = load.status === 'ready' ? load.dataset : null;
  const filters = useMemo(() => ({ municipality, evaluationYear, fiscalYear, query }), [municipality, evaluationYear, fiscalYear, query]);
  const municipalities = useMemo(() => dataset ? evaluationMunicipalities(dataset) : [], [dataset]);
  const municipalityProjects = useMemo(() => dataset?.projects.filter((project) => !municipality || project.municipalityCode === municipality) ?? [], [dataset, municipality]);
  const municipalitySources = useMemo(() => dataset?.sources.filter((source) => !municipality || source.municipalityCode === municipality) ?? [], [dataset, municipality]);
  const evaluationYears = useMemo(() => evaluationYearOptions([
    ...municipalityProjects.map((project) => project.evaluationYear),
    ...municipalitySources.map((source) => source.evaluationYear),
  ]), [municipalityProjects, municipalitySources]);
  const fiscalYears = useMemo(() => evaluationYearOptions(municipalityProjects.map((project) => project.evaluatedFiscalYear)), [municipalityProjects]);
  const projects = useMemo(() => dataset ? filterEvaluations(dataset.projects, filters) : [], [dataset, filters]);
  const sources = useMemo(() => dataset ? filterEvaluationSources(dataset.sources, filters) : [], [dataset, filters]);
  const unsupportedMunicipality = Boolean(municipality && !municipalities.some((entry) => entry.code === municipality));

  const selectMunicipality = (code: string) => {
    const params = new URLSearchParams();
    if (code) params.set('municipality', code);
    router.replace(`/evaluations/${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  };
  const clearSearch = () => { setQuery(''); setEvaluationYear(''); setFiscalYear(''); };

  return (
    <main className="evaluation-page">
      <div className="evaluation-content">
        <header className="evaluation-header">
          <Link className="evaluation-back" href="/">← 地方自治体予算マップ</Link>
          <p className="evaluation-eyebrow">自治体の公開資料から</p>
          <h1>事務事業評価を読む</h1>
          <p>事業ごとの目的、活動、成果、コストを、自治体の評価シートとともに確認できます。</p>
        </header>
        <aside className="evaluation-notice" aria-label="データの読み方">
          <h2>収録範囲と年度を確認してください</h2>
          <p>全国・全事業を網羅するデータではありません。取得できない資料や未対応の自治体もあります。評価年度（資料表記）と、実際に評価された対象年度は異なる場合があります。</p>
          <p>事業評価の金額と予算マップの財政総額は、対象・会計・費用の範囲が異なります。相互に合算せず、予算の款・項と評価事業を自動で対応付けることもしません。</p>
        </aside>

        {load.status === 'loading' && <div className="evaluation-state" role="status">評価データと取得状況を読み込んでいます…</div>}
        {load.status === 'error' && (
          <div className="evaluation-state evaluation-state-error" role="alert">
            <h2>評価データを読み込めませんでした</h2>
            <p>{load.message}</p>
            <p>接続状況を確認して再試行してください。データ未配置・形式不正の場合は、サイト側の更新が必要です。</p>
            <button className="evaluation-button" onClick={() => setRetry((value) => value + 1)}>再読み込み</button>
          </div>
        )}
        {dataset && (
          <>
            <form className="evaluation-filters" role="search" onSubmit={(event) => event.preventDefault()}>
              <label className="evaluation-query">事業を検索
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="事業名、担当課、目的、成果など" />
              </label>
              <label>自治体
                <select value={municipality} onChange={(event) => selectMunicipality(event.target.value)}>
                  <option value="">収録自治体すべて</option>
                  {unsupportedMunicipality && <option value={municipality}>コード {municipality}（未収録）</option>}
                  {municipalities.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}（{entry.code}）</option>)}
                </select>
              </label>
              <label>評価年度（資料表記）
                <select value={evaluationYear} onChange={(event) => setEvaluationYear(event.target.value)}>
                  <option value="">すべての年度</option>
                  {evaluationYears.map((year) => <option key={year} value={year}>{year === 'unknown' ? '年度不明' : `${year}年度`}</option>)}
                </select>
              </label>
              <label>評価対象年度
                <select value={fiscalYear} onChange={(event) => setFiscalYear(event.target.value)}>
                  <option value="">すべての年度</option>
                  {fiscalYears.map((year) => <option key={year} value={year}>{year === 'unknown' ? '年度不明' : `${year}年度`}</option>)}
                </select>
              </label>
              <p className="evaluation-filter-help">空欄・未取得はゼロや低評価を意味しません。年度が読み取れない資料は「年度不明」と表示します。</p>
            </form>
            <section className="evaluation-coverage" aria-labelledby="evaluation-coverage-title">
              <div className="evaluation-section-heading">
                <h2 id="evaluation-coverage-title">取得元の最新確認状況</h2>
                <span>{sources.length}件の取得対象</span>
              </div>
              <p className="evaluation-muted">選択した自治体の取得元を、検索語・年度の絞り込みにかかわらず表示します。更新に失敗した場合、以前に取得できた事業を表示していることがあります。資料ごとの取得日時も確認してください。</p>
              {unsupportedMunicipality ? (
                <div className="evaluation-state">
                  <h3>この自治体は未収録です</h3>
                  <p>自治体コード {municipality} の取得対象は登録されていません。評価を実施していない、または資料を公開していないという意味ではありません。</p>
                  <button className="evaluation-button" onClick={() => selectMunicipality('')}>収録自治体をすべて見る</button>
                </div>
              ) : sources.length === 0 ? (
                <p className="evaluation-empty-inline">この条件に一致する取得対象の記録はありません。</p>
              ) : <div className="evaluation-source-list">{sources.map((source) => <CoverageCard source={source} key={source.id} />)}</div>}
            </section>
            <section className="evaluation-results" aria-labelledby="evaluation-results-title">
              <div className="evaluation-section-heading">
                <h2 id="evaluation-results-title">事業の評価</h2>
                <p role="status" aria-live="polite">{projects.length}件{projects.length > visibleCount && `中 ${visibleCount}件を表示`}</p>
              </div>
              {projects.length === 0 ? (
                <div className="evaluation-state">
                  <h3>{unsupportedMunicipality ? '表示できる評価データがありません' : query || evaluationYear || fiscalYear ? '条件に一致する事業がありません' : '抽出済みの事業がありません'}</h3>
                  <p>未取得・取得失敗・未対応の資料は検索結果に含まれません。上の取得状況と自治体の原資料も確認してください。</p>
                  {(query || evaluationYear || fiscalYear) && <button className="evaluation-button" onClick={clearSearch}>検索語・年度をリセット</button>}
                </div>
              ) : (
                <div className="evaluation-project-list">{projects.slice(0, visibleCount).map((project) => <ProjectCard key={project.id} project={project} />)}</div>
              )}
              {projects.length > visibleCount && (
                <button className="evaluation-button evaluation-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                  次の{Math.min(PAGE_SIZE, projects.length - visibleCount)}件を表示
                </button>
              )}
            </section>
            <footer className="evaluation-footer">
              <p>出典：各自治体の事務事業評価・行政評価の公開資料。原文・評価尺度は自治体ごとの表記です。</p>
              <p>データ生成：{formatEvaluationTimestamp(dataset.generatedAt)}</p>
              <button className="evaluation-text-button" onClick={() => setRetry((value) => value + 1)}>データを再読み込み</button>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
