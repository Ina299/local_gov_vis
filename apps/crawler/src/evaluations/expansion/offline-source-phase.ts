/** Bounded offline review of batch 12. No network access or inferred table coordinates. */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from './shared';

export interface SourceReview { projects: ProjectEvaluation[]; holds: { unit: string; reason: string }[] }
export const sanukiCovers: Record<string, { id: string; year: number }> = Object.fromEntries([
  ...['015be81566c7f99ca7c6dff1', '32c528e76c518120b9954bca', '6000164feeffb3bf81208d35', '8400f1428e560037d6a3bf61'].map(id => [id, { id: 'cb625c09117b6bec9da0a13f', year: 2024 }]),
  ...['21b764c7d3a33e432a752782', '680f6bb8d2623b9180ca2bd1', 'dc00fdfdacc88d812fad19db', 'eecfd3ba538e2e47637354af', 'f91eb5b127c4a6abe3d7b570'].map(id => [id, { id: 'df52ad93846580efd42de26e', year: 2022 }]),
]);
const norm = (text: string) => text.normalize('NFKC').replace(/\s/g, '');
const hold = (reason: string): SourceReview => ({ projects: [], holds: [{ unit: 'document', reason }] });

export function reviewOfflineSource(input: CachedInput, title: string, inputs: CachedInput[]): SourceReview {
  const t = input.text;
  if (input.municipalityCode === '01202') {
    if (input.truncated || !norm(t).startsWith('平成27年度函館市事業評価調書') || !t.includes('参考：他の自治体の状況')) return hold('Complete 2015 individual-sheet boundaries not established');
    const header = t.slice(0, t.indexOf('１．'));
    if (!header.includes(title)) return hold('Official link title is not an exact name in the sheet header; layout/name review required');
    const purpose = t.match(/【目的】\s*([\s\S]*?)\s*【必要性】/);
    if (!purpose?.[1].trim()) return hold('Purpose/necessity boundary differs; individual layout review required');
    const number = header.match(/\n(補助金[0-9０-９]+|[0-9]+)\n/);
    if (!number) return hold('Printed sheet number not unambiguously identified');
    const p = project(input, number[1], title, 2015, t);
    p.purpose = purpose[1].trim();
    const outcome = t.match(/事業の成果等\s*([\s\S]*?)\s*５[．.]/)?.[1].trim();
    if (outcome && !/別紙|別添/.test(outcome)) p.outcomes = outcome;
    const department = header.match(/部課名 ([^\n]+)/)?.[1];
    if (department && !/電話|番号|根拠/.test(department)) p.department = department;
    if (input.sourceId === '0062a63c4fb022eac4de8f65') {
      const activity = t.match(/委託している業務の内容は，次のとおりである。\n([^\n]+)/)?.[1];
      if (activity) p.activities = activity;
    }
    p.warnings.push('平成27年度は評価調書の年度。複数年度の数値を含むため評価対象会計年度は未確定。決算見込・予算要求を決算・予算へ変換せず、列座標未確認の金額と指標値は未抽出。');
    for (const value of [p.purpose, p.activities, p.outcomes, p.department]) if (value) p.evidence.push(evidence(input, value));
    return { projects: [p], holds: [] };
  }
  const binding = sanukiCovers[input.sourceId];
  if (input.municipalityCode === '37206' && binding) {
    const cover = inputs.find(x => x.sourceId === binding.id);
    const year = binding.year - 2018;
    const digit = String.fromCharCode(0xff10 + year);
    const quote = cover?.text.match(new RegExp(`事務事業評価調書（令和[${year}${digit}]年度分）`))?.[0];
    if (!cover || cover.truncated || !quote) return hold('Matching series cover with explicit assessed fiscal year is missing');
    const starts = [...t.matchAll(/第[2２]次さぬき市総合計画(?:中期|後期)基本計画実施計画／事務事業評価調書/g)].map(m => m.index!);
    const pages = starts.map((start, i) => ({ start, text: t.slice(start, starts[i + 1] ?? t.length) }));
    const result: SourceReview = { projects: [], holds: [] };
    const name = (s: string) => {
      let n = s.match(/事業名\s*([\s\S]*?)基本目標/)?.[1].trim() ?? '';
      n = n.replace(/^[^\n]+(?:課|局|室|所)\s+担当課\s+/, '');
      if (!n) n = s.match(/^第[^\n]+\n([^\n]+)\s+事業名\s+基本目標/)?.[1].trim() ?? '';
      return n && n.length < 100 && !/担当課|^会計\s|事業名/.test(n) ? n : null;
    };
    for (let i = 0; i < pages.length; i += 2) {
      const first = pages[i], second = pages[i + 1], a = name(first.text), b = second && name(second.text);
      const page1 = first.text.match(/\n(\d+)\s*(?:実績\s*)?$/), page2 = second?.text.match(/\n(\d+)\s*$/);
      const unit = `chars:${first.start}`;
      if (!second || !a || !b || norm(a) !== norm(b) || !page1 || !page2 || Number(page2[1]) !== Number(page1[1]) + 1 || !second.text.includes('事業の位置付けを踏まえた総括')) {
        result.holds.push({ unit, reason: 'Two-page completeness/name pairing not established by consecutive page numbers and final summary; layout review required, no cross-sheet joining' }); continue;
      }
      const boundedPurpose = first.text.match(/\n目的\s*([\s\S]*?)\n\s*項\s*\n/)?.[1].trim();
      if (!boundedPurpose || boundedPurpose.length > 250 || /会計|財源|計画額|具体的取組/.test(boundedPurpose)) { result.holds.push({ unit, reason: 'Purpose cell boundary not unambiguous' }); continue; }
      const raw = t.slice(first.start, second.start + second.text.length);
      const p = project(input, `sheet-${page1[1]}`, a.replace(/\s*\n\s*/g, ''), null, raw, first.start);
      p.projectCode = null; // Printed page numbers are evidence locations, not official business codes.
      p.evaluatedFiscalYear = binding.year;
      p.purpose = boundedPurpose;
      const activity = first.text.match(/\n手段\s*([\s\S]*?)\n\s*目的\s*\n/)?.[1].trim();
      if (activity && activity.length < 250) p.activities = activity;
      const reason = second.text.match(/\n評価理由\s*([\s\S]*?)\n\s*改\s*\n善/)?.[1].trim();
      if (reason && reason.length < 1800 && !/担当者|解決すべき/.test(reason)) p.ratings.push({ kind: 'self', label: '評価理由', value: reason, scale: null, evidence: evidence(input, reason, second.start + second.text.indexOf(reason)) });
      p.evidence.push(evidence(cover, quote));
      for (const value of [p.purpose, p.activities]) if (value) p.evidence.push(evidence(input, value, first.start + first.text.indexOf(value)));
      p.warnings.push('評価対象年度は対応する冊子表紙の「年度分」。刊行年を評価実施年度と同一視せずevaluationYearは未確定。完結した2ページの個票だけ採用。計画額・当初予算額・決算額・未実施年度の0・指標表は列座標未確認のため未変換。');
      if (input.truncated) p.warnings.push('原典の保存本文は途中で切れている。採用個票は切断位置より前で完結しており、冊子全体の抽出完了ではない。');
      result.projects.push(p);
    }
    return result;
  }
  if (input.municipalityCode === '13220' && t.includes('リアルタイム事務事業評価調書①')) {
    if (input.truncated || !t.includes('リアルタイム事務事業評価調書②') || !t.includes('財源内訳')) return hold('Individual real-time sheet lacks complete report/cost section');
    const name = t.match(/事業名\s*([^\n]+)\s*担当部署/)?.[1];
    const section = t.match(/B）事業概要・事業目的\s*([\s\S]*?)(?:G）当該会議|C）過去の実績)/)?.[1];
    if (!name || !section || !t.includes('令和6年度')) return hold('Name, cycle or purpose boundary not established');
    const instruction = '※「〇〇意識を高める」、「理解を深める」等といった成果が不明確な目標ではなく、できるかぎり効果が数値化できる目標にしてください。';
    const parts = section.split(instruction).map(s => s.trim()).filter(s => s.replace(/事業の|概要・目的|\s/g, '').length > 20);
    if (parts.length !== 1) return hold('Purpose section mixes multiple columns; curated clause needed');
    let purpose = parts[0].replace(/\s*事業の\s*概要・目的\s*$/, '').trim();
    // This sheet places the neighbouring F-column target before the explicitly labelled B-column body.
    if (input.sourceId === '6a57218757906c30dde37b7d') {
      const explicit = purpose.match(/【目的】([\s\S]+)$/)?.[1].trim();
      if (!explicit) return hold('Explicit purpose label missing in the interleaved childcare sheet');
      purpose = explicit;
    }
    const p = project(input, name, name, 2024, t); p.projectCode = null; p.evaluatedFiscalYear = 2024; p.purpose = purpose; p.evidence.push(evidence(input, purpose));
    p.warnings.push('事業概要・目的欄の原文を保持。欄名が文章途中に混在する場合も改変しない。R6決算額（暫定）を確定決算に変換せず、見込・目標と実績を推測で対応させない。金額・指標・選択肢の○位置は未抽出。');
    return { projects: [p], holds: [] };
  }
  if (input.municipalityCode === '08443') return hold('Policy/basic-plan chapters, not bounded individual business evaluation sheets; retain related-material browsing');
  if (input.municipalityCode === '11243' && input.format === 'html') return hold('Evaluation landing page; linked individual sheets are separate evidence');
  if (input.municipalityCode === '37206' && t.includes('表紙')) return hold('Cover/context only');
  if (input.municipalityCode === '37206' && t.length < 200) return hold('Cover/context only; assessed-year evidence for matching series');
  if (t.includes('施策評価') || t.includes('基本施策別目標指標')) return hold('Policy-level evaluation/indicator document; not an individual business sheet');
  return hold('Different layout remains for a separate source-specific review; no claim that extraction is impossible');
}
