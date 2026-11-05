import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 根羽村
// (1) 電源立地地域対策交付金事業評価報告書（令和２〜４年度、保育所運営事業1事業ずつ）: 事業評価個表の「交付金事業の概要」欄を
//     事業内容、「交付金事業の定性的な成果及び評価等」欄を成果とする（欄の見出しの次の行から空行まで）。事業名・年度は
//     公開済みレコードと同じ事業評価総括表の表記・見出しの年度。
// (2) 物価高騰対応重点支援地方創生臨時交付事業 使途・効果等一覧（令和５・６年度事業実績）: 事業名・事業の概要・実施状況・効果・
//     総事業費が空行区切りで1行ずつ並ぶ行だけ（概要と効果の文が行の途中で混ざる行、効果が表の外へ離れた行は採らない）。
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function field(t: string, label: string): { value: string; raw: string; at: number } | null {
  const i = t.indexOf(label);
  if (i < 0 || t.indexOf(label, i + 1) >= 0) return null;
  const at = i + label.length, end = t.indexOf('\n\n', at);
  if (end < 0) return null;
  const raw = t.slice(at, end), lines = raw.split('\n');
  if (!lines.length || lines.some(l => !l.trim()) || !/。$/.test(lines[lines.length - 1])) return null;
  return { value: unwrap(raw), raw, at };
}

function dengen(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const head = /\nⅠ．事業評価総括表（令和([０-９\d]+)年度）\n[\s\S]*?\n\n([^\n]*保育所運営事業)\n\n根羽村\n\n（備考）/.exec(t);
  if (!head || !t.includes('電源立地地域対策交付金事業評価報告書') || t.split('事業評価個表（').length !== 2) return [];
  const fy = 2018 + Number(ascii(head[1]));
  const activities = field(t, '\n交付金事業の概要\n\n'), outcomes = field(t, '\n交付金事業の定性的な成果及び評価等\n');
  if (!activities && !outcomes) return [];
  const p = project(input, `${head[2]}:narrative`, head[2], null, head[0].slice(1), head.index! + 1);
  p.projectCode = null;
  p.evaluatedFiscalYear = fy;
  if (activities) { p.activities = activities.value; p.evidence.push(evidence(input, activities.raw, activities.at)); }
  if (outcomes) { p.outcomes = outcomes.value; p.evidence.push(evidence(input, outcomes.raw, outcomes.at)); }
  p.warnings.push('根羽村 電源立地地域対策交付金事業評価報告書の事業評価個表から、交付金事業の概要（事業内容）と交付金事業の定性的な成果及び評価等（成果）。欄の幅での折り返しは改行を除いてつないだ。');
  return [p];
}

const ROW = /\n\n((?:[^\n]+\n)?[^\n]+)\n\n([^\n]+)\n\n([^\n]+。)\n\n(\d[\d,]*)\n\n/g;

function bukka(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.startsWith('物価高騰対応重点支援地方創生臨時交付事業使途・効果等一覧\n')) return [];
  const sections = [...t.matchAll(/\n令和(\d)年度事業実績\n/g)];
  sections.forEach((s, i) => {
    const from = s.index!, to = sections[i + 1]?.index ?? t.length, fy = 2018 + Number(s[1]);
    const body = t.slice(from, to);
    for (const m of body.matchAll(ROW)) {
      const name = m[1].replace('\n', '');
      if (/^(その他|事業名|総事業費|臨時交付金)$/.test(name) || !/(事業|交付金)$/.test(name) || !/(交付|給付)/.test(m[2])) continue;
      const at = from + m.index! + 2;
      const p = project(input, `${fy}:${name}:narrative`, name, null, m[1], at);
      p.projectCode = null;
      p.evaluatedFiscalYear = fy;
      p.activities = m[2];
      p.outcomes = m[3];
      p.evidence.push(evidence(input, m[2], at + m[1].length + 2), evidence(input, m[3], at + m[1].length + 2 + m[2].length + 2));
      p.warnings.push('根羽村 物価高騰対応重点支援地方創生臨時交付事業 使途・効果等一覧の「事業の概要」（事業内容）と「実施状況・効果」（成果）。各欄が1行ずつ並ぶ行のみ。');
      out.push(p);
    }
  });
  return out;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '20410') return [];
  return [...dengen(input), ...bukka(input)];
}

export const entry = {
  extract,
  scope: '根羽村 電源立地地域対策交付金事業評価報告書（令和２〜４年度 保育所運営事業）の事業概要・定性的な成果、物価高騰対応臨時交付事業の使途・効果等一覧（令和５・６年度）の事業概要・実施状況・効果（各欄が1行ずつ並ぶ行のみ）。目的欄はない。',
};
