import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 足立区（令和8年度 事務事業評価調書、令和7年度事業実施分）
// 公開済みレコードは同じ事務事業評価調書から作られ、目的・内容が空欄。「事務事業の概要」の「目的」「内容」欄は、
// 縦書きのラベル（事・目・務・的・事の・・・業概内・要容）と右の「協働・協創」欄（協・働・創と、その内容）が行の間に挟まる。
// ラベルの並びが決まった形のものだけを扱い、目的は「事の」の行まで、内容は「・」の行の後とする。右の欄の内容が
// 単独の行として挟まると見分けられないため、欄の文は全幅で折り返された行が句点で終わるまでとし、その後に続く行は
// 右の欄の幅（全角20字以下）で句点で終わらないものだけ（右の欄の続き）である場合のみ採る。
const HEAD = /令和８年度事務事業評価調書\(令和７年度事業実施分\)\n\n事務事業名 (\d+) ([^\n]+)\n施 策 名 [^\n]*\n記 入 所 属 ([^\n]+)\n電 話 番 号[^\n]*\nE - m a i l [^\n]*\n/g;
const LABELS = ['事', '目', '務', '的', '事の', '・', '業概内', '要容'];
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

/** 欄の行（右の欄の語を除いたもの）。全幅で折り返されて句点で終わる最初の段落だけをつないで返す。 */
function field(lines: string[]): string | null {
  const k = lines.findIndex(l => l.endsWith('。'));
  if (k < 0) return null;
  // 句点の後の行は右の欄の続きであること（欄内の改行の後の文や、別の段落なら採らない）。
  if (!lines.slice(k + 1).every(l => width(l) <= 20 && !l.endsWith('。'))) return null;
  const body = lines.slice(0, k + 1), full = Math.max(...body.map(width));
  if (body.length > 1 && full < 30) return null;
  // 途中の行が全幅でないときは、右の欄の文が単独の行として挟まった可能性がある。
  if (!body.slice(0, -1).every(l => width(l) >= full - 2)) return null;
  return body.join('');
}

function sheet(input: CachedInput, h: RegExpMatchArray, block: string, at: number): ProjectEvaluation | null {
  const lines = block.split('\n');
  // ラベルの行がこの順に1回ずつ現れること。
  const pos = LABELS.map(l => lines.indexOf(l));
  if (pos.some((p, i) => p < 0 || (i && p <= pos[i - 1])) || LABELS.some(l => lines.filter(x => x === l).length !== 1)) return null;
  // 1行目は目的の1行目で、右の欄のラベル「協」がその行末か次の行頭に付く。
  if (pos[0] > 2 || !(/ 協(?: |$)/.test(lines[0]) || (pos[0] === 2 && /^協(?: |$)/.test(lines[1])))) return null;
  // 行末に付いた右の欄（ラベルの協・働・創とその内容）を外す。ラベルで始まる行は右の欄だけの行。
  const strip = (l: string) => l.replace(/ [協働創](?: .*)?$/, '');
  const skip = (l: string) => /^[協働創](?: |$)/.test(l) || LABELS.includes(l);
  const purpose = field(lines.slice(0, pos[4]).filter(l => !skip(l)).map(strip));
  const activities = field(lines.slice(pos[5] + 1).filter(l => !skip(l)).map(strip));
  if (!purpose && !activities) return null;
  // IDは公開済みレコード（同じ資料・同じ番号）と別にする（同じIDのシートは補強の対象外になるため）。
  const p = project(input, `${h[1]}:narrative`, h[2].trim(), 2026, h[0].trimEnd(), h.index!);
  p.projectCode = h[1];
  p.evaluatedFiscalYear = 2025;
  p.department = h[3].trim();
  p.purpose = purpose;
  p.activities = activities;
  p.evidence.push(evidence(input, block, at));
  p.warnings.push('事務事業評価調書の「事務事業の概要」の目的・内容欄。縦書きのラベルと協働・協創欄の語を除き、全幅で折り返された行が句点で終わるもののみ。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13121' || !/\/documents\/33844\/r8jimujigyou_\d\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(HEAD)) {
    const at = h.index! + h[0].length, end = t.indexOf('\n根 拠', at);
    if (end < 0 || end - at > 2000) continue;
    const p = sheet(input, h, t.slice(at, end), at);
    if (p) out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '足立区 令和8年度 事務事業評価調書（令和7年度事業実施分）: 事務事業の概要の目的・内容（目的・事業内容）。',
};
