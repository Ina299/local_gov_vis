import type { DiscoveryStatus, EvidenceSource, EvidenceStatus, IndexEntry, YearEvidence } from '@/types/evaluationEvidence';

export const DISCOVERY_LABELS: Record<DiscoveryStatus, string> = {
  not_searched: '探索未実施', searched_not_found: '今回の検索では見つからず',
  discovered: '資料候補を発見', fetched: '旧台帳に取得の記録あり', structured: '旧台帳に構造化の記録あり',
  blocked: '取得時のアクセス制約あり', unsupported: '取得・内容確認で保留',
};
export const EVIDENCE_LABELS: Record<EvidenceStatus, string> = {
  text_available: '取得テキストあり', sources_available: '確認済み資料リンクあり',
  official_fallback_only: '公式サイト案内あり', no_verified_sources: '確認済み資料なし',
};
export const ROLE_LABELS: Record<EvidenceSource['role'], string> = {
  evaluation_landing_page: '評価の案内・索引ページ', evaluation_document: '評価資料',
  supporting_document: '関連資料', official_page: '公式ページ（評価資料か未確認）', candidate: '確認待ちの候補',
};
export const EVALUATION_TYPE_LABELS: Record<EvidenceSource['evaluationType'], string> = {
  business_project_evaluation: '事務事業評価', policy_evaluation: '施策・政策評価', facility_evaluation: '施設・指定管理評価',
  education_inspection: '教育委員会の点検評価', mixed_evaluation: '複数の評価区分', unknown: '評価区分未確認',
  grant_project_evaluation: '交付金・補助事業の評価', administrative_reform: '行政改革の実績',
  project_activity_report: '事業活動の報告', sector_evaluation: '特定分野の評価',
};
export const ACQUISITION_LABELS: Record<EvidenceSource['acquisition']['state'], string> = {
  acquired: '原資料取得済み', blocked: 'アクセス制約', failed: '取得失敗', discovered: '未取得',
  cache_missing: '保存原資料なし', hash_mismatch: '原資料のハッシュ不一致', format_integrity_hold: '形式確認のため保留',
};
export function sourceAcquisitionLabel(source: EvidenceSource): string {
  const acquisition = source.acquisition;
  if (acquisition.state === 'acquired' && acquisition.httpStatus !== null && acquisition.httpStatus >= 400) {
    return `エラー応答を保存（HTTP ${acquisition.httpStatus}・資料の取得は未確認）`;
  }
  if (acquisition.state === 'acquired' && acquisition.inputStatus === 'blocked') {
    return '制限応答を保存・資料の取得は未確認';
  }
  return ACQUISITION_LABELS[acquisition.state];
}
export const TEXT_LABELS: Record<EvidenceSource['text']['status'], string> = {
  available: '取得テキストあり', not_acquired: '原資料未取得', not_extracted: 'テキスト未抽出',
  no_readable_text: '読み取り可能なテキストなし', verification_pending: '出典確認待ち',
  format_integrity_hold: '形式確認のため保留', sanitization_hold: 'テキスト確認のため保留',
};
export const YEAR_LABELS: Record<YearEvidence['meaning'], string> = {
  evaluation_year: '評価年度（資料表記）', fiscal_year_mentioned: '資料に記載の年度（対象年度とは限らない）',
  calendar_year_mentioned: '資料に記載の暦年', unknown: '年の意味は未確認',
};

export function safeEvidenceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ja-JP');
export function searchEvidenceMunicipalities(entries: IndexEntry[], query: string, prefecture = '', status = ''): IndexEntry[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => (!prefecture || entry.prefectureCode === prefecture)
    && (!status || entry.evidenceStatus === status)
    && terms.every((term) => normalize(`${entry.prefectureName} ${entry.municipalityName} ${entry.municipalityCode}`).includes(term)));
}

/** URL state is the only selection state, so Back/Forward restores city, source and view. */
export function readEvidenceSelection(params: Pick<URLSearchParams, 'get'>) {
  return { municipality: params.get('municipality') ?? '', source: params.get('source') ?? '',
    view: params.get('view') === 'normalized' ? 'normalized' as const : 'sources' as const };
}
export function evidenceHref(municipality: string, source = '', view: 'sources' | 'normalized' = 'sources'): string {
  if (!municipality) return '/evaluations/';
  const params = new URLSearchParams({ municipality });
  if (view === 'normalized') params.set('view', view);
  else if (source) params.set('source', source);
  return `/evaluations/?${params}`;
}

/** Literal text search only. Rendering remains React text; no HTML from a source is executed. */
export function findTextMatches(text: string, query: string, limit = 100): { count: number; snippets: string[] } {
  const needle = query.trim();
  if (!needle) return { count: 0, snippets: [] };
  const snippets: string[] = [];
  let count = 0;
  let from = 0;
  while (from < text.length) {
    const found = text.indexOf(needle, from);
    if (found === -1) break;
    count += 1;
    if (snippets.length < Math.max(0, Math.min(100, limit))) snippets.push(text.slice(Math.max(0, found - 70), Math.min(text.length, found + needle.length + 100)));
    from = found + needle.length;
  }
  return { count, snippets };
}
