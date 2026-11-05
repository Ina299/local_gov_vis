import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 壬生町（地方創生拠点整備交付金等 事業効果検証シート）
// 公開済みレコードは同じ資料（02R7kouka.pdf、年度の記載なし）の事業。各事業の「事業概要：」欄（「実施内容：」の手前まで）を事業内容として取る。
// 欄には目的の記述も含まれるが、見出しは「事業概要」なので目的には入れない。折り返しの改行（ページ境界の空行を含む）は除き、
// 句点で終わる行の後・箇条（○・【）の前・短い箇条見出しの後は改行を残す。
const BLOCK = /^事業名：([^\n]+)\n事業概要：[ \n]*([\s\S]+?)\n\n?実施内容：/gm;

function join(raw: string): string {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const keep = (prev: string, l: string) => /。$/.test(prev) || /^[○〇・【]/.test(l) || (/^[○〇【]/.test(prev) && prev.length < 25);
  return lines.reduce((acc, l, i) => i === 0 ? l : acc + (keep(lines[i - 1], l) ? '\n' : '') + l, '');
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09361' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/02R7kouka.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(BLOCK)) {
    const name = m[1].trim(), body = m[2].trimEnd();
    if (body.length > 1500 || /事業名：/.test(body)) continue;
    const at = m.index! + m[0].indexOf(m[2], m[1].length);
    const p = project(input, `narrative:${name}`, name, null, m[0].slice(0, m[1].length + '事業名：'.length), m.index!);
    p.projectCode = null;
    p.activities = join(body);
    p.evidence.push(evidence(input, body, at));
    p.warnings.push('壬生町 事業効果検証シートの「事業概要」欄を事業内容として収録。折り返し・ページ境界の改行は除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '壬生町 事業効果検証シート（02R7kouka.pdf）: 「事業概要」欄（事業内容）。',
};
