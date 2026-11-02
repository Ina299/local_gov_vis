import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 長崎市（令和６・７年度 個別施策評価シート「施策を推進する主な事業」）
// 公開済みレコードは同じ評価シートの主な事業（事業名・担当課・成果指標・決算（見込）額）から作られ、文章の欄は未収録だった。
// 各事業の欄は「事業名／担当課」の見出しの直後に事業名、その後に成果指標の表、「事業目的」「事業概要」「取組実績」の順に
// 見出しと1段落ずつが並ぶ。事業名が見出しの直後（行番号の1行を挟むことがある）にあり、その事業の欄の中に「事業目的」
// 「事業概要」「取組実績」がこの順で1回ずつある場合だけ、事業目的を目的に、事業概要を事業内容に収録する。
// 取組実績は活動量の列挙で成果の欄ではないため収録しない。評価年度は資料の表題（令和○年度 個別施策評価シート）による。
const SOURCES = /\/uploaded\/attachment\/(42107|42108|55632|55741)\.pdf$/;
const TITLE = /令和([６７])年度 個別施策評価シート/;
const NAME = /事業名\n担当課\n\n(?:\d\n\n)?([^\n]+)\n\n成果指標\n/g;
const BODY = /\n事業目的\n\n((?:[^\n]+\n)*?[^\n]+)\n\n事業概要\n\n((?:[^\n]+\n)*?[^\n]+)\n\n取組実績\n/;

const join = (s: string) => {
  const lines = s.split('\n'), width = Math.max(...lines.map(l => l.length));
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].length >= width - 3 && !/^[・※○●①-⑳]/.test(l) ? '' : '\n') + l, '');
};

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42201' || !SOURCES.test(input.sourceUrl)) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const year = 2018 + Number(String.fromCharCode(title[1].charCodeAt(0) - 0xfee0));
  // 事業の欄の区切り: 「事業名／担当課」の見出しごと（事業名が見出しの直後にない欄も区切りには使う）。
  const bounds = [...t.matchAll(/事業名\n担当課\n/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(NAME)) {
    const start = m.index!, end = bounds.find(b => b > start) ?? t.length;
    const seg = t.slice(start, end), b = BODY.exec(seg);
    if (!b || seg.split('\n事業目的\n').length !== 2 || seg.split('\n事業概要\n').length !== 2) continue;
    if (/^(成果指標|目標値|実績値|達成率|事業目的|事業概要)$/m.test(b[1] + '\n' + b[2])) continue;
    const name = m[1].trim();
    const p = project(input, `${name}|narrative`, name, year, m[0].slice(0, -'\n\n成果指標\n'.length), start);
    p.projectCode = null;
    const pAt = start + b.index! + '\n事業目的\n\n'.length, aAt = pAt + b[1].length + '\n\n事業概要\n\n'.length;
    p.purpose = join(b[1]);
    p.activities = join(b[2]);
    p.evidence.push(evidence(input, b[1], pAt), evidence(input, b[2], aAt));
    p.warnings.push(`長崎市 令和${title[1]}年度 個別施策評価シートの「施策を推進する主な事業」の「事業目的」を目的に、「事業概要」を事業内容に収録（折り返しの改行は除去）。取組実績は未収録。`);
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '長崎市 令和６・７年度 個別施策評価シートの「施策を推進する主な事業」: 事業目的・事業概要の文章（事業名が欄の先頭にあるものだけ）。',
};
