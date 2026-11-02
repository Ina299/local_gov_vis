import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 比布町（令和６年度 事務事業点検・評価調書、目的・実施内容・事業成果）
// 公開済みレコードは同じ調書（教育委員会の点検・評価報告書）の事業ごとの表（学－１〜、社－１〜、ス－１〜。対象年度2024）。
// 「事業の概要」の【目 的】欄を目的、【実施内容】欄を事業内容、【事業成果】（（事業成果）とした版も同じ）欄を成果とする。
// 欄は見出しの次の行から次の【】見出しの手前までの行。行頭の「・」の箇条の前の改行は残し、それ以外の改行（折り返し・句点だけの行）は除く。
// 年度は調書の見出し「令和ｎ年度 事務事業点検・評価調書」の年度（決算額の年度）を対象年度とする。
const HEAD = /^令和([０-９]+)年度 事務事業点検・評価調書$/gm;
const NAME = /\n番号\n\n事業名\n\n([学社ス]－[０-９\d]+)\n\n([^\n]+)\n/;
const DEPT = /\n事務事業実施係\n\n([^\n]+)\n/;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const join = (raw: string) => raw.split('\n').map(l => l.trim()).filter(Boolean).reduce((acc, l, i) => acc + (i === 0 ? '' : /^・/.test(l) ? '\n' : '') + l, '');

/** 見出し label の次の行から、次の【】見出し（または stop）の手前までの欄。空行を含む欄・空の欄は null。 */
function field(seg: string, label: RegExp, stop: RegExp): { raw: string; at: number } | null {
  const m = label.exec(seg);
  if (!m) return null;
  const at = m.index + m[0].length, rest = seg.slice(at), end = rest.search(stop);
  if (end <= 0) return null;
  const raw = rest.slice(0, end).replace(/\n+$/, '');
  if (!raw.trim() || /\n\s*\n/.test(raw)) return null;
  return { raw, at };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01455' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/i9kb6d0000009rye.pdf') || input.truncated) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const n = NAME.exec(seg), d = DEPT.exec(seg);
    if (!n) continue;
    const purpose = field(seg, /\n【目 的】\n/, /\n【/);
    const acts = field(seg, /\n【実施内容】\n/, /\n(【|（事業成果）\n)/);
    const outs = field(seg, /\n(【事業成果】|（事業成果）)\n/, /\n【/);
    if (!purpose) continue;
    const name = n[2].trim();
    // 公開済みレコードと同じ資料・番号のため、ID は別の鍵で作る（突き合わせは事業名・年度で行う）。
    const p = project(input, `narrative:${n[1]}`, name, null, n[0].slice(1, -1), start + n.index + 1);
    p.projectCode = n[1];
    p.evaluatedFiscalYear = 2018 + Number(ascii(heads[i][1]));
    p.department = d ? d[1].trim() : null;
    p.purpose = join(purpose.raw);
    p.activities = acts ? join(acts.raw) : null;
    p.outcomes = outs ? join(outs.raw) : null;
    p.evidence.push(evidence(input, heads[i][0], start));
    for (const f of [purpose, acts, outs]) if (f) p.evidence.push(evidence(input, f.raw, start + f.at));
    p.warnings.push('比布町 令和６年度 事務事業点検・評価調書の「事業の概要」のうち【目 的】を目的、【実施内容】を事業内容、【事業成果】を成果として収録。'
      + '行頭の「・」の箇条の前以外の改行（折り返し・句点だけの行）を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '比布町 令和６年度 事務事業点検・評価調書（教育委員会）: 【目 的】・【実施内容】・【事業成果】欄。',
};
