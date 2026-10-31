'use client';

import { useEffect, useRef, useState } from 'react';
import { ProjectCostSankey } from './ProjectCostSankey';
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
 * 収支図の中から開く「事業コストの流れ」（モーダルの中のモーダル）。
 * 評価ページへ移らずに、その自治体の整理済み事業票を読み込んでサンキーだけを出す。
 * Escape・背景のクリックはこのモーダルだけを閉じ、下の収支図は開いたまま残す。
 */
export function EvaluationCostFlowModal({ code, name, coverage, onClose }: {
  /** 地図のコード（都道府県は 2 桁、市区町村は 5 桁） */
  code: string; name: string; coverage: CoverageEntry | undefined; onClose: () => void;
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

  // 収支図の Escape（document で受ける）より先に window の捕捉段階で受け、このモーダルだけを閉じる
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handle, true);
    return () => window.removeEventListener('keydown', handle, true);
  }, [onClose]);

  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  const pageUrl = dataUrl(evaluationEntryHref(code, coverage));

  return (
    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="modal modal-wide" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true"
        aria-label={`${name} 事業コストの流れ`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{name} 事務事業評価（事業コストの流れ）</h3>
          <div className="modal-head-actions">
            <a className="text-button" href={pageUrl}>事業票・資料を見る →</a>
            <button className="modal-close" onClick={onClose} aria-label="事業コストの流れを閉じる">×</button>
          </div>
        </div>
        {state.status === 'loading' && <p className="evaluation-muted">読み込み中…</p>}
        {state.status === 'error' && <p className="evaluation-muted">{state.message} <a href={pageUrl}>評価ページで確認する</a></p>}
        {state.status === 'ready' && (
          <ProjectCostSankey
            projects={state.value.dataset.projects}
            municipalityCode={evaluationCode}
            municipalityName={name}
            // 事業カードは評価ページにあるため、事業名で絞り込んだ評価ページへ移る
            onSelectProject={(project) => { window.location.href = `${dataUrl(`/evaluations/?municipality=${evaluationCode}&view=normalized`)}&q=${encodeURIComponent(project)}`; }}
          />
        )}
      </div>
    </div>
  );
}
