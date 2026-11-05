import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 練馬区（平成25年度 行政評価 資料編、事務事業評価表（第三者評価対象））
// 公開済みレコードは同じ資料編（25siryouhen.pdf、評価年度＝平成25年度、対象年度＝平成24年度）の事務事業評価表12件。
// 事業名の欄は表ごとに出力位置が違うため、目次（「３ 事務事業評価表」の行頭3桁の施策番号つきの行）の事業名が
// 表の先頭部分に1行として現れ、かつ1つだけ当てはまる場合に限り、その表の事業名とする。
// 「目的（何のため）」欄は見出しの行の残りと、その後「対象」の行までの行を目的として取り、「ため」「ため。」で終わる場合だけ採る。
// 見出しの前に「1…ため。」、見出しの行に「2…」と番号つきで分かれた版は、前の段落もつなぐ。
// 「事務事業の内容」欄は見出しの位置が表ごとに違い、欄の始まりが本文で確定しないため取らない。
const SHEET = /^平成25年度 事務事業評価表\n/gm;

function tocNames(t: string): string[] {
  const s = t.indexOf('３ 事務事業評価表（第三者評価対象）\n'), e = t.indexOf('４ 施策評価表（第三者評価対象）', s);
  if (s < 0 || e < 0) return [];
  const names: string[] = [];
  for (const m of t.slice(s, e).matchAll(/^\d{3} ([^\n]+?)(?: ·+ \d+)?\n(?:([^\n\d(][^\n]*?) ·+ \d+\n)?/gm)) names.push(m[1] + (m[2] ?? ''));
  return names.filter(n => !n.includes('·'));
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13120' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/25siryouhen.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [], names = tocNames(t);
  const starts = [...t.matchAll(SHEET)].map(m => m.index!);
  for (const [i, start] of starts.entries()) {
    const seg = t.slice(start, starts[i + 1] ?? t.length), head = seg.slice(0, seg.indexOf('\n大事業名'));
    const hits = names.filter(n => head.split('\n').includes(n));
    if (hits.length !== 1) continue;
    const label = /\n目的（何のため）(?: ([^\n]+))?\n((?:\n?[^\n]+\n)*?)\n?対象\n/.exec(seg);
    if (!label) continue;
    const lines = [label[1] ?? '', ...label[2].split('\n')].map(l => l.trim()).filter(Boolean);
    if (!lines.length || !/ため。?$/.test(lines[lines.length - 1])) continue;
    let at = start + label.index! + 1, raw = label[0].slice(1, -'\n対象\n'.length).trimEnd();
    let purpose = lines.join('');
    if (/^2/.test(purpose)) {
      // 番号1の段落（見出しの直前の、空行に挟まれた1行）を前につなぐ。
      const prev = /\n\n(1[^\n]+ため。)\n\n$/.exec(seg.slice(0, label.index! + 1));
      if (!prev) continue;
      at = start + prev.index! + 2; raw = t.slice(at, start + label.index! + 1 + raw.length);
      purpose = `${prev[1]}\n${purpose}`;
    }
    const p = project(input, `narrative:${hits[0]}`, hits[0], 2013, seg.slice(0, head.length), start);
    p.projectCode = null; p.evaluatedFiscalYear = 2012;
    p.purpose = purpose;
    p.evidence.push(evidence(input, raw, at));
    p.warnings.push('練馬区 平成25年度 行政評価 資料編の事務事業評価表の「目的（何のため）」欄を目的として収録（折り返しの改行は除いた）。'
      + '事業名は目次の事業名が表の先頭部分に1行として現れるものに限った。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '練馬区 平成25年度 行政評価 資料編（25siryouhen.pdf）の事務事業評価表: 「目的（何のため）」欄。',
};
