/**
 * 04445 加美町: Ｒ１ 事務事業評価シート（補助金・一般/内部管理・施設管理運営の3様式）。公開済みレコード（同じ評価シートの事業名）の空欄の目的・事業内容を補う。
 * 補助金: 「２ 事務事業（補助金）の目的」の欄（「３ 事業概要（補助対象団体の決算内容）」の見出しの手前まで）を目的とする。1段組みの欄。
 * 一般・施設: 「４ 活動指標」「５ 成果指標」の見出しの下の2列「■町がどのようなことを行ったか」（手段）と「■この事業によって対象をどうしたいのか」（意図）。
 *   抽出テキストでは2つの見出しが並んだ後に左列・右列の順で本文が出る。本文が空行で区切られたちょうど2段落で、数値の行が混ざらない
 *   （左右の列が行ごとに交互に出たものや、表の数値が割り込んだものを除く）場合だけ、1段落目を事業内容、2段落目を目的とする。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { unwrap } from './m1-util';

const TITLE = 'Ｒ１ 事務事業評価シート';
const NAMES = [
  /\n１ 事務事業の基本情報\n補助金名\n([^\n]+)\n団体名等\n/,
  /\n１ 事務事業の基本情報\n事務事業名\n([^\n]+)\n（施設名）\n/,
  /\n１ 事務事業の基本情報\n\n((?:[^\n]+\n){1,3})\n事務事業名\n/,
];
const SUBSIDY = '\n２ 事務事業（補助金）の目的\n', SUBSIDY_END = '\n３ 事業概要（補助対象団体の決算内容）\n';
const COLUMNS = '\n■町がどのようなことを行ったか\n\n■この事業によって対象をどうしたいのか\n', COLUMNS_END = '\n■何をどれだけ行ったか（活動指標）\n';
/** 数値・単位だけの行、数値が並んだ行（表の割り込み） */
const NUMERIC = /^(\S{0,3} )?[\d,.，．％%]+$|\d [\d,]+/;

/** 折り返しの改行を除く。欄の最長行が30字未満なら（短い箇条を並べた欄）改行は折り返しではないのでそのまま。 */
const join = (s: string) => Math.max(...s.split('\n').map(l => l.length)) >= 30 ? unwrap(s) : s;
/** [from, to) の前後の空行を除いた本文と位置。 */
function trimmed(t: string, from: number, to: number): { text: string; at: number } {
  const body = t.slice(from, to), lead = body.length - body.replace(/^\n+/, '').length;
  return { text: body.slice(lead).replace(/\n+$/, ''), at: from + lead };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04445' || input.format !== 'pdf' || !input.text.startsWith(TITLE)) return [];
  const t = input.text, starts: number[] = [], out: ProjectEvaluation[] = [];
  for (let i = t.indexOf(TITLE); i >= 0; i = t.indexOf(TITLE, i + 1)) starts.push(i);
  starts.forEach((s, k) => {
    if (input.truncated && k === starts.length - 1) return;
    const e = starts[k + 1] ?? t.length, sheet = t.slice(s, e);
    const m = NAMES.map(re => re.exec(sheet)).find(Boolean);
    if (!m) return;
    const name = m[1].split('\n').map(l => l.trim()).join('');
    let purpose: { text: string; at: number } | null = null, activities: { text: string; at: number } | null = null;
    const a = sheet.indexOf(SUBSIDY), b = sheet.indexOf(SUBSIDY_END);
    if (a >= 0 && b > a && sheet.indexOf(SUBSIDY, a + 1) < 0) {
      const body = trimmed(sheet, a + SUBSIDY.length, b);
      if (body.text.length >= 10 && !body.text.includes('\n\n') && !body.text.split('\n').some(l => NUMERIC.test(l.trim()))) purpose = body;
    }
    const c = sheet.indexOf(COLUMNS), d = sheet.indexOf(COLUMNS_END);
    if (c >= 0 && d > c && sheet.indexOf(COLUMNS, c + 1) < 0) {
      const body = trimmed(sheet, c + COLUMNS.length, d), cut = body.text.indexOf('\n\n');
      const first = body.text.slice(0, cut), second = body.text.slice(cut).replace(/^\n+/, '');
      if (cut > 0 && !second.includes('\n\n') && second.length >= 4 && !body.text.split('\n').some(l => NUMERIC.test(l.trim()))) {
        activities = { text: first, at: body.at };
        purpose = { text: second, at: body.at + body.text.length - second.length };
      }
    }
    if (!purpose && !activities) return;
    const p = project(input, `${name}|narrative`, name, 2019, m[0].slice(1, -1), s + m.index! + 1);
    p.projectCode = null;
    p.evidence.unshift(evidence(input, TITLE, s));
    if (purpose) { p.purpose = join(purpose.text); p.evidence.push(evidence(input, purpose.text, s + purpose.at)); }
    if (activities) { p.activities = join(activities.text); p.evidence.push(evidence(input, activities.text, s + activities.at)); }
    p.warnings.push('加美町「Ｒ１ 事務事業評価シート」の文章欄を収録。補助金の様式は「２ 事務事業（補助金）の目的」を目的に、一般・施設の様式は'
      + '「■この事業によって対象をどうしたいのか」を目的、「■町がどのようなことを行ったか」を事業内容にした（2列の本文が空行で区切られた2段落として出たものに限り、左列・右列の順とみなした）。PDFの折り返しの改行を除いた（最長行が30字未満の欄は改行を残した）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '加美町 Ｒ１ 事務事業評価シート: 補助金様式の「事務事業（補助金）の目的」、一般・施設様式の「この事業によって対象をどうしたいのか」（目的）と「町がどのようなことを行ったか」（事業内容）。',
};
