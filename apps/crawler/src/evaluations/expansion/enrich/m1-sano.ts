import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 佐野市（仕事の振り返りシート（令和7年度実施分））
// 公開済みレコードは同じシートの事業名・担当課・事業費計・効果指標から作られ、文章の欄は未収録だった。
// 目的: 「（２）目的」の欄。ラベル「目的／(本事業に／よって成し／遂げたい／状態)」の5行が崩れずに並ぶシートに限り、ラベルの後、
//   「３．前年度の実績（活動及び費用対効果）説明」の見出しの直前の段落を目的とする（目標値の表の列はラベルとこの段落の間に出る）。
//   ラベルの行の間に本文が割り込んだシート（目標値の指標名と同じ行に並ぶもの）は対応が崩れているため除く。
// 事業内容: 「（１）事業概要」の欄（「（２）目的」の前まで）。欄の見出し「事業概要」は1回だけ（行頭の「事業概要 」か単独の行）で、それを除いた本文。
// 成果: 「（３）活動による効果」の効果説明。抽出テキストでは「（４）事業効果を説明する数値データの推移」の表の後、「（５）目標達成、効果、
//   費用増減（自動判定）」の見出しの直前の段落に出る。「。」で終わる文章のみ。
// どの段落も、半角空白（別の列の語が同じ行に並んだもの）、数値・単位だけの行、表やラベルの語を含むものは除く。
const TITLE = '仕事の振り返りシート（令和7年度実施分）\n';
const NAME = [/^事業名 ([^\n]+)\n/, /^事業名\n\n([^\n]+)\n\n/, /^実施計画事業or一般事業[^\n]*\n事業名 ([^\n]+)\n/];
const DEPT = /\n([^\n]*(?:部|本部|局|委員会))\n部\n担当組織 課\n([^\n]+)\n/;
const LABEL = '\n目的\n(本事業に\nよって成し\n遂げたい\n状態)\n';
const RESULTS = '\n\n３．前年度の実績（活動及び費用対効果）説明\n';
const EFFECT_TABLE = '\n（４）事業効果を説明する数値データの推移\n', JUDGE = '\n\n（５）目標達成、効果、費用増減（自動判定）\n';
const NOISE = / |↓|値が|単位|後期計画|^目的$|本事業に|状態\)|活動実績|効果指標|効果説明|事業概要|（[１-９\d]）|^R\d+$/m;
const UNIT_LINE = /^(?:[\d,.\-%％〇×]+|件|人|回|％|%|社|千円|万円|効果が上がった|効果は変わらない|効果が下がった)$/;
const prose = (s: string) => s.length >= 6 && !NOISE.test(s) && !s.split('\n').some(l => UNIT_LINE.test(l));
/**
 * 目的の位置に出た段落が指標名（目標値・数値データの表の項目）か、指標名が混ざったものか。表の項目は（３）〜（５）の範囲に
 * 繰り返し出るため、段落以外のその範囲の行と含む・含まれるの関係にある行があれば指標名とみなす（同じ文の再掲である完全一致は除く）。末尾が数・率・割合の段落も除く。
 */
function indicatorLike(text: string, rest: string): boolean {
  if (/(?:割合|数|率)(?:（[^）]*）)?$/.test(text)) return true;
  const from = rest.indexOf('（３）目標値'), to = rest.indexOf('（５）目標達成');
  if (from < 0) return true;
  const names = rest.slice(from, to > from ? to : undefined).split('\n').map(l => l.trim())
    .filter(l => l.length >= 5 && /[぀-鿿]/.test(l) && !/^(?:（[１-９]）|値が|↓|後期計画|過去比較|効果指標|活動指標|事業費計|一般財源|特定財源|（うち)/.test(l));
  return text.split('\n').some(l => l.length >= 5 && names.some(n => n !== l && (l.includes(n) || n.includes(l))));
}
/** [from, to) の最後の段落（空行で区切られた塊）とその開始位置。 */
function lastParagraph(sheet: string, from: number, to: number): { text: string; at: number } {
  const body = sheet.slice(from, to), cut = body.lastIndexOf('\n\n');
  const at = cut < 0 ? 0 : cut + 2, text = body.slice(at);
  const lead = text.length - text.replace(/^\n+/, '').length;
  return { text: text.slice(lead), at: from + at + lead };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09204' || !input.text.startsWith(TITLE)) return [];
  const t = input.text, starts: number[] = [];
  for (let i = t.indexOf(TITLE); i >= 0; i = t.indexOf(TITLE, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const body = s + TITLE.length, sheet = t.slice(body, starts[k + 1] ?? t.length);
    if (input.truncated && k === starts.length - 1) return;
    const m = NAME.map(re => sheet.match(re)).find(Boolean);
    if (!m) return;
    const name = m[1].trim();
    if (!name || /実施計画事業or一般事業|市長公約|基本情報/.test(name)) return;
    const d = sheet.match(DEPT), dept = d ? d[2].trim() : null;
    let purpose: { text: string; at: number } | null = null, content: { raw: string; text: string; at: number } | null = null, effect: { text: string; at: number } | null = null;
    const l = sheet.indexOf(LABEL), h = sheet.indexOf(RESULTS);
    if (l >= 0 && h > l && sheet.indexOf(LABEL, l + 1) < 0 && sheet.indexOf(RESULTS, h + 1) < 0) {
      const para = lastParagraph(sheet, l + LABEL.length, h);
      if (prose(para.text) && !indicatorLike(para.text, sheet.slice(0, para.at) + sheet.slice(para.at + para.text.length))) purpose = para;
    }
    const a = /\n（１）事業概要\n((?:[^\n]*\n)+?)（２）目的\n/.exec(sheet);
    if (a && (a[1].match(/^事業概要(?: |$)/gm) ?? []).length === 1) {
      const raw = a[1].replace(/\n+$/, ''), text = raw.replace(/^事業概要(?: |\n+)/m, '').trim();
      if (prose(text) && !text.includes('\n\n')) content = { raw, text, at: a.index! + '\n（１）事業概要\n'.length };
    }
    const f = sheet.indexOf(EFFECT_TABLE), g = sheet.indexOf(JUDGE);
    if (f >= 0 && g > f && sheet.indexOf(JUDGE, g + 1) < 0) {
      const para = lastParagraph(sheet, f, g);
      if (prose(para.text) && /。$/.test(para.text) && para.text !== purpose?.text) effect = para;
    }
    if (!purpose && !content && !effect) return;
    const p = project(input, `${name}\n${dept ?? ''}|narrative`, name, null, t.slice(s, body + m[0].trimEnd().length), s);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2025;
    if (d) { p.department = dept; p.evidence.push(evidence(input, d[0].slice(1, -1), body + d.index! + 1)); }
    if (purpose) { p.purpose = unwrap(purpose.text); p.evidence.push(evidence(input, purpose.text, body + purpose.at)); }
    if (content) { p.activities = unwrap(content.text); p.evidence.push(evidence(input, content.raw, body + content.at)); }
    if (effect) { p.outcomes = unwrap(effect.text); p.evidence.push(evidence(input, effect.text, body + effect.at)); }
    p.warnings.push('佐野市「仕事の振り返りシート（令和7年度実施分）」の「（２）目的」を目的に、「（１）事業概要」を事業内容に（欄の見出し「事業概要」は除く）、'
      + '「（３）活動による効果」の効果説明を成果に収録（折り返しの改行は除去）。目的の欄のラベルの行の間に本文が割り込んだシートや、別の列の語が同じ行に並んだ段落は収録しない。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '佐野市 仕事の振り返りシート（令和7年度実施分）の「（２）目的」「（１）事業概要」「（３）活動による効果（効果説明）」の文章（段組みが崩れていないものだけ）。',
};
