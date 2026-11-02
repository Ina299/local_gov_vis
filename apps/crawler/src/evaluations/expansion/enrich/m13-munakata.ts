import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 宗像市（令和２〜４年度 決算成果報告書、事業概要）
// 公開済みレコードは同じ報告書の事業（事業名・所管課・決算年度、実績・成果は収録済み）。様式に目的欄はなく、
// 「■事業概要■」欄を事業内容として足す。欄の本文は所管課の行の次から「（一般）N款…」の行の手前まで。
// 令和４年度版は右に「■事業評価■」の欄があり、抽出テキストで行が混ざることがある。混ざった行は空白で区切られた行
// （右欄の文が行末に付く）か、右欄の幅（20字未満）の短い行として現れるため、そうした行を含む欄は採らない。
const TITLE = /^令和([0-9０-９]+)年度 決算成果報告書\n/;
const BLOCK = /^(\S+) ■事業概要■( ■事業評価■)?\n(\S+)\n((?:[^\n]+\n)+?)（[^）\n]+）\d+款/gm;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40220' || input.format !== 'pdf') return [];
  const title = TITLE.exec(input.text);
  if (!title) return [];
  const year = 2018 + Number(title[1].replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(BLOCK)) {
    const raw = m[4].replace(/\n$/, ''), lines = raw.split('\n'), width = Math.max(...lines.map(l => l.length));
    // 行はすべて欄の幅いっぱいか句点で終わり、最後の行は句点で終わること。右欄のある版では短い行は20字以上。
    if (lines.some(l => /\s/.test(l)) || !raw.endsWith('。')) continue;
    if (lines.some((l, i) => i < lines.length - 1 && l.length < width - 1 && !l.endsWith('。'))) continue;
    if (m[2] && lines.some(l => l.length < width - 1 && l.length < 20)) continue;
    const at = m.index! + m[0].indexOf(`\n${m[3]}\n`) + m[3].length + 2;
    const p = project(input, `narrative:${m[1]}`, m[1], null, m[0].slice(0, m[0].indexOf('\n', m[1].length + 1)), m.index);
    p.projectCode = null; p.evaluatedFiscalYear = year; p.department = m[3];
    p.activities = lines.reduce((s, l, i) => s + (i && lines[i - 1].endsWith('。') ? '\n' : '') + l, '');
    p.evidence.push(evidence(input, title[0].trimEnd(), title.index), evidence(input, raw, at));
    p.warnings.push('宗像市 決算成果報告書の「■事業概要■」欄を事業内容として収録（様式に目的欄はない）。'
      + '右欄（事業評価）の文が混ざった欄は対象外。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '宗像市 令和２〜４年度 決算成果報告書: 「■事業概要■」欄（事業内容）。右欄の文が混ざった欄は対象外。目的欄は様式にない。',
};
