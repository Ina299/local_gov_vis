import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 陸別町（地方創生臨時交付金 充当事業一覧 R5・R6）
// 公開済みレコードは同じ一覧の行から作られ、年度は一覧の年度（対象年度）。「事業の目的と実績」欄の「①目的・効果」の段落
// （①で始まる行から、②の行・事業期間の日付の行の手前まで）を目的とする。事業名は欄の②の行の行頭（事業名の前半）と、
// 番号・補助単独の行の後の行（後半。事業期間・金額の行は飛ばす）をつないだもので、公開済みレコードの事業名と同じになる。
// 成果・効果及びその評価の欄は金額の列と行が混ざるため扱わない。
const FILES: Record<string, number> = { 'R6koufukinjisseki.pdf': 2024, 'R5rinnjikoufukinn.pdf': 2023 };

function extract(input: CachedInput): ProjectEvaluation[] {
  const fy = FILES[input.sourceUrl.split('/').pop()!];
  if (input.municipalityCode !== '01648' || !fy) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/\n(①[^\n]*\n(?:[^\n①②]+\n)*?)(?:R\d\d\.\d+\.\d+\n)?([^\n②]+) ②[^\n]*\n((?:[^\n]*\n){0,6}?)(\d+) 単\n((?:～|[\d,]+(?: [\d,]+)*|R\d\d\.\d+\.\d+)\n)*([^\n]+)\n/g)) {
    const raw = m[1].replace(/\n$/, '');
    if (!/[。）]$/.test(raw) || m[3].includes('①')) continue;
    const name = m[2] + m[6];
    const p = project(input, `${m[4]}:${name}:purpose`, name, null, m[2], m.index! + 1 + m[1].length + (m[0].slice(1 + m[1].length).indexOf(m[2])));
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.purpose = unwrap(raw.slice(1));
    p.evidence.push(evidence(input, raw, m.index! + 1));
    p.warnings.push('陸別町 地方創生臨時交付金 充当事業一覧の「事業の目的と実績」欄のうち①目的・効果の段落（行頭の①を除き、欄の幅での折り返しは改行を除いてつないだ）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '陸別町 地方創生臨時交付金 充当事業一覧（令和５・６年度）: 事業の目的と実績欄の①目的・効果。',
};
