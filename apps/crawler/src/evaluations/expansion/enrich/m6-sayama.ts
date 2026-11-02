import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m6-util';

// ---------------------------------------------------------------- 狭山市 令和２年度行政評価 事務事業評価表（r2_gyoseihyoka.files/r2-*.pdf）
// n4-sayama と同じ評価表・同じ年度の確定（実施結果ページの施策別一覧に「事業名(所管課)」が載っていること）で、
// 「事務事業目的」「事務事業内容」欄を補う。抽出テキストで欄がラベルの直後に空行で区切られて並ぶ票
// （事務事業目的\n\n〈目的〉\n\n事務事業内容\n\n〈内容〉\n\n実施形態）に限る。ラベルが続けて並び、目的と内容の文章が
// 区切りなく続く票（全体の約7割）は、どこまでが目的か決まらないため採らない。
const PAGE = 'eed8ae779a779f2edfcca64f';
const PAGE_TITLE = '令和2年度行政評価（事務事業評価）実施結果';
const HEAD = /事務事業評価表\n\n令和元年度\n(\d{6})\n\n事務\n事業\n区分\n\n所属 (\S+) (\S+)\n\n([^\n]+)\n\n事業区分\n/g;
const BODY = /\n事務事業目的\n\n((?:[^\n]+\n)+)\n事務事業内容\n\n((?:[^\n]+\n)+)\n実施形態\n/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '11215' || !/\/r2_gyoseihyoka\.files\/r2-\d+\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const page = inputs.find(i => i.sourceId === PAGE);
  if (!page || page.truncated || !page.text.startsWith(PAGE_TITLE)) return [];
  const text = input.text, heads = [...text.matchAll(HEAD)];
  if (!heads.length || heads.length !== text.split('事務事業評価表').length - 1) return [];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, block = text.slice(start, heads[k + 1]?.index ?? text.length);
    const name = h[4].trim(), sec = h[3];
    const policies = [...block.matchAll(/\n施策 (\d+)(?: [^\n]*)?\n/g)];
    if (policies.length !== 1) return;
    const sect = page.text.match(new RegExp(`\\n施策${policies[0][1]}\\n[^\\n]+\\n(?:(?!施策\\d)[^\\n]*\\n)*?評価表ダウンロード`));
    if (!sect) return;
    const listed = [...sect[0].matchAll(new RegExp(`\\n${esc(name)}\\(${esc(sec)}[)）]\\n`, 'g'))];
    if (listed.length !== 1) return;
    const m = BODY.exec(block);
    if (!m || /事務事業|実施形態|成果指標|活動指標/.test(m[1] + m[2])) return;
    const p = project(input, `補強目的:${h[1]}`, name, 2020, h[0].slice(0, -'\n\n事業区分\n'.length), start);
    p.department = `${h[2]} ${sec}`; p.evaluatedFiscalYear = 2019;
    p.purpose = unwrap(m[1].trimEnd(), 45);
    p.activities = unwrap(m[2].trimEnd(), 45);
    p.evidence.push(evidence(page, PAGE_TITLE, 0), evidence(page, listed[0][0].slice(1, -1), sect.index! + listed[0].index! + 1),
      evidence(input, m[0].slice(1, -1), start + m.index + 1));
    p.warnings.push('事務事業評価表（対象年度 令和元年度、評価年度は実施結果ページで令和2年度と確定）の「事務事業目的」「事務事業内容」欄。欄の幅いっぱいで折り返した改行を除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '狭山市 令和２年度行政評価の事務事業評価表（個票PDF）: 事務事業目的（目的）・事務事業内容（事業内容）。欄が空行で区切られて並ぶ票のみ（目的と内容の文章が続けて並ぶ票は対象外）。',
};
