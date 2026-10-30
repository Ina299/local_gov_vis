'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createEvaluationRequest, createEvaluationShardLoader, loadEvaluationIndex, type EvaluationIndex, type EvaluationLoadState } from '@/lib/evaluationLoader';
import { createEvidenceLoader, isPrefectureEvaluationCode, loadEvidenceIndex, type LoadedEvidence } from '@/lib/evaluationEvidenceLoader';
import { sourceAcquisitionLabel, DISCOVERY_LABELS, EVIDENCE_LABELS, EVALUATION_TYPE_LABELS, ROLE_LABELS, TEXT_LABELS, YEAR_LABELS, evidenceHref, findTextMatches, readEvidenceSelection, safeEvidenceUrl, searchEvidenceMunicipalities } from '@/lib/evaluationEvidence';
import { formatEvaluationTimestamp } from '@/lib/evaluations';
import type { DocumentText, DocumentTextContinuation, EvidenceIndex, EvidenceSource, IndexEntry, MunicipalityEvidence, OfficialLink } from '@/types/evaluationEvidence';
import { MunicipalityEvaluations } from './NormalizedEvaluationDetails';

type Loader = ReturnType<typeof createEvidenceLoader>;
type CombinedIndex = EvidenceIndex & { prefectureCount: number };
/** 都道府県（47）と市区町村（1,741）の一覧をまとめる。都道府県の一覧が読めなくても市区町村は表示する */
async function loadCombinedIndex(signal: AbortSignal): Promise<CombinedIndex> {
  const [municipal, prefecture] = await Promise.all([
    loadEvidenceIndex(signal),
    loadEvidenceIndex(signal, fetch, 'prefecture').catch((error) => { if (signal.aborted) throw error; return null; }),
  ]);
  return { ...municipal, municipalities: [...(prefecture?.municipalities ?? []), ...municipal.municipalities], prefectureCount: prefecture?.municipalities.length ?? 0 };
}
const PREFECTURES_ONLY = 'prefectures';
const PAGE_SIZE = 24;
const sourceLinkLabel = (source: EvidenceSource) => source.acquisition.method === 'archive_member' && source.verification.status === 'verified' ? '公式のZIPファイル（格納元）' : source.verification.status === 'verified' ? '公式の原資料' : '候補URL（未検証）';

function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  const href = safeEvidenceUrl(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}<span aria-label="新しいタブで開く"> ↗</span></a> : <span>{children}（リンクを確認できません）</span>;
}
function IntegrityNote({ integrity }: { integrity: LoadedEvidence<unknown>['integrity'] }) {
  return integrity === 'sha256_unavailable' ? <p className="evaluation-warning-list" role="status">このブラウザではSHA-256を検証できません。バイト数・自治体・資料ID・形式の一致は確認しています。</p> : null;
}
function Failure({ message, retry, label = '再読み込み' }: { message: string; retry: () => void; label?: string }) {
  return <div className="evaluation-state evaluation-state-error" role="alert"><h3>読み込めませんでした</h3><p>{message}</p><p>読み込みの失敗は、資料の未公開を意味しません。原資料のリンクはそのまま確認できます。</p><button className="evaluation-button" onClick={retry}>{label}</button></div>;
}
function OfficialLinks({ homepage, fallback }: { homepage: OfficialLink | null; fallback: OfficialLink | null }) {
  const links = [homepage, fallback].filter((link, i, all): link is OfficialLink => Boolean(link) && all.findIndex((other) => other?.url === link?.url) === i);
  return links.length ? <div className="evaluation-official-links"><p className="evaluation-label">公式サイトから探す</p><div className="evaluation-inline-links">{links.map((link) => <SourceLink key={link.url} url={link.url}>{link.title}（{link.kind === 'official_homepage' ? '公式ホームページ' : '公式の自治体案内'}）</SourceLink>)}</div><p className="evaluation-muted">これは公式サイトへの案内です。評価資料の発見・公開を確認したリンクとは区別しています。</p></div> : <p className="evaluation-muted">確認済みの公式ホームページ・自治体案内リンクは、この記録にはありません。</p>;
}
function YearLabels({ source, detailed = false }: { source: EvidenceSource; detailed?: boolean }) {
  if (!source.years.length && source.navigationReview?.yearNotes) return <p className="evaluation-muted">出典確認時の年度メモ：{source.navigationReview.yearNotes}{source.navigationReview.rawArchiveState === 'collected' ? '（確認時のメモ。本文の該当箇所とは照合していません）' : '（原本の該当箇所は未保存）'}</p>;
  return source.years.length ? <ul className="evaluation-year-list">{source.years.map((year, i) => <li key={i}><strong>{year.label}</strong> · {YEAR_LABELS[year.meaning]}{detailed && <p className="evaluation-muted">根拠（{year.basis === 'printed_text' ? '本文' : year.basis === 'official_link_label' ? '公式リンク表記' : '資料タイトル'}）：{year.quote}</p>}</li>)}</ul> : <p className="evaluation-muted">年度不明（根拠となる年度表記を未確認）</p>;
}

function AcquiredText({ code, source, loader }: { code: string; source: EvidenceSource; loader: Loader }) {
  const [load, setLoad] = useState<EvaluationLoadState<LoadedEvidence<DocumentText>>>({ status: 'loading' });
  const [request] = useState(() => createEvaluationRequest<LoadedEvidence<DocumentText>>());
  const [retry, setRetry] = useState(0);
  const [parts, setParts] = useState<DocumentTextContinuation[]>([]);
  const [partLoad, setPartLoad] = useState<{ status: 'idle' | 'loading' } | { status: 'error'; message: string }>({ status: 'idle' });
  const [partRequest] = useState(() => createEvaluationRequest<LoadedEvidence<DocumentTextContinuation>>());
  const cancelPart = useRef<(() => void) | null>(null);
  useEffect(() => request.run((signal) => loader.loadText(code, source, signal, retry > 0), setLoad), [code, source, loader, request, retry]);
  useEffect(() => () => cancelPart.current?.(), []);
  const document = load.status === 'ready' ? load.value.data : null;
  const total = source.text.continuations ?? [];
  const next = total[parts.length];
  const loadNext = (reload: boolean) => {
    if (!next) return;
    const part = next.part;
    cancelPart.current = partRequest.run((signal) => loader.loadTextContinuation(code, source, part, signal, reload), (state) => {
      if (state.status !== 'ready') { setPartLoad(state.status === 'error' ? state : { status: 'loading' }); return; }
      setParts((loaded) => loaded.length === part - 2 ? [...loaded, state.value.data] : loaded);
      setPartLoad({ status: 'idle' });
    });
  };
  const more = next && <div className="evaluation-text-continuation">
    {partLoad.status === 'loading' && <p role="status">第{next.part}部のテキストを読み込んでいます…</p>}
    {partLoad.status === 'error' ? <Failure message={partLoad.message} retry={() => loadNext(true)} label={`第${next.part}部を再読み込み`} />
      : <button className="evaluation-button" disabled={!document || partLoad.status === 'loading'} onClick={() => loadNext(false)}>続きを読み込む（第{next.part}部／全{total.length + 1}部、全{source.text.characters.toLocaleString()}文字）</button>}
    {!document && <p className="evaluation-muted">第1部の読み込み後に、続きを読み込めます。</p>}
  </div>;
  return <section className="evaluation-text-reader" aria-label="取得テキストの閲覧と検索">
    <h4>取得テキスト（未構造化）</h4>
    <p className="evaluation-muted">原資料から文字を抽出できた範囲のみを表示します。画像内の文字や図表は欠落する場合があります。表の列順や改行は原資料と異なることがあります。金額・指標・評価としての構造化や検証を保証しません。</p>
    {source.role === 'evaluation_landing_page' && <p className="evaluation-warning-list">これは案内・索引ページのテキストです。リンク先の評価報告書の本文ではありません。</p>}
    {load.status === 'loading' && <p role="status">この資料のテキストを読み込んでいます…</p>}
    {load.status === 'error' && <Failure message={load.message} retry={() => setRetry((v) => v + 1)} label="テキストを再読み込み" />}
    {document && load.status === 'ready' ? <EvidenceDocumentText document={document} integrity={load.value.integrity} continuations={parts} totalParts={total.length + 1}>{more}</EvidenceDocumentText> : more}
  </section>;
}

/** Plain-text presentation is kept independent of fetching for deterministic rendering tests. */
export function EvidenceDocumentText({ document, integrity, continuations = [], totalParts = 1, children }: { document: DocumentText; integrity: LoadedEvidence<unknown>['integrity']; continuations?: DocumentTextContinuation[]; totalParts?: number; children?: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const text = useMemo(() => document.text + continuations.map((part) => part.text).join(''), [document.text, continuations]);
  const matches = useMemo(() => findTextMatches(text, query), [text, query]);
  const split = totalParts > 1;
  const loadedParts = 1 + continuations.length;
  const complete = split ? loadedParts >= totalParts : !document.truncated;
  const loadedCharacters = document.exportedCharacters + continuations.reduce((sum, part) => sum + part.exportedCharacters, 0);
  return <>
      <IntegrityNote integrity={integrity} />
      {split
        ? <p className={complete ? 'evaluation-muted' : 'evaluation-warning-list'}>全文{document.characters.toLocaleString()}文字を{totalParts}部に分けて配信。第{loadedParts}部まで読み込み済み（{loadedCharacters.toLocaleString()}文字）。{complete ? '全文を読み込みました。' : '続きは本文の下の「続きを読み込む」で読み込めます。'}</p>
        : <p className={document.truncated ? 'evaluation-warning-list' : 'evaluation-muted'}>{document.exportedCharacters.toLocaleString()}文字を収録{document.truncated ? `（抽出全${document.characters.toLocaleString()}文字の一部）。配信上限による省略があります。続きは原資料で確認してください。` : '。'}</p>}
      <label className="evaluation-text-search">この資料の取得テキスト内を検索<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：子育て、評価、実績" /></label>
      {split && <p className="evaluation-muted">読み込み済みの範囲を検索しています（第1〜{loadedParts}部）。{!complete && '未読み込みの部分は検索しません。'}</p>}
      {query.trim() && <div className="evaluation-text-matches" role="status"><p>{matches.count.toLocaleString()}箇所が一致{matches.count > matches.snippets.length && `（先頭${matches.snippets.length}箇所を表示）`}。{split ? !complete && '読み込み済みの範囲だけを検索しています。' : document.truncated && '省略された範囲は検索しません。'}</p><ol>{matches.snippets.map((snippet, i) => <li key={i}>{snippet}</li>)}</ol></div>}
      <pre className="evaluation-raw-text evaluation-document-text" tabIndex={0} aria-label="取得テキスト">{text}</pre>
      {children}
      <p className="evaluation-muted">この画面の検索対象は、選択した資料の配信済みテキストだけです。</p>
  </>;
}

export function SourceDetail({ code, source, loader }: { code: string; source: EvidenceSource; loader: Loader }) {
  useEffect(() => { const heading = document.getElementById('evaluation-source-title'); heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start' }); }, [source.id]);
  return <article className="evaluation-source-detail" aria-labelledby="evaluation-source-title">
    <div className="evaluation-section-heading"><h3 id="evaluation-source-title" tabIndex={-1}>{source.title}</h3><Link href={evidenceHref(code)} scroll={false}>資料の選択を解除</Link></div>
    <p className="evaluation-source-meta"><span className="evaluation-badge">{ROLE_LABELS[source.role]}</span><span>{source.format.toUpperCase()}</span><span>{EVALUATION_TYPE_LABELS[source.evaluationType]}</span><span>{sourceAcquisitionLabel(source)}</span></p>
    <p><SourceLink url={source.url}>{sourceLinkLabel(source)}</SourceLink></p>
    {source.navigationReview && <aside className="evaluation-notice">
      <p>{source.navigationReview.method === 'official_body_review' ? '公式ページの本文・リンクを確認した追加出典です。' : '検索で見つかった候補です。公式出典との関係や内容の確認は完了していません。'} {source.navigationReview.rawArchiveState === 'collected' ? '原本ファイルは後日の収集で公式URLから保存しました。下の本文はその原本から抽出したものです。' : '原本ファイルと本文テキストは、このアプリにはまだ保存していません。'}</p>
      <p>公開主体：{source.navigationReview.publisher} ／ 確認：{formatEvaluationTimestamp(source.navigationReview.checkedAt)}</p>
      {source.navigationReview.notes && <p>{source.navigationReview.notes}</p>}
      <p><SourceLink url={source.navigationReview.evidenceUrl}>確認に使ったページ・資料</SourceLink>{source.navigationReview.originEvidenceUrl && <> ／ <SourceLink url={source.navigationReview.originEvidenceUrl}>公式サイトからの参照元</SourceLink></>}</p>
    </aside>}
    {source.acquisition.method === 'archive_member' && <p className="evaluation-notice">ZIP内の資料：{source.acquisition.memberPath}。原資料リンクはZIP格納元を開きます。表示テキストと原資料SHA-256は格納元ZIPではなく、この内部資料のものです。</p>}
    {source.acquisition.inputStatus === 'unsupported' && <p className="evaluation-warning-list">元の収集・内容確認では未対応・保留として記録されています。保存できた原資料と読めるテキストは、その状態と分けて表示しています。</p>}
    <YearLabels source={source} detailed />
    <p className="evaluation-muted">年度は資料の記載に基づきます。URL・ファイル更新日から評価年度や評価対象年度を推定していません。</p>
    <details className="evaluation-evidence"><summary>出典・確認根拠を表示</summary><div className="evaluation-evidence-body">
      <dl className="evaluation-provenance"><div><dt>確認状態</dt><dd>{source.verification.status === 'verified' ? '公式資料として確認済み' : source.verification.status === 'official_host_only' ? '公式ホストのみ確認済み・資料の関連性は未確認' : '未検証'}</dd></div><div><dt>評価との関連</dt><dd>{source.verification.evaluationRelevance === 'verified' ? '確認済み' : '未確認'}</dd></div><div><dt>取得日時</dt><dd>{source.acquisition.fetchedAt ? formatEvaluationTimestamp(source.acquisition.fetchedAt) : '未取得・未記録'}</dd></div><div><dt>収集時の記録</dt><dd>{DISCOVERY_LABELS[source.acquisition.inputStatus]}</dd></div><div><dt>HTTP</dt><dd>{source.acquisition.httpStatus ?? '未記録'}</dd></div><div className="evaluation-wide"><dt>原資料URL</dt><dd><SourceLink url={source.url}>{source.url}</SourceLink></dd></div><div className="evaluation-wide"><dt>取得原資料 SHA-256</dt><dd className="evaluation-hash">{source.acquisition.sourceSha256 ?? '未取得・未記録'}</dd></div><div className="evaluation-wide"><dt>ZIP格納元 SHA-256</dt><dd className="evaluation-hash">{source.acquisition.containerSha256 ?? '該当なし'}</dd></div><div className="evaluation-wide"><dt>配信テキスト SHA-256</dt><dd className="evaluation-hash">{source.text.textSha256 ?? '未取得・未記録'}</dd></div><div className="evaluation-wide"><dt>確認根拠</dt><dd>{source.verification.basis.join(' ／ ') || '未記録'}</dd></div></dl>
      <p className="evaluation-muted">タイトルの由来：{source.titleBasis === 'html_title' ? '公式HTMLのタイトル' : source.titleBasis === 'official_link_label' ? '公式ページのリンク表記' : source.titleBasis === 'source_filename' ? 'ファイル名（内容未要約）' : '収集時の資料名'}</p>
    </div></details>
    {source.text.status === 'available' ? <AcquiredText code={code} source={source} loader={loader} /> : <div className="evaluation-state"><h4>{TEXT_LABELS[source.text.status]}</h4><p>この画面で読めるテキストはまだありません。資料そのものの存在・公開状況や、自治体の評価内容を示すものではありません。</p></div>}
  </article>;
}

function MunicipalitySources({ entry, sourceId, loader }: { entry: IndexEntry; sourceId: string; loader: Loader }) {
  const [load, setLoad] = useState<EvaluationLoadState<LoadedEvidence<MunicipalityEvidence>>>({ status: 'loading' });
  const [request] = useState(() => createEvaluationRequest<LoadedEvidence<MunicipalityEvidence>>());
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [onlyText, setOnlyText] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  useEffect(() => request.run((signal) => loader.loadMunicipality(entry, signal, retry > 0), setLoad), [entry, loader, request, retry]);
  useEffect(() => setLimit(PAGE_SIZE), [query, onlyText]);
  const data = load.status === 'ready' ? load.value.data : null;
  const selectedSource = data?.sources.find((source) => source.id === sourceId);
  const matches = useMemo(() => (data?.sources ?? []).filter((source) => (!onlyText || source.text.status === 'available') && `${source.title} ${source.format} ${source.years.map((year) => year.label).join(' ')}`.normalize('NFKC').toLowerCase().includes(query.normalize('NFKC').trim().toLowerCase())), [data, query, onlyText]);
  return <>
    <OfficialLinks homepage={entry.officialHomepage} fallback={entry.officialFallback} />
    {load.status === 'loading' && <div className="evaluation-state" role="status">{entry.municipalityName} の資料一覧を読み込んでいます…</div>}
    {load.status === 'error' && <Failure message={load.message} retry={() => setRetry((v) => v + 1)} label="資料一覧を再読み込み" />}
    {data && <>
      <IntegrityNote integrity={load.status === 'ready' ? load.value.integrity : 'sha256_unavailable'} />
      {isPrefectureEvaluationCode(entry.municipalityCode) ? <div className="evaluation-discovery"><p><strong>都道府県の評価資料の探索（2026年10月）</strong></p><p className="evaluation-muted">都道府県の公式ページに掲載された評価資料のリンクを確認し、原資料を保存しました。事務事業評価がない都道府県では、施策評価や「主要施策の成果」など、事業ごとの実績・金額が分かる公式資料を載せています。全資料の網羅は未確認で、資料区分は探索時の判断です。</p></div> : <div className="evaluation-discovery"><p><strong>旧収集台帳の探索記録：{DISCOVERY_LABELS[data.discovery.status]}</strong> ／ 検索試行の記録 {data.discovery.searchAttemptsCount.toLocaleString()}回</p><p className="evaluation-muted">全事業に対する収録割合・最新年度の網羅性は未確認です。{data.discovery.status === 'searched_not_found' ? '限られた検索条件で見つからなかった記録です。資料の未公開とは判断していません。' : data.discovery.status === 'blocked' ? '取得時にアクセス制約がありました。未対応形式や未公開とは区別しています。' : data.discovery.status === 'unsupported' ? '取得・内容確認に未対応・保留の記録があります。アクセス制約や未公開とは区別しています。' : ''}</p>{data.discovery.omittedRejectedSources > 0 && <p className="evaluation-warning-text">他自治体など出典が一致しない候補 {data.discovery.omittedRejectedSources.toLocaleString()}件を除外しています。旧台帳の取得記録があっても、この自治体の資料として確認できないものは表示しません。</p>}</div>}
      {data.evaluationPages.length > 0 && <section className="evaluation-entrypoints"><h3>確認済みの評価案内・索引</h3><p className="evaluation-muted">各自治体が公開する評価資料への入口です。案内ページの件数を評価報告書の件数とは数えません。</p><ul>{data.evaluationPages.map((id) => { const source = data.sources.find((item) => item.id === id)!; return <li key={id}><SourceLink url={source.url}>{source.title}</SourceLink></li>; })}</ul></section>}
      {sourceId && (selectedSource ? <SourceDetail key={`${entry.municipalityCode}:${selectedSource.id}:${selectedSource.text.assetSha256}`} code={entry.municipalityCode} source={selectedSource} loader={loader} /> : <div className="evaluation-state" role="alert"><h3>この資料IDは選択中の自治体の一覧にありません</h3><p>別の自治体の資料は読み込みません。資料一覧から選び直してください。</p><Link href={evidenceHref(entry.municipalityCode)} scroll={false}>資料の選択を解除</Link></div>)}
      <section className="evaluation-source-browser" aria-label="資料一覧">
        <div className="evaluation-section-heading"><h3>資料・ページを選ぶ</h3><p>{entry.substantiveTextDocumentCount.toLocaleString()}件の評価資料本文 ／ {Math.max(0, entry.textDocumentCount - entry.substantiveTextDocumentCount).toLocaleString()}件のその他の公式テキスト</p></div>
        <form className="evaluation-filters evaluation-source-filters" role="search" aria-label="選択中の自治体の資料名を検索" onSubmit={(e) => e.preventDefault()}><label>資料名・記載年・形式<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：令和、2024、PDF" /></label><label className="evaluation-checkbox"><input type="checkbox" checked={onlyText} onChange={(e) => setOnlyText(e.target.checked)} />取得テキストがある資料のみ</label><p className="evaluation-filter-help">資料名の検索です。本文を検索するには、資料を選んで「取得テキスト内を検索」を使ってください。</p></form>
        <p className="evaluation-directory-count" role="status">{matches.length.toLocaleString()}件{matches.length > limit && `中 ${limit}件を表示`}</p>
        {!matches.length && <div className="evaluation-state"><h4>{data.sources.length ? '条件に一致する資料がありません' : '表示できる資料の記録はありません'}</h4><p>評価の未実施・未公開とは判断していません。上の探索状況と公式サイト案内を確認してください。</p>{(query || onlyText) && <button className="evaluation-text-button" onClick={() => { setQuery(''); setOnlyText(false); }}>資料の条件をリセット</button>}</div>}
        <div className="evaluation-source-list">{matches.slice(0, limit).map((source) => <article key={source.id} className={`evaluation-source-card${source.id === sourceId ? ' evaluation-source-card-selected' : ''}`}>
          <div className="evaluation-card-title"><h4><Link href={evidenceHref(entry.municipalityCode, source.id)} scroll={false} aria-current={source.id === sourceId ? 'true' : undefined}>{source.title}</Link></h4><span className="evaluation-badge">{ROLE_LABELS[source.role]}</span></div>
          <p className="evaluation-source-meta"><span>{source.format.toUpperCase()}</span><span>{EVALUATION_TYPE_LABELS[source.evaluationType]}</span><span>{sourceAcquisitionLabel(source)}</span><span className={`evaluation-badge${source.text.status === 'available' ? ' evaluation-badge-ok' : ''}`}>{TEXT_LABELS[source.text.status]}</span>{source.text.truncated && <span className="evaluation-badge evaluation-badge-partial">{source.text.continuations ? `全文を${source.text.continuations.length + 1}部に分けて配信` : 'テキストは一部省略'}</span>}</p>
          <YearLabels source={source} />
          {source.verification.status !== 'verified' && <p className="evaluation-warning-text">{source.verification.status === 'official_host_only' ? '公式ホストのみ確認済み。評価資料としての関連性は未確認です。' : '出典・関連性の確認待ち候補です。'}</p>}
          {source.text.preview && <p className="evaluation-source-preview">{source.text.preview}</p>}
          <div className="evaluation-inline-links"><Link href={evidenceHref(entry.municipalityCode, source.id)} scroll={false}>{source.text.status === 'available' ? '取得テキストを読む・検索' : '資料の確認状況を見る'}</Link><SourceLink url={source.url}>{sourceLinkLabel(source)}</SourceLink></div>
        </article>)}</div>
        {matches.length > limit && <button className="evaluation-button evaluation-more" onClick={() => setLimit((v) => v + PAGE_SIZE)}>次の{Math.min(PAGE_SIZE, matches.length - limit)}件の資料を表示</button>}
      </section>
    </>}
  </>;
}

function NormalizedView({ entry }: { entry: IndexEntry }) {
  const [load, setLoad] = useState<EvaluationLoadState<EvaluationIndex>>({ status: 'loading' });
  const [request] = useState(() => createEvaluationRequest<EvaluationIndex>());
  const [loader] = useState(() => createEvaluationShardLoader());
  const [retry, setRetry] = useState(0);
  const scope = isPrefectureEvaluationCode(entry.municipalityCode) ? 'prefecture' as const : 'municipal' as const;
  useEffect(() => request.run((signal) => loadEvaluationIndex(signal, fetch, scope), setLoad), [request, retry, scope]);
  const normalized = load.status === 'ready' ? load.value.municipalities.find((item) => item.municipalityCode === entry.municipalityCode) : null;
  const refresh = () => { loader.clear(); setRetry((v) => v + 1); };
  return <>
    <p className="evaluation-notice">整理済み事業票は、取得資料の一部から目的・成果・コスト等を抽出したものです。資料・テキストの閲覧可否とは別の収録範囲です。予算マップと金額を合算しません。</p>
    {load.status === 'loading' && <p role="status">整理済み事業票の収録状況を読み込んでいます…</p>}
    {load.status === 'error' && <Failure message={load.message} retry={refresh} />}
    {load.status === 'ready' && <p className="evaluation-muted">整理済み事業票：全国{load.value.primaryMunicipalities.toLocaleString()}自治体・{load.value.primaryEvaluationRecords.toLocaleString()}年度別レコード。同一事業の複数年度の記録を含み、異なる年度を通じた一意の事業数ではありません。資料全体の網羅も示しません。</p>}
    {normalized?.dataStatus === 'primary_available' ? <MunicipalityEvaluations entry={normalized} loader={loader} refreshIndex={refresh} /> : load.status === 'ready' && <div className="evaluation-state"><h3>この自治体の整理済み事業票は未収録です</h3><p>原資料や未構造化の取得テキストが読める場合があります。「資料・取得テキスト」で確認してください。</p>{normalized?.historicalEvaluationRecords ? <p>過去資料の記録が別管理で{normalized.historicalEvaluationRecords.toLocaleString()}件あります。ここでは事業票として表示していません。</p> : null}<Link href={evidenceHref(entry.municipalityCode)} scroll={false}>資料・取得テキストへ戻る</Link></div>}
  </>;
}

export function EvaluationBrowser() {
  const router = useRouter();
  const selection = readEvidenceSelection(useSearchParams());
  const { municipality, source, view } = selection;
  const scrollToSelection = useRef(false);
  const [query, setQuery] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [retry, setRetry] = useState(0);
  const [load, setLoad] = useState<EvaluationLoadState<CombinedIndex>>({ status: 'loading' });
  const [request] = useState(() => createEvaluationRequest<CombinedIndex>());
  const [loader] = useState(() => createEvidenceLoader());
  useEffect(() => request.run(loadCombinedIndex, setLoad), [request, retry]);
  useEffect(() => setLimit(PAGE_SIZE), [query, prefecture, status]);
  const index = load.status === 'ready' ? load.value : null;
  const selected = index?.municipalities.find((entry) => entry.municipalityCode === municipality);
  const matches = useMemo(() => {
    const entries = index?.municipalities ?? [];
    return prefecture === PREFECTURES_ONLY
      ? searchEvidenceMunicipalities(entries.filter((e) => isPrefectureEvaluationCode(e.municipalityCode)), query, '', status)
      : searchEvidenceMunicipalities(entries, query, prefecture, status);
  }, [index, query, prefecture, status]);
  const scopeLabel = index?.prefectureCount ? `${index.prefectureCount}都道府県・1,741市区町村` : '1,741自治体';
  const prefectures = useMemo(() => Array.from(new Map(index?.municipalities.map((entry) => [entry.prefectureCode, entry.prefectureName])).entries()).sort(([a], [b]) => a.localeCompare(b)), [index]);
  useEffect(() => {
    if (scrollToSelection.current && selected) {
      scrollToSelection.current = false;
      const heading = document.getElementById('evaluation-selected-title');
      heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start' });
    }
  }, [municipality, selected]);
  useEffect(() => {
    if (source) {
      const heading = document.getElementById('evaluation-source-title');
      heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start' });
    }
  }, [source]);
  const selectMunicipality = (code: string) => {
    if (code !== municipality || source || view !== 'sources') { scrollToSelection.current = Boolean(code); router.push(evidenceHref(code), { scroll: false }); }
    else { const heading = document.getElementById('evaluation-selected-title'); heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: 'start' }); }
  };
  const refresh = () => { loader.clear(); setRetry((v) => v + 1); };
  const reset = () => { setQuery(''); setPrefecture(''); setStatus(''); };
  return <main className="evaluation-page"><div className="evaluation-content">
    <header className="evaluation-header"><Link className="evaluation-back" href="/">← 地方自治体予算マップ</Link><p className="evaluation-eyebrow">全国の自治体を、原資料から</p><h1>事務事業評価を読む</h1><p>47都道府県・1,741市区町村から探して、公式の評価ページ・資料・取得テキストへ。整理済み事業票も、対応する自治体で確認できます。</p></header>
    <aside className="evaluation-notice" aria-label="収録範囲の読み方"><h2>自治体一覧は全国。資料の発見・取得・構造化はそれぞれ一部です</h2><p>47都道府県・1,741市区町村すべてを選べますが、全自治体の評価資料や最新年度の収録完了を意味しません。案内ページ、評価資料、未構造化テキスト、整理済み事業票を区別しています。施策・施設・教育委員会の点検なども含み、資料ごとに評価区分を表示します。</p><p>資料が見つからない・取得できない状態から、評価の未実施や未公開とは判断しません。評価尺度は自治体ごとの表記を尊重し、成績順位や財政マップとの金額合算は行いません。</p></aside>
    {load.status === 'loading' && <div className="evaluation-state" role="status">全国の自治体の資料案内を読み込んでいます…</div>}
    {load.status === 'error' && <Failure message={load.message} retry={refresh} label="全国一覧を再読み込み" />}
    {index && <>
      <section className="evaluation-overview" aria-label="範囲を分けた収録状況"><dl><div><dt>選択できる自治体</dt><dd>{index.municipalities.length.toLocaleString()}<small>{scopeLabel}</small></dd></div><div><dt>評価案内ページ確認済み</dt><dd>{index.municipalities.filter((e) => e.evaluationPageCount > 0).length.toLocaleString()}<small>自治体</small></dd></div><div><dt>評価資料の本文テキストあり</dt><dd>{index.municipalities.filter((e) => e.substantiveTextDocumentCount > 0).length.toLocaleString()}<small>自治体</small></dd></div><div><dt>公式資料の本文を読める</dt><dd>{index.municipalities.filter((e) => e.textDocumentCount > 0).length.toLocaleString()}<small>自治体</small></dd></div></dl><p className="evaluation-muted">上記の範囲は重複します。合計しません。本文の数字や表の構造化が未対応でも、読める取得テキストは表示します。資料一覧・本文は選んだものだけを読み込みます。</p></section>
      <section className="evaluation-directory" aria-labelledby="evaluation-directory-title"><h2 id="evaluation-directory-title">1. 自治体を探す</h2><form className="evaluation-filters evaluation-directory-filters" role="search" aria-label="自治体名・都道府県・コードで検索" onSubmit={(e) => e.preventDefault()}><label className="evaluation-query">自治体名・都道府県・自治体コード<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例：東京都 府中市、北海道 伊達市、13206" /></label><label>都道府県<select value={prefecture} onChange={(e) => setPrefecture(e.target.value)}><option value="">すべての都道府県</option>{index.prefectureCount > 0 && <option value={PREFECTURES_ONLY}>都道府県の評価（県庁・都庁など）</option>}{prefectures.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label>資料の確認状況<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">すべての{scopeLabel}</option>{Object.entries(EVIDENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><p className="evaluation-filter-help">同じ名前の自治体は都道府県やコードで区別できます。事業名・本文は、自治体と資料を選んだあとに検索できます。</p></form>
        <p className="evaluation-directory-count" role="status" aria-live="polite">{matches.length.toLocaleString()}自治体{matches.length > limit && `中 ${limit}自治体を表示`}</p>
        {!matches.length && <div className="evaluation-state"><h3>条件に一致する自治体がありません</h3><button className="evaluation-text-button" onClick={reset}>一覧の条件をリセット</button></div>}
        <div className="evaluation-municipality-grid">{matches.slice(0, limit).map((entry) => <button type="button" className="evaluation-municipality-choice" key={entry.municipalityCode} aria-pressed={entry.municipalityCode === municipality} onClick={() => selectMunicipality(entry.municipalityCode)}><strong>{entry.municipalityName}</strong><span className="evaluation-muted">{entry.municipalityCode}</span><span className="evaluation-muted">{isPrefectureEvaluationCode(entry.municipalityCode) ? '都道府県（県庁・都庁など）' : entry.prefectureName}</span><span className={`evaluation-badge${entry.textDocumentCount > 0 ? ' evaluation-badge-ok' : ''}`}>{EVIDENCE_LABELS[entry.evidenceStatus]}</span><span className="evaluation-muted">{entry.substantiveTextDocumentCount ? `資料本文 ${entry.substantiveTextDocumentCount.toLocaleString()}件` : entry.textDocumentCount ? 'その他の公式資料テキストあり' : DISCOVERY_LABELS[entry.discoveryStatus]}</span></button>)}</div>
        {matches.length > limit && <button className="evaluation-button evaluation-more" onClick={() => setLimit((v) => v + PAGE_SIZE)}>次の{Math.min(PAGE_SIZE, matches.length - limit)}自治体を表示</button>}
      </section>
      <section className="evaluation-selected" aria-labelledby="evaluation-selected-title"><div className="evaluation-section-heading"><h2 id="evaluation-selected-title" tabIndex={-1}>2. {selected ? `${isPrefectureEvaluationCode(selected.municipalityCode) ? selected.municipalityName : `${selected.prefectureName} ${selected.municipalityName}`} の資料` : '自治体の資料を読む'}</h2>{municipality && <button className="evaluation-text-button" onClick={() => selectMunicipality('')}>自治体の選択を解除</button>}</div>
        {!municipality ? <div className="evaluation-state"><h3>上の一覧から自治体を選んでください</h3><p>資料名・出典・年度の意味・取得状況を確認できます。整理済み事業票がなくても自治体を選べます。</p></div> : !selected ? <div className="evaluation-state" role="alert"><h3>この自治体コードは一覧にありません</h3><p>コード {municipality} は対象一覧で確認できません。一覧から選び直してください。</p></div> : <>
          <div className="evaluation-selected-summary"><span className="evaluation-badge">{EVIDENCE_LABELS[selected.evidenceStatus]}</span><p className="evaluation-muted">自治体コード {selected.municipalityCode} ／ 全事業の網羅性：未確認</p><Link href={evidenceHref(selected.municipalityCode, source, view)}>この表示へのリンク</Link></div>
          <nav className="evaluation-view-nav" aria-label="自治体資料の表示切り替え"><Link href={evidenceHref(selected.municipalityCode)} scroll={false} aria-current={view === 'sources' ? 'page' : undefined}>資料・取得テキスト</Link><Link href={evidenceHref(selected.municipalityCode, '', 'normalized')} scroll={false} aria-current={view === 'normalized' ? 'page' : undefined}>整理済み事業票</Link></nav>
          {view === 'sources' ? <MunicipalitySources key={`${selected.municipalityCode}:${selected.shardSha256}`} entry={selected} sourceId={source} loader={loader} /> : <NormalizedView key={selected.municipalityCode} entry={selected} />}
        </>}
      </section>
      <footer className="evaluation-footer"><p>出典：各自治体の公開資料・確認済みの公式案内。現在の公開状態を保証するものではありません。</p><p>資料案内のスナップショット：{formatEvaluationTimestamp(index.snapshotAt)}</p><button className="evaluation-text-button" onClick={refresh}>全国一覧から再読み込み</button></footer>
    </>}
  </div></main>;
}
