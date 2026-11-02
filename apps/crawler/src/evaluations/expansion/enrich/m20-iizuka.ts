import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 飯塚市（令和5年度 飯塚市事務事業評価シート、事業ごとのPDF）
// 公開済みレコードは同じ評価シート（対象年度＝令和５年度）。「２．事務事業の概要及び目的」の「意図（対象をどのようにしたいか）」を目的、
// 「概要」を事業内容として取る。見出しの文字（「概」「要」「意」「図」「したいか」）は本文の行頭か単独の行に出力されるため、その語だけを除く。
// 意図は本文が「したいか」の行の1行だけの版と、「意」の行と「図 （成果指標）」の行の2行に分かれる版だけを採る。
// 概要は節見出しの次の行から「対 働きかける」の手前までで、行頭の「概」「要」以外の見出しが混ざる版は採らない。
const HEAD = /^令和5年度 飯塚市事務事業評価シート .*\n事務事業名 (.+?) 事務事業№ /;
const SECTION = '２．事務事業の概要及び目的（決算成果説明書と連動）\n';
const INTENT = [
  /\n対象をどのように\n意\nしたいか ([^\n]+)\n図 （成果指標）\n/,
  /\n対象をどのように\n意 ([^\n]+)\nしたいか\n図 （成果指標） ([^\n]+)\n/,
];
const LABEL = /^[概要](?: |$)/;

/** 句点で終わる行の後だけ改行を残し、欄の幅での折り返しの改行は除く。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40205' || input.format !== 'pdf' || input.truncated) return [];
  const t = input.text, h = HEAD.exec(t);
  if (!h || t.indexOf(SECTION) < 0 || t.indexOf(SECTION) !== t.lastIndexOf(SECTION)) return [];
  const name = h[1].trim();
  const p = project(input, `narrative:${name}`, name, null, h[0].slice(h[0].indexOf('事務事業名'), -' 事務事業№ '.length), h.index + h[0].indexOf('事務事業名'));
  p.projectCode = null; p.evaluatedFiscalYear = 2023;
  const a = t.indexOf(SECTION) + SECTION.length, b = t.indexOf('\n対 働きかける\n', a);
  if (b > a) {
    const raw = t.slice(a, b), lines = raw.split('\n');
    if (lines.filter(l => /^概(?: |$)/.test(l)).length === 1 && lines.filter(l => /^要(?: |$)/.test(l)).length === 1
      && !lines.some(l => /^[対象手段意図] |働きかけ|活動指標|成果指標/.test(l))) {
      const body = lines.map(l => l.replace(LABEL, '').trim()).filter(Boolean);
      if (body.length) {
        p.activities = join(body);
        p.evidence.push(evidence(input, raw, a));
      }
    }
  }
  for (const [k, re] of INTENT.entries()) {
    const m = re.exec(t);
    if (!m || re.exec(t.slice(m.index + 1))) continue;
    p.purpose = k === 0 ? m[1].trim() : join([m[1].trim(), m[2].trim()]);
    p.evidence.push(evidence(input, m[0].slice(1, -1), m.index + 1));
    break;
  }
  if (!p.purpose && !p.activities) return [];
  p.warnings.push('飯塚市 令和5年度事務事業評価シートの「意図（対象をどのようにしたいか）」を目的、「概要」を事業内容として収録。'
    + '本文の行頭・単独の行に出力された見出しの文字（概・要・意・図・したいか・（成果指標））を除き、欄の幅での折り返しの改行を除いた。');
  return [p];
}

export const entry = {
  extract,
  scope: '飯塚市 令和5年度 事務事業評価シート（事業ごとのPDF）: 「意図（対象をどのようにしたいか）」（目的）・「概要」（事業内容）欄。意図が3行以上に分かれる版は対象外。',
};
