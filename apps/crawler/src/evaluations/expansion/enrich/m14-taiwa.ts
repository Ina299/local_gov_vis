import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m14-util';

// ---------------------------------------------------------------- 大和町（第五次総合計画 重点プロジェクト（総合戦略）事業評価シート 令和５年度実施状況）
// 公開済みレコードは同じ資料（soukei_siryou1.pdf）の事業評価シート〔事業調書〕（対象年度2023）。シートの「事業概要」欄を
// 事業内容、「事業の効果等」欄（版により「事業の内容と実績」欄）を成果として収録する。目的だけの欄はない。
// 各欄は見出しの行の後の空行から、次の空行と次の見出しまで。
const SHEET = '事業評価シート 〔 事業調書 〕\n';
/** 見出しの行の後の空行から次の空行までを欄の本文とし、その次の行が next の見出しであること。 */
function field(seg: string, label: string, next: string): { raw: string; at: number } | null {
  const head = seg.indexOf(`\n${label}\n\n`);
  if (head < 0) return null;
  const at = head + label.length + 3, end = seg.indexOf('\n\n', at);
  if (end < 0 || !seg.startsWith(`\n\n${next}\n`, end)) return null;
  const raw = seg.slice(at, end);
  return raw.trim() ? { raw, at } : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04421' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/material/files/group/7/soukei_siryou1.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.includes('事業の令和５年度の実施状況について\n')) return [];
  let at = t.indexOf(SHEET);
  while (at >= 0) {
    const base = at, next = t.indexOf(SHEET, at + SHEET.length), seg = t.slice(base, next < 0 ? t.length : next);
    at = next;
    const nm = /\n事業名\n\n([①-⑳㉑-㊿])([^\n]+)\n\n所管課\n\n([^\n]+)\n/.exec(seg);
    if (!nm) continue;
    const effectLabel = seg.includes('\n事業の効果等\n\n') ? '事業の効果等' : '事業の内容と\n実績';
    const outline = field(seg, '事業概要', effectLabel);
    if (!outline) continue;
    const effect = field(seg, effectLabel, '重要業績評価指数（KPI）に関する事項');
    const name = nm[2].trim();
    const p = project(input, `narrative:${nm[1]}`, name, null, nm[0].slice(1, -1), base + nm.index + 1);
    p.projectCode = null; p.evaluatedFiscalYear = 2023; p.department = nm[3].trim();
    p.activities = unwrap(outline.raw);
    p.evidence.push(evidence(input, outline.raw, base + outline.at));
    if (effect) {
      p.outcomes = unwrap(effect.raw);
      p.evidence.push(evidence(input, effect.raw, base + effect.at));
    }
    p.warnings.push('大和町 重点プロジェクト（総合戦略）事業評価シート〔事業調書〕（令和５年度実施状況）の「事業概要」欄を事業内容、'
      + '「事業の効果等」欄（「事業の内容と実績」欄の版はその欄）を成果として収録。欄の幅での折り返しだけをつないだ。目的だけの欄はない。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '大和町 重点プロジェクト（総合戦略）事業評価シート（令和５年度実施状況）: 「事業概要」「事業の効果等」（または「事業の内容と実績」）欄。目的欄はない。',
};
