import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import type { Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';

// ---------------------------------------------------------------- 芽室町 事務事業マネジメントシート（通常・簡易）
const HEAD = /(\d{4}) 年度 （ (\d{4}) 年度実績 ） 事務事業マネジメントシート（(通常|簡易)）\n/g;
// 様式の選択肢・欄名で、事業名ではない行。
const LABELS = new Set(['予算を伴わない事業', '計上予算が負担金・繰出金のみの事業', '法定受託事務', '政策体系に結びつかない事業', '今後3年間で大きな変化が見込まれない事業']);

export function memuroSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const heads = [...t.matchAll(HEAD)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, body = t.slice(start + h[0].length, heads[k + 1]?.index ?? t.length);
    const evaluationYear = Number(h[1]), evaluated = Number(h[2]);
    if (evaluationYear !== evaluated + 1) return;
    // 事業名は表題直後の欄見出し部分（「事務事業名」の前後）にある。
    const headLines = body.split('\n').filter(l => l.trim()).slice(0, 14);
    const at = headLines.indexOf('事務事業名');
    if (at < 0) return;
    const names = headLines.filter(l => !LABELS.has(l) && /^[^\s。、（）()]{2,40}(事業|事務|業務)$/.test(l) && l !== '事務事業名');
    if (names.length !== 1) return;
    const name = names[0], nameAt = start + h[0].length + body.indexOf(`${name}\n`);
    if (t.slice(nameAt, nameAt + name.length) !== name || (nameAt > 0 && t[nameAt - 1] !== '\n')) return;
    const p = project(input, `${h[1]}:${name}`, name, evaluationYear, h[0].slice(0, -1), start);
    p.projectCode = null;
    p.evaluatedFiscalYear = evaluated;
    p.evidence.push(evidence(input, name, nameAt));
    const dep = headLines.map(l => /^(\S+課)(?: \S+係)?$/.exec(l)).filter(m => m !== null);
    if (dep.length === 1) {
      p.department = dep[0]![0];
      p.evidence.push(evidence(input, dep[0]![0], start + h[0].length + body.indexOf(`\n${dep[0]![0]}\n`) + 1));
    }
    p.warnings.push(`事務事業マネジメントシート（${h[3]}）。評価年度・評価対象年度は表題「${h[1]} 年度 （ ${h[2]} 年度実績 ）」による。事業費・人件費・指標の表は年度見出しと数値の並びが抽出テキストで分離しており列の対応を確定できないため未収録。`);
    out.push(p);
  });
  return out;
}

export const memuroEntries: Record<string, Entry> = {
  '01637': {
    extract: municipality(memuroSheets, p => `${p.evaluationYear}:${p.projectName}`),
    scope: '芽室町 事務事業マネジメントシート（通常・簡易、2019〜2025年度作成分）の事業名・所属課・評価年度/評価対象年度（表題の「YYYY 年度 （ YYYY 年度実績 ）」）のみの部分構造化。事業費・指標・方向性は列崩れのため対象外。施策マネジメントシート（施策評価）と、表題が崩れた平成29・30年度作成分は対象外。',
  },
};
