'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProjectCostSankey } from './ProjectCostSankey';
import {
  EVALUATION_STATUS_LABELS,
  evaluationYearOptions,
  filterEvaluations,
  filterEvaluationSources,
  formatEvaluationAmount,
  formatEvaluationTimestamp,
  formatEvaluationYear,
  safeEvaluationUrl,
} from '@/lib/evaluations';
import {
  createEvaluationRequest,
  createEvaluationShardLoader,
  type EvaluationIndexEntry,
  type EvaluationLoadState,
  type LoadedEvaluationShard,
} from '@/lib/evaluationLoader';
import type {
  AcquisitionStatus,
  EvaluationAmount,
  EvaluationEvidence,
  EvaluationSourceStatus,
  ProjectEvaluation,
} from '@/types/evaluation';

const PAGE_SIZE = 20;
const COST_LABELS: Record<EvaluationAmount['kind'], string> = {
  budget: '予算額', actual: '決算額', personnel: '人件費', fullCost: 'フルコスト',
};
const COST_KINDS = ['budget', 'actual', 'personnel', 'fullCost'] as const;

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
        発見資料 {source.discoveredDocuments}件 ／ 取得資料 {source.fetchedDocuments}件 ／ 抽出レコード {source.extractedProjects}件
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
                  <span>抽出レコード {document.projectCount}件</span>
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

export function MunicipalityEvaluations({ entry, loader, refreshIndex }: {
  entry: EvaluationIndexEntry;
  loader: ReturnType<typeof createEvaluationShardLoader>;
  refreshIndex: () => void;
}) {
  const [evaluationYear, setEvaluationYear] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<EvaluationLoadState<LoadedEvaluationShard>>({ status: 'loading' });
  const [request] = useState(() => createEvaluationRequest<LoadedEvaluationShard>());
  useEffect(() => request.run((signal) => loader.load(entry, signal, retry > 0), setLoad), [entry, loader, request, retry]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [evaluationYear, fiscalYear, query]);
  const dataset = load.status === 'ready' ? load.value.dataset : null;
  const filters = useMemo(() => ({ municipality: entry.municipalityCode, evaluationYear, fiscalYear, query }), [entry.municipalityCode, evaluationYear, fiscalYear, query]);
  const evaluationYears = useMemo(() => evaluationYearOptions([
    ...(dataset?.projects.map((project) => project.evaluationYear) ?? []),
    ...(dataset?.sources.map((source) => source.evaluationYear) ?? []),
  ]), [dataset]);
  const fiscalYears = useMemo(() => evaluationYearOptions(dataset?.projects.map((project) => project.evaluatedFiscalYear) ?? []), [dataset]);
  const projects = useMemo(() => dataset ? filterEvaluations(dataset.projects, filters) : [], [dataset, filters]);
  const sources = useMemo(() => dataset ? filterEvaluationSources(dataset.sources, filters) : [], [dataset, filters]);
  const clearSearch = () => { setQuery(''); setEvaluationYear(''); setFiscalYear(''); };
  return <>
    {load.status === 'loading' && <div className="evaluation-state" role="status">{entry.municipalityName} の評価データを読み込んでいます…（約 {(entry.datasetBytes / 1024 / 1024).toLocaleString('ja-JP', { maximumFractionDigits: 1 })} MB）</div>}
    {load.status === 'error' && <div className="evaluation-state evaluation-state-error" role="alert">
      <h3>{entry.municipalityName} のデータを読み込めませんでした</h3><p>{load.message}</p>
      <p>読み込みの失敗は、評価データが存在しないことを意味しません。更新直後に一致しない場合は自治体一覧も更新してください。</p>
      <div className="evaluation-inline-links"><button className="evaluation-button" onClick={() => setRetry((value) => value + 1)}>この自治体を再読み込み</button><button className="evaluation-text-button" onClick={refreshIndex}>自治体一覧から再読み込み</button></div>
    </div>}
    {dataset && <>
      {load.status === 'ready' && load.value.integrity === 'sha256_unavailable' && <p className="evaluation-warning-list" role="status">このブラウザではSHA-256を検証できません。バイト数・自治体コード・名称・件数と形式は確認済みです。</p>}
      <form className="evaluation-filters evaluation-project-filters" role="search" aria-label="選択した自治体の事業を検索" onSubmit={(event) => event.preventDefault()}>
        <label className="evaluation-query">{entry.municipalityName} の読み込み済み事業を検索
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="事業名、担当課、目的、成果など" />
        </label>
        <label>評価年度（資料表記）<select value={evaluationYear} onChange={(event) => setEvaluationYear(event.target.value)}><option value="">すべての年度</option>{evaluationYears.map((year) => <option key={year} value={year}>{year === 'unknown' ? '年度不明' : `${year}年度`}</option>)}</select></label>
        <label>評価対象年度<select value={fiscalYear} onChange={(event) => setFiscalYear(event.target.value)}><option value="">すべての年度</option>{fiscalYears.map((year) => <option key={year} value={year}>{year === 'unknown' ? '年度不明' : `${year}年度`}</option>)}</select></label>
        <p className="evaluation-filter-help">この検索は選択中の自治体のみが対象です。他自治体の事業は取得・検索しません。空欄・未取得はゼロや低評価を意味せず、年度が読み取れない資料は「年度不明」と表示します。</p>
      </form>
      <ProjectCostSankey projects={dataset.projects} municipalityName={entry.municipalityName} onSelectProject={(name) => {
        setEvaluationYear(''); setFiscalYear(''); setQuery(name);
        document.getElementById('evaluation-results-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }} />
      <section className="evaluation-coverage" aria-labelledby="evaluation-coverage-title">
        <div className="evaluation-section-heading"><h3 id="evaluation-coverage-title">取得元の確認状況</h3><span>{sources.length}件の取得対象</span></div>
        <p className="evaluation-muted">取得元の警告と範囲は、検索語・年度の絞り込みにかかわらず表示します。収録資料が最新年度とは限りません。更新に失敗した場合、以前に取得できた事業を表示していることがあります。</p>
        {sources.length === 0 ? <p className="evaluation-empty-inline">取得対象の記録はありません。</p> : <div className="evaluation-source-list">{sources.map((source) => <CoverageCard source={source} key={source.id} />)}</div>}
      </section>
      <section className="evaluation-results" aria-labelledby="evaluation-results-title">
        <div className="evaluation-section-heading"><h3 id="evaluation-results-title">事業の年度別評価</h3><p role="status" aria-live="polite">{projects.length.toLocaleString()}件{projects.length > visibleCount && `中 ${visibleCount}件を表示`}</p></div>
        <p className="evaluation-muted">件数は年度別レコード数です。同一事業の複数年度の記録を含み、異なる年度を通じた一意の事業数ではありません。別年度の資料に同じ過年度費用が再掲されることもあるため、金額を単純合算できません。</p>
        {projects.length === 0 ? <div className="evaluation-state"><h4>{query || evaluationYear || fiscalYear ? '条件に一致する事業がありません' : '抽出済みの事業がありません'}</h4><p>未取得・取得失敗・未対応の資料は検索結果に含まれません。取得状況と自治体の原資料も確認してください。</p>{(query || evaluationYear || fiscalYear) && <button className="evaluation-button" onClick={clearSearch}>検索語・年度をリセット</button>}</div>
          : <div className="evaluation-project-list">{projects.slice(0, visibleCount).map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
        {projects.length > visibleCount && <button className="evaluation-button evaluation-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>次の{Math.min(PAGE_SIZE, projects.length - visibleCount)}件を表示</button>}
      </section>
      <p className="evaluation-muted evaluation-shard-note">自治体データ生成：{formatEvaluationTimestamp(dataset.generatedAt)} ／ {load.status === 'ready' && load.value.integrity === 'sha256_verified' ? 'SHA-256検証済み' : 'SHA-256未検証'}</p>
    </>}
  </>;
}
