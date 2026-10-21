import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 町田市 2024年度 市民参加型事業評価。事業別評価結果（e39b…）を主資料とし、事業ごとの「評価結果の概要」（A01〜B03）と総合評価が一致する事業だけ返す。
const MACHIDA_RESULT = 'e39be9d0bb1a4270e5377e92';
const MACHIDA_TITLE = '2024年度\n\n町田市市民参加型事業評価\n事業別評価結果';
const MACHIDA_LABELS = ['満足できる事業である', '一部改善すべき', '大いに改善すべき', '市が行うべき事業ではない'];
const MACHIDA_PROJECTS: { no: string; name: string; summary: string; summaryTitle: string; department: string }[] = [
  { no: '（１）', name: '市民協働推進費・地域活動団体支援事業', summary: 'efd64fef8b3a90fd265e99d7', summaryTitle: '市民協働推進費・地域活動団体支援事業費に関する評価結果の概要', department: '市民部 市民協働推進課' },
  { no: '（２）', name: '障がい者福祉費', summary: 'f69b0544476d8af7ce56c071', summaryTitle: '障がい者福祉費に関する評価結果の概要', department: '地域福祉部 障がい福祉課' },
  { no: '（３）', name: '都市公園事業', summary: '20fe15bb425853c5f453440a', summaryTitle: '都市公園事業に関する評価結果の概要', department: '都市づくり部 公園緑地課' },
  { no: '（４）', name: '保健予防費', summary: 'e27aa799c96af604d6b85885', summaryTitle: '保健予防費に関する評価結果の概要', department: '保健所 保健予防課' },
  { no: '（５）', name: '生涯学習センター費・学校施設開放事業', summary: 'c81160b23fca6b6eaf3b940e', summaryTitle: '生涯学習センター費・学校施設開放事業に関する評価結果の概要', department: '生涯学習部 生涯学習総務課／文化スポーツ振興部 スポーツ振興課' },
  { no: '（6）', name: '広報費', summary: '1c1ab2b971b2a5d0e4c38886', summaryTitle: '広報費に関する評価結果の概要', department: '政策経営部 広報課' },
];

/** The single overall-rating label in a segment; null when absent or ambiguous. */
function onlyLabel(segment: string): string | null {
  const found = MACHIDA_LABELS.filter(l => segment.split(l).length === 2);
  const repeated = MACHIDA_LABELS.some(l => segment.split(l).length > 2);
  return found.length === 1 && !repeated ? found[0] : null;
}

function extractMachida(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.sourceId !== MACHIDA_RESULT || !input.text.startsWith(MACHIDA_TITLE)) return [];
  const out: ProjectEvaluation[] = [];
  for (const p of MACHIDA_PROJECTS) {
    const heading = `2 事業別の評価結果 ${p.no}${p.name}\n\n評価結果概要\n`;
    const start = input.text.indexOf(heading);
    if (start < 0 || input.text.indexOf(heading, start + 1) >= 0) continue;
    const votesAt = input.text.indexOf('各評価人の評価\n', start);
    const endAt = input.text.indexOf('市が行うべき事業ではない\n\n', votesAt);
    if (votesAt < 0 || endAt < 0) continue;
    const label = onlyLabel(input.text.slice(start, votesAt));
    if (!label) continue;
    const lineEnd = input.text.indexOf('\n', endAt + '市が行うべき事業ではない\n\n'.length);
    const raw = input.text.slice(start, lineEnd);
    const r = project(input, p.name, p.name, 2024, raw, start);
    r.department = p.department;
    r.ratings.push({ kind: 'external', label: '総合評価', value: label, scale: MACHIDA_LABELS.join('／'), evidence: evidence(input, raw, start) });
    // 評価人ごとの票数（原文の人数表記のまま）
    const votes = input.text.slice(votesAt, lineEnd);
    let ok = true;
    for (const l of MACHIDA_LABELS) {
      const m = votes.match(new RegExp(`${l}\\n\\n([0-9０-９]+人)`));
      if (!m) { ok = false; break; }
      const vraw = m[0], vstart = votesAt + m.index!;
      r.ratings.push({ kind: 'external', label: `各評価人の評価（${l}）`, value: m[1], scale: null, evidence: evidence(input, vraw, vstart) });
    }
    if (!ok) continue;
    // 評価結果の概要（同一事業の別資料）: 総合評価が食い違えば除外（取込は資料単位のため別資料の証拠は付けない）。
    const summary = inputs.find(i => i.sourceId === p.summary);
    if (summary) {
      if (!summary.text.startsWith(p.summaryTitle)) continue;
      const cut = summary.text.indexOf('改善プログラム');
      const sLabel = onlyLabel(summary.text.slice(0, cut < 0 ? undefined : cut));
      if (sLabel !== label) continue;
    }
    r.extractionStatus = 'partial';
    r.warnings.push('市民参加型事業評価（評価人による外部評価）の事業別評価結果。総合評価と評価人の票数を原文ラベルのまま記録。評価年度2024は表紙の「2024年度 町田市市民参加型事業評価」による。事業概要シート・課別行政評価シートの金額・指標表は段組み崩れで列と年度・決算/予算の別が確定できないため取り込んでいない。部課名は「評価結果の概要」の表記（同資料の総合評価と一致を確認済み）。');
    out.push(r);
  }
  return out;
}

export const machidaShichinoheEntries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '13209': {
    extract: extractMachida,
    scope: '2024年度町田市市民参加型事業評価の対象6事業について、事業別評価結果の総合評価・評価人票数と評価結果の概要（部課名）を構造化。事業概要シート・課別行政評価シートの財務表・指標表は列対応が確定できないため対象外。',
  },
};
