import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 入間市（令和２年度 事務事業評価シート（令和元年度分）、目的・全体の事業内容）
// 公開済みレコードは事業ごとのPDF（material/files/group/5/<整理番号>.pdf）の一般用シートから作られている（評価年度2020・対象年度2019）。
// 「２ 事務事業の目的・内容」の欄見出し（対象・目的・実施の根拠など）は抽出テキストで1字ずつの行や本文の途中の行になるため、
// 見出しの行を除いて空行区切りの塊で読む。「全体の事業」の見出しを含む塊を全体の事業内容とし、その直前の内容のある塊の末尾の段落を目的とする。
// 目的の段落は句点で終わる行までで、途中の行はすべて欄の幅いっぱい（45字以上）の折り返しか、①②…の箇条の区切りであること。段落の前の行（対象・実施の根拠）は
// 欄が狭く短いので、30字未満であることを確かめて境界とする。目的の欄は対象・根拠の欄より幅が広いことによる区別で、満たさない版は採らない。
// 公共事業用シート（見出しが本文の行頭に混ざる）は対象外。
const HEAD = /^令和 ?(\d+)年度 事務事業評価シート \(令和 ?(\d+|元)年度分\)\n/;
const LABEL = /^(対|象|目|的|（もたらそうと|する成果）|実施の根拠|（法令・条例等）|内 容|実施の根拠 （法令・条例等）)$/;
const WIDE = 45, NARROW = 30;
const CIRCLED = /^[①-⑳]/;
/** 箇条・番号の行の始まり（この行の前の改行は残す）。 */
const MARK = /^([①-⑳・※●○◎■□]|[0-9０-９]+[).）．.]|[（(][0-9０-９]+[）)])/;
/** 欄の幅いっぱい（WIDE字以上）の行の後の改行だけを除く。箇条の行の前の改行は残す。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].length >= WIDE && !MARK.test(l) ? '' : '\n') + l, '');

interface Line { text: string; at: number }

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11225' || input.format !== 'pdf' || !/\/material\/files\/group\/5\/\d{6}-\d{2}-\d{2}\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text, h = HEAD.exec(t);
  if (!h) return [];
  // 事務事業名は見出しの次の空行の後か、見出しがまとめて出力された版では「事務分類」の後（次の行が「施策の大網」）にある。
  const name = /\n事務事業名\n\n([^\n]+)\n/.exec(t) ?? /\n事務分類\n\n([^\n]+)\n施策の大網 /.exec(t);
  const a = t.indexOf('\n２ 事務事業の目的・内容\n'), b = t.indexOf('\n３ 事務事業の実施状況と成果\n');
  if (!name || a < 0 || b < a || t.indexOf('\n２ 事務事業の目的・内容\n', a + 1) >= 0) return [];
  // 欄の行を空行区切りの塊にする（見出しだけの行は除く）。
  const blocks: Line[][] = [[]];
  let pos = a + '\n２ 事務事業の目的・内容\n'.length;
  while (pos < b) {
    const nl = t.indexOf('\n', pos), line = t.slice(pos, nl);
    if (!line.trim()) { if (blocks[blocks.length - 1].length) blocks.push([]); }
    else if (!LABEL.test(line.trim())) blocks[blocks.length - 1].push({ text: line, at: pos });
    pos = nl + 1;
  }
  const filled = blocks.filter(x => x.length);
  const act = filled.findIndex(x => x.some(l => /^全体の事業( |$)/.test(l.text)));
  if (act < 1 || filled.filter(x => x.some(l => /^全体の事業( |$)/.test(l.text))).length !== 1) return [];
  // 全体の事業内容の後は「2022」（帳票の印字）だけ。
  if (filled.slice(act + 1).some(x => !(x.length === 1 && /^\d{4}$/.test(x[0].text.trim())))) return [];

  // 目的: 直前の塊の末尾の段落（①②…の箇条なら①の行から）。
  const pb = filled[act - 1], len = (i: number) => pb[i].text.trim().length;
  let s = pb.length - 1;
  if (!pb[s].text.trim().endsWith('。')) return [];
  while (s > 0 && (len(s - 1) >= WIDE || (CIRCLED.test(pb[s].text.trim()) && !/^①/.test(pb[s].text.trim())))) s--;
  if (pb.slice(s, -1).some((l, i) => l.text.trim().length < WIDE && !CIRCLED.test(pb[s + i + 1].text.trim()))) return [];
  if (CIRCLED.test(pb[s].text.trim()) !== /^①/.test(pb[s].text.trim())) return [];
  if (s > 0 && len(s - 1) >= NARROW) return [];
  // 段落が塊の先頭から始まる場合、前の塊の末尾が幅いっぱいなら段落が空行をまたいで続いているおそれがある。
  const prev = filled[act - 2];
  if (s === 0 && prev && prev[prev.length - 1].text.trim().length >= NARROW) return [];
  const run = pb.slice(s), purpose = join(run.map(l => l.text.trim()));
  if (/[\d,]+ ?(千円|円)$|事業内容|全体の事業/.test(purpose) || purpose.length < 10) return [];
  const pRaw = t.slice(run[0].at, run[run.length - 1].at + run[run.length - 1].text.length);

  // 全体の事業内容: 見出し「全体の事業」を除いて欄の幅での折り返しをつなぐ。
  const ab = filled[act];
  const lines = ab.map(l => l.text.replace(/^全体の事業 ?/, '').trim()).filter(Boolean);
  const aRaw = t.slice(ab[0].at, ab[ab.length - 1].at + ab[ab.length - 1].text.length);
  const activities = lines.length && !lines.some(l => /^[\d,.\s-]+$/.test(l)) ? join(lines) : null;

  const year = 2018 + Number(h[1]), fy = h[2] === '元' ? 2019 : 2018 + Number(h[2]);
  const p = project(input, `narrative:${name[1].trim()}`, name[1].trim(), year, name[0].slice(1, -1), name.index + 1);
  p.projectCode = null; p.evaluatedFiscalYear = fy;
  p.purpose = purpose;
  p.activities = activities;
  p.evidence.push(evidence(input, h[0].slice(0, -1), 0), evidence(input, pRaw, run[0].at));
  if (activities) p.evidence.push(evidence(input, aRaw, ab[0].at));
  p.warnings.push('入間市 事務事業評価シート「２ 事務事業の目的・内容」の「目的（もたらそうとする成果）」欄を目的、「全体の事業内容」欄を事業内容として収録。'
    + '欄見出しの行が本文の途中に出力されるため見出しの行を除き、目的は欄の幅いっぱいの折り返しだけをつないだ段落（前の行が対象・根拠の狭い欄の行であるもの）に限る。');
  return [p];
}

export const entry = {
  extract,
  scope: '入間市 令和２年度 事務事業評価シート（令和元年度分、事業ごとのPDF・一般用）: 「目的（もたらそうとする成果）」・「全体の事業内容」欄。公共事業用シートは対象外。',
};
