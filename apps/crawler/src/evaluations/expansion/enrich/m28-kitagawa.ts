import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 北川村（電源立地地域対策交付金 事業評価個表）
// 公開済みレコードは同じPDFの事業評価総括表の交付金事業の名称から作られ、年度を持たない。
// 各「Ⅱ．事業評価個表」の「交付金事業の概要」は1行の欄（見出しと同じ行）のため、その行の残りを事業内容として取る。
// 「交付金事業の成果目標」「成果及び評価」は見出しが欄の途中の行に割り込み、範囲が本文で決まらないため取らない。目的の欄はない。
const FILE = 'https://www.kitagawamura.jp/download/?t=LD&id=1332&fid=1596';
const SHEET = /\nⅡ．事業評価個表\n番号 措置名 交付金事業の名称\n(\d+) [^\n]*措置 ([^\n]+)\n/g;
const SUMMARY = /\n交付金事業の概要 ([^\n]+)\n総事業費 /;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '39305' || input.sourceUrl !== FILE) return [];
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  for (const [i, h] of heads.entries()) {
    const end = heads[i + 1]?.index ?? t.length, sh = t.slice(h.index!, end), s = SUMMARY.exec(sh);
    if (!s) continue;
    const p = project(input, `narrative:${i + 1}`, h[2].trim(), null, h[0].slice(1, -1), h.index! + 1);
    p.projectCode = null;
    p.activities = s[1].trim();
    p.evidence.push(evidence(input, s[1], h.index! + s.index + '\n交付金事業の概要 '.length));
    p.warnings.push('北川村 交付金事業の事業評価個表の「交付金事業の概要」欄を事業内容として収録。年度は公開済みレコードと同じく未設定。');
    out.push(p);
  }
  return out.filter(p => out.filter(q => q.projectName === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: '北川村 交付金事業 事業評価個表: 「交付金事業の概要」（事業内容）。目的の欄はなく、成果目標・成果及び評価は見出しが欄の途中に割り込むため取らない。年度なしの公開済みレコードと同じPDFに限る。',
};
