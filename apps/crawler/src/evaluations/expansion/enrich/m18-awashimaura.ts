import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 粟島浦村（新型コロナウイルス感染症対応地方創生臨時交付金 実施状況および効果検証結果）
// 公開済みレコードは同じ表（令和2〜4年度版）の「No 事業名」の行の事業。表の「事業概要および目的」の列の文は、抽出テキストでは
// 事業名・担当課の行の後の段落で、次の段落が「実施内容」の列（①対象経費…）で始まる。ここではその段落の行がすべて
// この列だけの文（実施内容の列の「①」「・」が同じ行に混ざらない）である事業に限り、目的として足す。
// 年度は表題の【令和N年度】（交付金の実施年度。公開済みレコードの evaluatedFiscalYear と同じ）。年度のない公開済みレコードは照合できない。
// 成果および効果の列は「経済対策との関係」の列と同じ行に並ぶため採らない。
const TITLE = /^【令和([２-４2-4])年度】新型コロナウイルス感染症対応地方創生臨時交付金 実施状況および効果検証結果\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '15586') return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const fy = 2018 + Number(title[1].normalize('NFKC'));
  const rows = [...t.matchAll(/^(\d+) ([^\n]+)\n\n([^\n]+)\n\n((?:[^\n]+\n)+)\n①/gm)];
  const count = new Map<string, number>();
  for (const r of rows) count.set(r[2].trim(), (count.get(r[2].trim()) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  for (const r of rows) {
    const name = r[2].trim(), raw = r[4].slice(0, -1);
    if (count.get(name) !== 1 || /[①-⑳・]/.test(raw) || !raw.endsWith('。')) continue;
    const p = project(input, `${r[1]}:purpose`, name, null, `${r[1]} ${r[2]}`, r.index!);
    p.evaluatedFiscalYear = fy;
    p.department = r[3].trim();
    p.purpose = joinWrapped(raw, 25);
    p.evidence.push(evidence(input, raw, r.index! + r[0].indexOf(r[4])));
    p.warnings.push('地方創生臨時交付金 実施状況および効果検証結果の「事業概要および目的」列（欄の幅での折り返しだけを除いてつないだ）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '粟島浦村 新型コロナ地方創生臨時交付金 実施状況および効果検証結果（令和2〜4年度）: 事業概要および目的の列（目的）。実施内容の列が同じ行に混ざる事業、成果および効果の列（経済対策との関係の列と同じ行に並ぶ）は対象外。',
};
