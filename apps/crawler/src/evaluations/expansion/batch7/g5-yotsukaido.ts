import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

const HEADING = '令和８年度事務事業評価シート（令和７年度実施事業）';
const DOCUMENTS = new Set(['1a4f60afd1866b0d8b852dc3', '5dfb6669535ee77dc50e3665', '6870f3d83daeb1de63d73475', '80a30bfe4fb194031dfb5ea0', 'f8915c5aacfbf6bccbc1ed5d']);
const DEPARTMENT = /^[^\s、。・]{2,16}(課|局|室|事務局|所|センター|本部|署|館)$/;
const DIRECTION = new Set(['現行どおり', '一部改善', '休止', '完了', '拡充', '縮小', '廃止', '統合', '見直し']);
const GRADE = new Set(['Ａ', 'Ｂ', 'Ｃ', 'Ｄ']);

interface Block { raw: string; joined: string; lines: number; start: number }

/** 四街道市 令和８年度事務事業評価シート (3 projects side by side per page). */
function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12228' || !DOCUMENTS.has(input.sourceId) || input.format !== 'pdf' || input.truncated || !input.text.startsWith(HEADING)) return [];
  const text = input.text, pageStarts: number[] = [];
  for (let i = text.indexOf(HEADING); i >= 0; i = text.indexOf(HEADING, i + 1)) pageStarts.push(i);
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  pageStarts.forEach((pageStart, n) => {
    const pageEnd = n + 1 < pageStarts.length ? pageStarts[n + 1] : text.length;
    const blocks: Block[] = [];
    for (const m of text.slice(pageStart, pageEnd).matchAll(/[^\n]+(?:\n[^\n]+)*/g)) {
      const raw = m[0].trim();
      if (raw) blocks.push({ raw, joined: raw.replace(/\n/g, ''), lines: raw.split('\n').length, start: pageStart + m.index! + m[0].indexOf(raw) });
    }
    const names: Block[] = [], departments: Block[] = [];
    for (const b of blocks) {
      if (b.joined === '担当部署') continue;
      if (b.joined.endsWith('事業') && b.lines <= 3 && b.joined.length <= 30 && !/[。、課]/.test(b.joined)) names.push(b);
      else if (DEPARTMENT.test(b.joined) && b.lines <= 2) departments.push(b);
    }
    const directions = blocks.filter(b => DIRECTION.has(b.raw)), grades = blocks.filter(b => GRADE.has(b.raw));
    // Only pages where every column-wise list has exactly one entry per project.
    if (!names.length || names.length !== departments.length || names.length !== directions.length) return;
    const uniformGrade = grades.length === names.length * 3 && new Set(grades.map(g => g.raw)).size === 1 ? grades[0] : null;
    names.forEach((name, k) => {
      const dept = departments[k], dir = directions[k];
      const p = project(input, `${dept.joined}:${name.joined}`, name.joined, 2026, name.raw, name.start);
      p.department = dept.joined; p.evaluatedFiscalYear = 2025;
      p.evidence.push(evidence(input, dept.raw, dept.start), evidence(input, HEADING, pageStart));
      p.ratings.push({ kind: 'self', label: '事業の方向性', value: dir.raw, scale: null, evidence: evidence(input, dir.raw, dir.start) });
      if (uniformGrade) for (const label of ['妥当性', '有効性', '効率性'])
        p.ratings.push({ kind: 'self', label, value: uniformGrade.raw, scale: null, evidence: evidence(input, uniformGrade.raw, uniformGrade.start) });
      p.warnings.push('令和８年度事務事業評価シート（令和７年度実施事業）。1ページ3事業の横並び様式で抽出テキストの列が交錯するため、事業名・担当部署・事業の方向性の件数がページ内で一致するページだけを列内の出現順で対応付けて収録（件数が合わないページは除外）。妥当性・有効性・効率性はページ内の評価記号がすべて同一で件数が3×事業数に一致する場合だけ収録。目的・事業概要・事業成果・評価の具体的な内容は列の対応を確定できないため未収録。事業費の記載はない。');
      const key = p.projectCode!, old = out.get(key);
      if (old) {
        if (JSON.stringify(old.ratings.map(r => [r.label, r.value])) !== JSON.stringify(p.ratings.map(r => [r.label, r.value]))) conflicts.add(key);
        else old.evidence.push(...p.evidence);
      } else out.set(key, p);
    });
  });
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '12228': { extract, scope: '四街道市 令和８年度事務事業評価シート（令和７年度実施事業、会計課・議会・行政委員会／都市部／上下水道部／教育部／消防本部の5資料）のうち、ページ内で事業名・担当部署・方向性の件数が一致するページの事業名・担当部署・事業の方向性（および全事業同一の場合のみ妥当性・有効性・効率性）。目的・概要・成果・評価文と結果ページ（HTML）は構造化しない。' },
};
