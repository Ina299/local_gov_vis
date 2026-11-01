/** 豊後大野市 (44212): 令和７年度決算 事務事業評価調書の「＜事業の目的＞」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ評価調書から作られ（事業番号-枝番・実施計画事業名、令和7年度決算）、目的が空欄。
// 「Ａ 事業目的・内容・実績」欄は左列（事業の目的と内容）と右列（主な活動実績・事業費の表）が同じ行に並んで抽出される。
// 左列は全角20文字（表示幅40）で折り返すため、「＜事業の目的＞」の見出し行の次の行から、行頭の空白までの部分が表示幅40の行が続き、
// 最後の行の行頭部分が「。」で終わる段落だけを目的として採る（表示幅が40に満たないのに「。」で終わらない行があれば採らない）。
// 右列の活動実績・左列の取組内容は行の対応が確定しないため対象外。
const HEAD = /\n(\d{4,5}) (\d+) （ 令和 7 年 度 決 算 \) 事 務 事 業 評 価 調 書 /g;
const width = (s: string) => [...s].reduce((a, c) => a + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 1 : 2), 0);

function purpose(sheet: string): { text: string; parts: { s: string; at: number }[] } | null {
  const a = sheet.indexOf('\n＜事業の目的＞');
  if (a < 0 || sheet.indexOf('\n＜事業の目的＞', a + 1) >= 0) return null;
  let pos = sheet.indexOf('\n', a + 1) + 1;
  const parts: { s: string; at: number }[] = [];
  while (pos > 0 && pos < sheet.length) {
    const end = sheet.indexOf('\n', pos), line = sheet.slice(pos, end < 0 ? undefined : end);
    const sp = line.indexOf(' '), left = sp < 0 ? line : line.slice(0, sp);
    if (!left || left.startsWith('＜')) return null;
    parts.push({ s: left, at: pos });
    pos = end + 1;
    if (left.endsWith('。')) {
      // 句点の行の次が左列幅いっぱいの行か句点で終わる行なら、段落が続くのか右列なのか確定しないため採らない。
      const next = sheet.slice(pos, sheet.indexOf('\n', pos)).split(' ')[0];
      if (width(next) === 40 || next.endsWith('。')) return null;
      break;
    }
    if (width(left) !== 40) return null;
    if (parts.length > 12) return null;
  }
  if (!parts.length || !parts[parts.length - 1].s.endsWith('。')) return null;
  return { text: parts.map(p => p.s).join('\n'), parts };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '44212' || input.format !== 'pdf') return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const s = h.index! + 1, sheet = t.slice(s, heads[i + 1]?.index ?? t.length);
    const nm = /\n事 業 .*? 実施計画事業 (\S+) /.exec(sheet);
    const found = nm && purpose(sheet);
    if (!nm || !found) return;
    const p = project(input, `${h[1]}-${h[2]}:purpose`, nm[1], null, nm[1], s + nm.index! + nm[0].lastIndexOf(nm[1]));
    p.evaluatedFiscalYear = 2025;
    p.purpose = found.text;
    for (const part of found.parts) p.evidence.push(evidence(input, part.s, s + part.at));
    p.warnings.push('事務事業評価調書の「＜事業の目的＞」の段落（左列）を目的として収録。右列と同じ行に並ぶため、左列の折り返し幅（全角20文字）で区切れる行だけをつないだ（各行の原文を出典に記録）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '豊後大野市 令和７年度決算 事務事業評価調書の「＜事業の目的＞」（目的）。右列と同じ行に並ぶ左列の段落を折り返し幅で区切れる場合に限る。活動実績・取組内容は行の対応が確定しないため対象外。',
};
