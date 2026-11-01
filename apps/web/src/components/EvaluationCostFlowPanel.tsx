'use client';

import { useEffect, useRef, useState } from 'react';
import { ProjectCostSankey } from './ProjectCostSankey';
import { ProjectCard } from './NormalizedEvaluationDetails';
import { dataUrl } from '@/lib/paths';
import { evaluationEntryHref, type CoverageEntry } from '@/lib/evaluationCoverage';
import { isPrefectureEvaluationCode } from '@/lib/evaluationEvidenceLoader';
import {
  createEvaluationRequest,
  createEvaluationShardLoader,
  loadEvaluationIndex,
  type EvaluationLoadState,
  type LoadedEvaluationShard,
} from '@/lib/evaluationLoader';

const loader = createEvaluationShardLoader();

/**
 * 収支図のタブ「事務事業評価」の中身。評価ページへ移らずに、その自治体の整理済み事業票を読み込んで
 * 事業コストの流れ（サンキー）を出す。事業を選ぶと、その事業の事業票（抽出した金額・指標・評価と原文の根拠）を図の下に出す。
 */
export function EvaluationCostFlowPanel({ code, name, coverage }: {
  /** 地図のコード（都道府県は 2 桁、市区町村は 5 桁） */
  code: string; name: string; coverage: CoverageEntry | undefined;
}) {
  const evaluationCode = code.length === 2 ? `${code}000` : code;
  const [state, setState] = useState<EvaluationLoadState<LoadedEvaluationShard>>({ status: 'loading' });
  useEffect(() => {
    const request = createEvaluationRequest<LoadedEvaluationShard>();
    return request.run(async (signal) => {
      const index = await loadEvaluationIndex(signal, fetch, isPrefectureEvaluationCode(evaluationCode) ? 'prefecture' : 'municipal');
      const entry = index.municipalities.find((m) => m.municipalityCode === evaluationCode && m.dataStatus === 'primary_available');
      if (!entry) throw new Error('この自治体の整理済み事業票が見つかりませんでした。');
      return loader.load(entry, signal);
    }, setState);
  }, [evaluationCode]);

  const pageUrl = dataUrl(evaluationEntryHref(code, coverage));
  // 図で選んだ事業（同じ事業名の年度別レコードをまとめて出す）
  const [selected, setSelected] = useState<string | null>(null);
  const cardsRef = useRef<HTMLElement>(null);
  useEffect(() => { if (selected) cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [selected]);
  const norm = (v: string) => v.normalize('NFKC').replace(/\s+/g, '');
  const cards = state.status === 'ready' && selected
    ? state.value.dataset.projects.filter((p) => norm(p.projectName) === norm(selected))
      .sort((a, b) => (b.evaluatedFiscalYear ?? b.evaluationYear ?? 0) - (a.evaluatedFiscalYear ?? a.evaluationYear ?? 0))
    : [];

  return (
    <div className="evaluation-cost-flow-panel">
      <p className="evaluation-panel-link">
        <a className="text-button" href={pageUrl} target="_blank" rel="noopener noreferrer">事業票・資料を評価ページで見る（新しいタブ）↗</a>
      </p>
      <p className="attribution">評価資料から読み取れた事業ごとの金額を部局別にたどる図です。収支図の款・項とは別の集計で、自動では対応付けません。</p>
      {state.status === 'loading' && <p className="evaluation-muted">読み込み中…</p>}
      {state.status === 'error' && <p className="evaluation-muted">{state.message} <a href={pageUrl} target="_blank" rel="noopener noreferrer">評価ページで確認する ↗</a></p>}
      {state.status === 'ready' && (
        <ProjectCostSankey
          projects={state.value.dataset.projects}
          municipalityCode={evaluationCode}
          municipalityName={name}
          onSelectProject={setSelected}
        />
      )}
      {selected && (
        <section ref={cardsRef} className="evaluation-results" aria-labelledby="cost-flow-selected-title">
          <div className="evaluation-section-heading">
            <h3 id="cost-flow-selected-title">{selected}</h3>
            <button type="button" className="text-button" onClick={() => setSelected(null)}>閉じる</button>
          </div>
          <p className="evaluation-muted">評価資料から抽出した内容です。金額・指標・評価には原文の該当箇所を添えています。{cards.length > 1 && `同じ事業名の${cards.length}件（年度・資料別）を表示しています。`}</p>
          {cards.map((project) => <ProjectCard key={project.id} project={project} defaultOpen />)}
        </section>
      )}
    </div>
  );
}
