import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 太田市（市議会 政策評価・事務事業評価シート、1資料1事業）
// 公開済みレコードは同じシート（uploaded/attachment/9567〜9578.pdf）から作られ、年度を持たない。事業名は公開済みレコードと同じく
// 資料ごとに対応表で与える。「事業評価チェック表」の「・ねらい」欄を目的、「・事業の概要」欄を事業内容として取る。
// 見出しが縦に並んで本文がまとめて後に出力される票（見出しの直後が次の見出し、または欄の間に PLAN/DO の縦書きの文字が挟まる）は、
// 本文の区切りが並び順でしか決まらないため採らない。「・事業実績」は表や別紙参照が多く欄の区切りも不定のため取らない。
const NAMES: Record<string, string> = {
  '9567': 'おおた市民債発行事業', '9568': 'おおたスポーツアカデミー運営委託事業', '9569': '一般介護予防事業', '9570': '太田市金券取扱事務事業',
  '9571': '市政情報発信事業', '9572': '中・高年齢者生き甲斐づくり推進事業', '9573': 'こどもプラッツ推進事業',
  '9574': 'おおた芝桜まつり・イルミネーション運営業務委託事業', '9575': '収納対策事業', '9576': 'おおたん教育支援隊事業',
  '9577': '太陽光発電システム導入報奨金事業', '9578': '八王子山公園(墓所増設)整備事業',
};
const FILE = /^https:\/\/www\.city\.ota\.gunma\.jp\/uploaded\/attachment\/(95(?:6[7-9]|7[0-8]))\.pdf$/;
/** 欄の左の縦書きの PLAN・DO・CHECK の1文字の行 */
const MARGIN = /^[ＰＬＡＮＤＯＣＨＥＫ]$/;

/** 全角2・半角1で数えた行の幅。 */
const width = (s: string) => [...s].reduce((w, c) => w + (/[\u0000-ÿ｡-ﾟ]/.test(c) ? 1 : 2), 0);
/** 欄の幅（全角約60字）まで埋まった行の後の折り返しの改行だけ除く（句点で終わる行・短い行の後、箇条の行頭の前の改行は残す）。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) =>
  acc + (i === 0 ? '' : /。$/.test(lines[i - 1]) || width(lines[i - 1]) < 100 || /^[・①-⑳●（(]/.test(l) ? '\n' : '') + l, '');

/** 見出し（行頭）から次の見出しまでの欄。見出しが1回だけ出て、本文があり、縦書きの文字の扱いが条件に合うときだけ返す。 */
function field(t: string, label: string, next: string, allowMargin: boolean): { raw: string; at: number; text: string } | null {
  const re = new RegExp(`(?<=^|\\n)${label}(?: |\\n)`, 'g'), hits = [...t.matchAll(re)];
  if (hits.length !== 1) return null;
  // 見出しの直後が次の見出しのとき（改行を見出しの区切りとして読んだ位置）も次の見出しとして見つける
  const from = hits[0].index! + label.length + 1, to = t.indexOf(`\n${next}`, from - 1);
  if (to < from || t.indexOf(`\n${next}`, to + 1) >= 0) return null;
  const raw = t.slice(from, to).replace(/\n+$/, '');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (!allowMargin && lines.some(l => MARGIN.test(l))) return null;
  const body = lines.filter(l => !MARGIN.test(l));
  if (!body.length || body.some(l => /^・(?:事業の概要|ねらい|予算|事業実績)/.test(l))) return null;
  return { raw, at: from, text: join(body) };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  const file = FILE.exec(input.sourceUrl);
  if (input.municipalityCode !== '10205' || input.format !== 'pdf' || !file) return [];
  const t = input.text, at = t.indexOf('事業評価チェック表');
  const name = NAMES[file[1]];
  if (!name || at < 0 || t.indexOf('事業評価チェック表', at + 1) >= 0) return [];
  const p = project(input, `narrative:${file[1]}`, name, null, '事業評価チェック表', at);
  p.projectCode = null;
  // 概要の欄は左の縦書きの文字（PLAN/DO）が本文の前に挟まることがあるため除く。ねらいの欄に挟まる票は見出しの縦並びなので採らない。
  const summary = field(t, '・事業の概要', '・ねらい', true), aim = field(t, '・ねらい', '・予算', false);
  if (aim) { p.purpose = aim.text; p.evidence.push(evidence(input, aim.raw, aim.at)); }
  if (summary) { p.activities = summary.text; p.evidence.push(evidence(input, summary.raw, summary.at)); }
  if (!aim && !summary) return [];
  p.warnings.push('太田市議会 政策評価・事務事業評価シートの「事業評価チェック表」のうち「・ねらい」欄を目的、「・事業の概要」欄を事業内容として収録'
    + '（見出しの直後に本文が続く票のみ。左の縦書きの PLAN/DO の文字は除いた）。欄の幅での折り返しの改行を除いた。年度は公開済みレコードと同じく未設定。');
  return [p];
}

export const entry = {
  extract,
  scope: '太田市議会 政策評価・事務事業評価シート（1資料1事業）: 「・ねらい」欄（目的）と「・事業の概要」欄（事業内容）。見出しの直後に本文が続く票のみ。年度なしの公開済みレコードと同じPDFに限る。',
};
