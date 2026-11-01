/**
 * 13103 港区: 平成29年度 港区事務事業評価シート（所管課別PDF）。公開済みレコード（同じシート）の空欄の目的に「事業の目的」欄を補う。
 * 欄の見出し「事 業 の 目 的」は本文の行頭（または本文の行の間の1行）に印字されるため、見出しだけを除いてつなぐ。
 * 見出しが段落内に1回だけあり、次の段落が「事業の対象」欄である場合に限る。事業の概要・成果の概要は隣の欄と区切れないため対象外。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

const HEAD = /Ｎｏ\n\n平成([２-３０-９]+)年度\n\n(\d+)\n\n港区事務事業評価シート\n/g;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const LABEL = /^(事 業 の 目 的|事業の目的)(?: |$)/;
const MARK = /^(・|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|（[０-９\d]+）|\([０-９\d]+\))/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13103' || !/\/documents\/78804\/h29[a-z]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /\n事 務 事 業 名 ([^\n]+)\n/.exec(seg);
    if (!name || 1988 + Number(ascii(h[1])) !== 2017) continue;
    const a = [...seg.matchAll(/\n事業概要\n(?!\n)/g)];
    if (a.length !== 1) continue;
    const from = a[0].index! + a[0][0].length, end = seg.indexOf('\n\n', from);
    if (end < 0) continue;
    const raw = seg.slice(from, end), lines = raw.split('\n');
    const next = seg.slice(end + 2, seg.indexOf('\n\n', end + 2));
    if (lines.filter(l => LABEL.test(l)).length !== 1 || !/事 業 の 対 象|事業の対象/.test(next) || /事 業 の 対 象|事業の対象|事業の概要/.test(raw)) continue;
    const body = lines.map(l => l.replace(LABEL, '').trim()).filter(Boolean);
    if (body.length < 1 || body.some(l => /^(事|業|の|目|的)$/.test(l))) continue;
    const value = body.map((l, k) => (k > 0 && MARK.test(l) ? '\n' : '') + l).join('');
    if (!/[。す]$/.test(value)) continue;
    const projectName = name[1].trim();
    const p = project(input, `No${h[2]}:narrative`, projectName, 2017, seg.slice(0, name.index! + name[0].length - 1), start);
    p.id = stableId(input, `No${h[2]}:narrative`, 2017);
    p.projectCode = `No${h[2]}`;
    p.purpose = value;
    p.evidence.push(evidence(input, raw, start + from));
    p.warnings.push('港区事務事業評価シート（平成29年度）の「事業の目的」欄を目的として収録。本文に重なって印字された欄の見出し（事 業 の 目 的）を除き、PDFの折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '港区 平成29年度 事務事業評価シート（所管課別PDF）の「事業の目的」欄（見出しが段落内に1回だけで、次の段落が事業の対象欄のもの）。事業の概要・成果の概要は対象外。',
};
