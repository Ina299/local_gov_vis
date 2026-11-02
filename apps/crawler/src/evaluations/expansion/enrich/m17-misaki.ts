import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 岬町（教育委員会の点検・評価報告書 令和2・5年度実施事業）
// 公開済みレコードは点検・評価事業一覧表の1行（整理番号と事業名が1行）と、整理番号が一致する点検・評価票から作られ、
// 目的・取組状況・事業効果が空。ここでは同じ一覧表の行で整理番号→事業名を引き、評価票（整理番号が1つだけの票）から:
// - 目的: 「担当部署」の欄の直後の段（縦書きの見出し「的」が行頭に付く場合は除く）で、次の段が「事業概要」の欄の場合のみ。
//   令和5年度版は目的と事業概要の行が空行なしで続き境が決まらないため、この形にならず採られない。
// - 取組状況・事業効果: 事業費（千円）の直後の「取組状況」の見出しから「事業効果」の見出しまでの1段と、「事業効果」から
//   「受益者負担」または「課題・」の見出しまでの1段。見出しの前に本文がはみ出す票（事業費の直後でない）は採らない。
const HEAD = /^令和([２５])年(?:度)?実施事業/gm;
const LIST = /^((?:学校|指導|生涯|淡公|文セ|青セ|給食|淡幼)[０-９]+) (\S[^\n]*)$/gm;
const CODE = /^(?:学校|指導|生涯|淡公|文セ|青セ|給食|淡幼)[０-９]+$/gm;
const PURPOSE = /\n担当部署\n\n[^\n]+\n\n(?:的\n\n)?((?:[^\n]+\n)+)\n((?:[^\n]+\n)+)/;
const WORK = /\n[^\n]*千円\n\n取組状況\n\n((?:[^\n]+\n)+)\n事業効果\n\n((?:[^\n]+\n)+)\n(?:受益者負担|課題・)/;
const LABEL = /^(目|的|点検項目|事業概要|前年度決算額|担当部署|取組状況|事業効果|備|考|事 ?業 ?費)$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27366' || !/\/group\/23\/R[35]tenkenhyouka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  if (!heads.length) return [];
  // 整理番号→事業名（一覧表で整理番号と事業名が1行にある行のみ。同じ整理番号が2回出る場合は使わない）
  const names = new Map<string, string | null>();
  for (const m of t.slice(0, heads[0].index).matchAll(LIST)) names.set(m[1], names.has(m[1]) ? null : m[2].trim());
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const codes = new Set([...seg.matchAll(CODE)].map(m => m[0]));
    if (codes.size !== 1) return;
    const [code] = codes, name = names.get(code);
    if (!name || !seg.includes(`\n${name}\n`)) return;
    const year = h[1] === '２' ? 2020 : 2023;
    const codeAt = seg.search(new RegExp(`^${code}$`, 'm'));
    const p = project(input, `${code}:narrative`, name, null, code, start + codeAt);
    p.projectCode = code;
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, h[0], start), evidence(input, name, start + seg.indexOf(`\n${name}\n`) + 1));
    const pu = PURPOSE.exec(seg);
    if (pu) {
      const lines = pu[1].slice(0, -1).split('\n'), next = pu[2].split('\n');
      const body = lines.map(l => l.replace(/^的 /, ''));
      if (next.some(l => /^事業概要( |$)/.test(l)) && body.at(-1)!.endsWith('。') && !body.some(l => LABEL.test(l))
        && lines.filter(l => l.startsWith('的 ')).length <= 1) {
        p.purpose = unwrap(body.join('\n'));
        p.evidence.push(evidence(input, pu[1].slice(0, -1), start + pu.index! + pu[0].indexOf(pu[1])));
      }
    }
    const w = WORK.exec(seg);
    if (w) {
      const act = w[1].slice(0, -1), res = w[2].slice(0, -1);
      if (![act, res].some(s => s.split('\n').some(l => LABEL.test(l)))) {
        p.activities = unwrap(act);
        p.outcomes = unwrap(res);
        const at = start + w.index! + w[0].indexOf('\n取組状況\n\n') + '\n取組状況\n\n'.length;
        p.evidence.push(evidence(input, act, at), evidence(input, res, at + act.length + '\n\n事業効果\n\n'.length));
      }
    }
    if (!p.purpose && !p.activities) return;
    p.warnings.push('岬町教育委員会 点検・評価票の「目的」欄（事業概要の欄と空行で分かれる票のみ。縦書きの見出し「的」を除いた）、'
      + '「取組状況」「事業効果」欄（事業費の直後に見出しがある票のみ）を目的・事業内容・成果として収録。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '岬町 教育委員会の点検・評価報告書（令和2・5年度実施事業）の点検・評価票: 目的（事業概要の欄と境が決まる票のみ）・取組状況（事業内容）・事業効果（成果）。',
};
