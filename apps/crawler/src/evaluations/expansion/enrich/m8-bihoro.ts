/**
 * 01543 美幌町: 事務事業評価調書（１次評価調書、令和3〜6年度）。公開済みレコード（同じ調書の個票）の空欄の
 * 目的（「事業目的」欄）、事業内容（「事業概要」欄）、成果（「実施結果」欄）を補う。
 * 抽出テキストでは欄の見出しと内容の並びが個票ごとに違うため、次の並びのときだけ採る:
 *   経費区分の値 → 概要の行 → 「事 業 概 要」 → 目的の行 → 「事 業 目 的」/空行＋対象/「事業の対象 …」 → 【実施結果】
 * （見出しが内容より前にまとめて出る個票は、概要と目的の境目が本文で決まらないため採らない）
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

const SHEET = /^令和[０-９\d]+年度\n\n事務事業評価調書\n/gm;
const LABEL = /事 業|事業の対象|事 務|【|】|経費区分|^・$/;
const reiwa = (s: string) => 2018 + Number(s.normalize('NFKC'));

/** 段落として閉じている（句点・括弧で終わる、または欄の幅に満たない行で終わる）。欄からはみ出して切れた文を除く。 */
function closed(lines: string[]): boolean {
  const last = lines[lines.length - 1].trim();
  return /[。）)]$/.test(last) || last.length < 46;
}
/** 欄の幅（54字前後）いっぱいの行の後の改行は折り返しとして除く。 */
function join(lines: string[]): string {
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].trim().length >= 50 && !/[。]$/.test(lines[i - 1].trim()) ? '' : '\n') + l.trim(), '');
}
const linesOf = (s: string) => s.replace(/\n$/, '').split('\n');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01543') return [];
  const title = /^令和([０-９\d]+)年度事務事業評価調書\n（１次評価調書）/.exec(input.text);
  if (!title) return [];
  const year = reiwa(title[1]), text = input.text, out: ProjectEvaluation[] = [];
  const starts = [...text.matchAll(SHEET)].map(m => m.index!);
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const raw = text.slice(s, starts[i + 1] ?? text.length);
    // 事業名・所管は公開済みレコードと同じ取り方（batch7 g3-hokkaido の美幌町）。
    const nm = /課・グループ名\n\n([^\n]+)\n/.exec(raw);
    if (!nm || /^(?:評 価 者 名|[０-９\d]|総 |予$)/.test(nm[1]) || nm[1].length > 40) return;
    const dm = /\n([^\s\n]+課[^\s\n]*グループ)\n/.exec(raw);
    const k = /\n経費区分\n\n(?:政策的経費|投資的経費|経常的経費)\n\n((?:[^\n]+\n)+?)事 業 概 要\n\n/.exec(raw);
    let summary: { lines: string[]; at: number } | null = null, purpose: { lines: string[]; at: number } | null = null;
    if (k) {
      const sl = linesOf(k[1]), restAt = k.index! + k[0].length, rest = raw.slice(restAt);
      let pm: RegExpExecArray | null, pAt = 0;
      if ((pm = /^((?:[^\n]+\n)+?)事 業 目 的\n(?:[^\n]+\n){1,2}【実施結果】\n/.exec(rest))) pAt = 0;
      else if ((pm = /^事 業 目 的\n\n((?:[^\n]+\n)+)\n(?:[^\n]+\n){1,2}【実施結果】\n/.exec(rest))) pAt = '事 業 目 的\n\n'.length;
      else if ((pm = /^((?:[^\n]+\n)+?)事業の対象 [^\n]+\n【実施結果】\n/.exec(rest))) pAt = 0;
      if (pm && !sl.some(l => LABEL.test(l)) && closed(sl)) {
        const pl = linesOf(pm[1]);
        summary = { lines: sl, at: s + k.index! + k[0].length - k[1].length - '事 業 概 要\n\n'.length };
        if (!pl.some(l => LABEL.test(l)) && closed(pl)) purpose = { lines: pl, at: s + restAt + pAt };
      }
    }
    // 実施結果: 見出しと同じ1行に収まるものだけ（2行以上は「・ 現状と課題」の見出しと交互に出て、欄からはみ出した文が切れる）。
    const rm = /\n実 施 結 果 ([^\n]+)\n・\n現状と課題 【現状と課題】\n/.exec(raw);
    const result = rm && closed([rm[1]]) && !LABEL.test(rm[1]) ? { lines: [rm[1]], at: s + rm.index! + '\n実 施 結 果 '.length } : null;
    if (!purpose && !summary && !result) return;
    const name = nm[1].trim(), nameAt = s + nm.index! + '課・グループ名\n\n'.length;
    const p = project(input, `narrative-${s}`, name, year, nm[1], nameAt);
    p.id = stableId(input, `narrative-${s}`, year);
    p.projectCode = null;
    p.department = dm?.[1] ?? null;
    if (dm) p.evidence.push(evidence(input, dm[1], s + dm.index! + 1));
    p.evidence.push(evidence(input, title[0], 0));
    const put = (b: { lines: string[]; at: number }) => { p.evidence.push(evidence(input, b.lines.join('\n'), b.at)); return join(b.lines); };
    if (purpose) p.purpose = put(purpose);
    if (summary) p.activities = put(summary);
    if (result) p.outcomes = put(result);
    p.warnings.push('美幌町 事務事業評価調書（１次評価調書）の文章欄から、目的（「事業目的」）、事業内容（「事業概要」）、成果（「実施結果」）を原文のまま収録。'
      + '欄の見出しが概要と目的の間にある個票だけを対象とし、欄の幅で折り返した改行だけを除いた。実施結果は1行に収まるものだけ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '美幌町 事務事業評価調書（１次評価調書、令和3〜6年度）の文章欄: 事業目的・事業概要・実施結果（1行のもの）。見出しが内容の前にまとまって出る個票は概要と目的の境目が決まらないため対象外。',
};
