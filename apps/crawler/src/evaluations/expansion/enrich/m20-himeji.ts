import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 姫路市（教育委員会 点検・評価報告書 令和７年度実績、個票）
// 公開済みレコードは同じ報告書（tenkenhyokaR7.pdf）の主要事業（対象年度＝令和７年度）。個票の「事業の内容」欄を事業内容として取る。
// 欄は見出し（「事業の\n内容」）の次の段落から「令和７年度 実施事業」の見出しまでで、〇で始まる箇条だけからなる版に限る。
// 目的欄はない。実施事業と「実績・成果」の欄は左右の列が行ごとに混ざるため取らない。（再掲）の個票は対象外。
const HEAD = /\n事業名\n\n((?:[^\n]+\n)+)\n/g;
const BODY = /\n事業の\n内容\n\n((?:[^\n]+\n)+)令和７年度 実施事業\n/;
const NUMBER = /^[１-９]－[１-９]－[①-⑳] /;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '28201' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/tenkenhyokaR7.pdf')) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const raw = h[1].trimEnd();
    if (!NUMBER.test(raw) || raw.includes('（再掲）')) continue;
    const name = raw.replace(NUMBER, '').replace(/\n/g, '');
    const b = BODY.exec(seg);
    if (!b) continue;
    const lines = b[1].trimEnd().split('\n');
    if (!/^[〇○]/.test(lines[0]) || lines.some(l => /^(担当課|実績・成果|事業名)$|課$/.test(l.trim()))) continue;
    const p = project(input, `narrative:${name}`, name, null, raw, start + '\n事業名\n\n'.length);
    p.projectCode = null; p.evaluatedFiscalYear = 2025;
    // 〇で始まる行の前の改行だけを残し、欄の幅での折り返しの改行は除く。
    p.activities = lines.reduce((acc, l, j) => acc + (j === 0 ? '' : /^[〇○]/.test(l) ? '\n' : '') + l.trim(), '');
    p.evidence.push(evidence(input, b[1].trimEnd(), start + b.index + '\n事業の\n内容\n\n'.length));
    p.warnings.push('姫路市 教育委員会点検・評価報告書（令和７年度実績）個票の「事業の内容」欄を事業内容として収録（目的欄はない）。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '姫路市 教育委員会 点検・評価報告書（令和７年度実績）の個票: 「事業の内容」欄（事業内容）。目的欄はなく、実施事業・実績・成果は列が混ざるため対象外。',
};
