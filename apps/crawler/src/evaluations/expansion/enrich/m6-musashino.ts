import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m6-util';

// ---------------------------------------------------------------- 武蔵野市（令和8年度 事務事業評価シート、評価対象年度 令和7年度）
// 公開済みレコード（款別PDF R8_01〜09 の事務事業評価シート）の「事業の目的（施策の目的を受けて事業として達成したい成果）」と
// 「事業概要等」。欄の左のラベルは3行（「（施策の目的を受」「けて事業として達」「成したい成果）」）で、目的は次の形に限る。
//   A: 3行のラベルが単独の行で、2行目と3行目の間に目的の行がある
//   B: ラベルの1・2行目の後に目的の行が続き（「（施策の目的を受 …」「けて事業として達 …」）、3行目が単独の行
// いずれも目的の最後の行が句点で終わる場合だけ（長い目的はラベルの3行目の後にも続くため）。事業概要等は「成したい成果）」の行から
// 「■実績と成果」までで、ラベル「事業概要等」（単独の行か行頭）の前後の行数の差が1行以内（ラベルが欄の縦中央にある）の場合だけ。
// 空行で区切られた様式（R8_10〜13）は欄の行の並びが崩れるため対象外。実績と成果は欄の境（実績→成果）が行から決まらないため採らない。
const HEAD = /事務事業評価シート （評価対象年度：令和 (\d+) 年度）\n/g;
const L1 = '（施策の目的を受', L2 = 'けて事業として達', L3 = '成したい成果）', LA = '事業概要等';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13203' || !/\/R8_0\d\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /\n事業名 (.+?) 所管課 ([^\n]+)\n/.exec(seg);
    const a = seg.indexOf('\n事業の目的\n'), b = seg.indexOf('\n■実績と成果\n', a);
    if (h[1] !== '7' || !name || a < 0 || b < 0 || seg.indexOf('\n事業の目的\n', a + 1) >= 0) continue;
    const lines = seg.slice(a + '\n事業の目的\n'.length, b).split('\n');
    if (lines.some(l => !l.trim())) continue;
    const h3 = lines.indexOf(L3);
    if (h3 < 2) continue;
    let purpose: string[] | null = null;
    if (h3 > 2 && lines[0] === L1 && lines[1] === L2) purpose = lines.slice(2, h3);
    else if (h3 === 2 && lines[0].startsWith(L1 + ' ') && lines[1].startsWith(L2 + ' ')) purpose = [lines[0].slice(L1.length + 1), lines[1].slice(L2.length + 1)];
    const rest = lines.slice(h3 + 1), at = rest.findIndex(l => l === LA || l.startsWith(LA + ' '));
    let activities: string[] | null = null;
    if (at >= 0 && rest.filter(l => l === LA || l.startsWith(LA + ' ')).length === 1) {
      const before = at, after = rest.length - at - 1;
      if (Math.abs(before - after) <= 1) activities = rest.flatMap(l => (l === LA ? [] : l.startsWith(LA + ' ') ? [l.slice(LA.length + 1)] : [l]));
    }
    if (!purpose || !purpose.at(-1)!.endsWith('。')) purpose = null;
    if (!activities?.length) activities = null;
    if (!purpose && !activities) continue;
    const p = project(input, `${name[1]}:narrative`, name[1], null, name[0].slice(1, -1), start + name.index! + 1);
    p.evaluatedFiscalYear = 2025;
    p.department = name[2];
    if (purpose) p.purpose = unwrap(purpose.join('\n'), 60);
    if (activities) p.activities = unwrap(activities.join('\n'), 60);
    p.evidence.push(evidence(input, seg.slice(a + 1, b), start + a + 1));
    p.warnings.push('事務事業評価シート（評価対象年度：令和7年度）の「事業の目的」「事業概要等」欄。欄の左のラベル（「（施策の目的を受」「けて事業として達」「成したい成果）」「事業概要等」）を除き、欄の幅（約70字）いっぱいで折り返した改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '武蔵野市 令和8年度 事務事業評価シート（評価対象年度 令和7年度、款別PDF R8_01〜09）: 事業の目的（目的）・事業概要等（事業内容）。ラベルとの行の並びが確定する事業のみ。実績と成果は欄の境が決まらないため対象外。',
};
