import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 美郷町（教育委員会 平成27年度 事業評価シート）
// 公開済みレコードは同じ事業評価シートから作られ、事業の効果等はあるが目的・事業内容が空。「事業の目的」「事業の内容」の欄は
// 見出しと同じ行に1行で出力されるか、2行の欄で見出しが2行の間に単独で出力される。目的と内容の欄の行が続けて出力される
// シートがあるため、次の形に限る:
// - 目的: 「事業の目的 文」の1行の直後が「事業の内容 」の行、または（施策名の行の直後の）欄幅いっぱいの1行・「事業の目的」・
//   句点で終わる1行の直後が「事業の内容 」の行（2行をつなぐ）。
// - 事業内容: 上の形で目的が取れたシートで、続く「事業の内容 文」の1行の直後が「事業の対象 」の行（前の行が内容の欄の
//   1行目である形と区別するため、目的の欄の直後に限る）。
const SHEET = /^事業評価シート\n(?:事務事業名 (.+?) 担当課名 (\S+)|([^\n]+)\n事務事業名 担当課名 (\S+))\n/gm;
const PURPOSE1 = /\n施策名\n[^\n]+\n事業の目的 ([^\n]+)\n事業の内容 /;
const PURPOSE2 = /\n施策名\n[^\n]+\n(([^\n]{30,})\n事業の目的\n([^\n]+。))\n事業の内容 /;
const CONTENT = /^([^\n]+)\n事業の対象 /;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05434' || !/\/archive_0000001622_00\/6206download\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, sheets = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  const year = /^平成２７年度\n事業評価シート$/m;
  sheets.forEach((s, i) => {
    if (input.truncated && i === sheets.length - 1) return;
    const start = s.index!, seg = t.slice(start, sheets[i + 1]?.index ?? t.length);
    const before = t.slice(Math.max(0, start - 7), start + '事業評価シート'.length);
    if (!year.test(before)) return;
    const name = (s[1] ?? s[3]).trim();
    const p = project(input, `H27:${name}:narrative`, name, 2015, s[0].slice(0, -1), start);
    p.evaluatedFiscalYear = 2015;
    p.department = s[2] ?? s[4];
    p.evidence.push(evidence(input, before, start - 7));
    const p1 = PURPOSE1.exec(seg), p2 = p1 ? null : PURPOSE2.exec(seg);
    let after = -1;
    if (p1) {
      p.purpose = p1[1].trim();
      p.evidence.push(evidence(input, p1[1], start + p1.index! + p1[0].indexOf('\n事業の目的 ') + '\n事業の目的 '.length));
      after = p1.index! + p1[0].length;
    } else if (p2 && !/[。．]$/.test(p2[2])) {
      p.purpose = p2[2] + p2[3];
      p.evidence.push(evidence(input, p2[1], start + p2.index! + p2[0].indexOf(p2[1])));
      after = p2.index! + p2[0].length;
    }
    const c = after < 0 ? null : CONTENT.exec(seg.slice(after));
    if (c) {
      p.activities = c[1].trim();
      p.evidence.push(evidence(input, c[1], start + after));
    }
    if (!p.purpose && !p.activities) return;
    p.warnings.push('美郷町教育委員会 事業評価シートの「事業の目的」「事業の内容」欄（見出しと同じ行の1行、または見出しを挟む2行の欄で、隣の欄の行が混ざらない形のみ）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '美郷町 教育委員会 平成27年度 事業評価シート: 事業の目的（目的）・事業の内容（事業内容）。目的と内容の欄の行が続けて出力されるシートは対象外。',
};
