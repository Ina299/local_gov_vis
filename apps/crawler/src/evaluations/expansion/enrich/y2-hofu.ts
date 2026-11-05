import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { width } from './m10-util';

// ---------------------------------------------------------------- 防府市（事務事業評価一覧。R6年度決算・R7年度予算）
// 公開済みレコード（年度なし）はこの一覧の「No 担当課 ○ 事業名 事業内容 R6年度 R7年度 今後の方向性/取組」の行から作られている。
// 「事業内容」の列は欄の幅（全角約47字）で折り返すと、行の上下に分かれ、右の「今後の方向性/取組」の列の折り返しと同じ行に混ざる。
// ここでは事業内容が No の行だけに収まる事業に限って事業内容（activities）として足す。すなわち No の行の事業名と決算額の間の文が
// 句点で終わり、かつ直前の行が見出し・前の事業の No の行か、事業内容の列の折り返しにしては短い（全角42字未満）行であること。
// 事業内容が3行以上に折り返すと直前の行に全角45字前後の1行目（または今後の方向性の列と混ざった行）が来るため、ここで除かれる。
// 「今後の方向性/取組」は成果ではないため採らない。担当課が複数行に分かれた事業（No の行に担当課がない）は担当課を空のまま照合する。
const SOURCE = 'https://www.city.hofu.yamaguchi.jp/uploaded/attachment/142373.pdf';
const HEADER = /プロジェクト 改革$/;
const MAIN = /^(\d+) (?:(\S+(?:課|局|室|所|センター|館|署)) )?((?:○ )*)(\S+) (.*?) ?(\d[\d,]*) (\d[\d,]*)(?: (.+))?$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '35206' || input.sourceUrl !== SOURCE || !/^事務事業評価一覧\n/.test(input.text)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const lines = t.split('\n'), starts: number[] = [];
  for (let i = 0, pos = 0; i < lines.length; pos += lines[i].length + 1, i++) starts.push(pos);
  const names = new Map<string, number>();
  const rows = lines.map((l, i) => ({ i, m: MAIN.exec(l) })).filter(r => r.m);
  for (const r of rows) names.set(r.m![4], (names.get(r.m![4]) ?? 0) + 1);
  for (const { i, m } of rows) {
    const [line, no, dept, , name, text] = m!;
    if (names.get(name) !== 1 || !text || !text.endsWith('。')) continue;
    const above = lines[i - 1] ?? '';
    if (!(MAIN.test(above) || HEADER.test(above) || width(above) < 42)) continue;
    if (input.truncated && i >= lines.length - 2) continue;
    const p = project(input, `No${no}:activities`, name, null, line, starts[i]);
    p.department = dept ?? null;
    p.activities = text;
    p.evidence.push(evidence(input, text, starts[i] + line.indexOf(` ${name} `) + name.length + 2));
    p.warnings.push('防府市 事務事業評価一覧の「事業内容」列のうち、No の行だけに収まる文（折り返しのない事業）を事業内容として収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '防府市 事務事業評価一覧（R6年度決算・R7年度予算）: No の行だけに収まる「事業内容」列の文（事業内容）。折り返して今後の方向性/取組の列と混ざる事業、今後の方向性/取組（成果ではない）は対象外。',
};
