import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- さぬき市（第2次総合計画後期基本計画 実施計画／事務事業評価調書）
// 公開済みレコードは同じ調書（r711_2sougoukeikaku_chuki_jisshi01.pdf、1事業2ページ）から作られ、年度を持たない。事業費のページの
// 「対象」「手段」「目的」の欄が、見出しの直後に空行を挟んで値が続き、目的の値の後に「項」（予算科目）が来る並びになっている調書だけ、
// 目的を目的、手段を事業内容として取る（見出しと値が離れて出力される調書は対応が並び順でしか決まらないため採らない）。
// 「事業概要」欄は縦書きの見出しの文字が本文に割り込んでいるため取らない。成果の欄はない。
const HEAD = '第2次さぬき市総合計画後期基本計画実施計画／事務事業評価調書\n';
const FIELDS = /\n対象\n\n((?:[^\n]+\n)+)\n手段\n\n((?:[^\n]+\n)+)\n目的\n\n((?:[^\n]+\n)+)\n項\n/;
const FILE = 'https://www.city.sanuki.lg.jp/material/files/group/7/r711_2sougoukeikaku_chuki_jisshi01.pdf';

/** 欄の幅での折り返しの改行を除く（句点で終わる行の後だけ改行を残す）。 */
const join = (raw: string) => {
  const lines = raw.trimEnd().split('\n').map(l => l.trim());
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : /。$/.test(lines[i - 1]) ? '\n' : '') + l, '');
};

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37206' || input.format !== 'pdf' || input.sourceUrl !== FILE) return [];
  const t = input.text, starts = [...t.matchAll(new RegExp(HEAD, 'g'))].map(m => m.index!);
  const all: ProjectEvaluation[] = [];
  for (const [k, from] of starts.entries()) {
    if (input.truncated && k === starts.length - 1) continue;
    const page = t.slice(from, starts[k + 1] ?? t.length);
    // 事業名は公開済みレコードと同じ取り方（「基本目標」の直前の行）
    const nm = /\n(?:事業名 )?([^\n]+)\n基本目標\n/.exec(page), f = FIELDS.exec(page);
    if (!nm || !f || !page.includes('当初予算額') || page.indexOf('\n対象\n', f.index + 1) >= 0) continue;
    const p = project(input, `narrative:${nm[1]}`, nm[1], null, nm[0].slice(1, nm[0].length - '\n基本目標\n'.length), from + nm.index + 1);
    p.projectCode = null;
    const at = from + f.index;
    const meansAt = at + '\n対象\n\n'.length + f[1].length + '\n手段\n\n'.length;
    const purposeAt = meansAt + f[2].length + '\n目的\n\n'.length;
    p.purpose = join(f[3]);
    p.activities = join(f[2]);
    p.evidence.push(evidence(input, f[0].slice(1, -'\n項\n'.length), at + 1));
    p.evidence.push(evidence(input, f[3].trimEnd(), purposeAt), evidence(input, f[2].trimEnd(), meansAt));
    p.warnings.push('さぬき市 実施計画／事務事業評価調書の「目的」欄を目的、「手段」欄を事業内容として収録（見出しの直後に値が続く調書のみ）。欄の幅での折り返しの改行を除いた。年度は公開済みレコードと同じく未設定。');
    all.push(p);
  }
  // 同じ資料に同名の調書が複数あれば対応が決まらないため採らない
  return all.filter(p => all.filter(q => q.projectName === p.projectName).length === 1);
}

export const entry = {
  extract,
  scope: 'さぬき市 第2次総合計画後期基本計画 実施計画／事務事業評価調書: 「目的」欄（目的）と「手段」欄（事業内容）。見出しの直後に値が続く調書のみ。年度なしの公開済みレコードと同じPDFに限る。',
};
