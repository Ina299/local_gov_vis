import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 西海市（令和6年度 主要な施策の成果に関する説明書、事業ごとの表）
// 公開済みレコードは同じ説明書の「事業名称」の表の事業（事業年度2024）。所管課の欄は表により位置が異なるため設定しない。表の「事業目的及び事業内容」欄と「成果・実績」欄は、
// 抽出テキストでは見出し（「事業目的／及び／事業内容」、「成果・実績」）の後の段落として、または【事業目的】【事業内容】【成果・実績】の
// 小見出しつきの文として出る。欄の中に【目的】（事業目的）【内容】（事業内容）などの小見出しがあれば、目的・事業内容に分けて足す
// （財源などの他の小見出しの部分は採らない）。小見出しがなければ欄全体を事業内容として足す（目的と内容の境がないため目的には入れない）。
// 成果は見出しつきの「成果・実績」欄（次の「事業評価」の手前まで）に限る。欄の内容が金額表の後に離れて出る表は採らない。
const ID = '0ca67a1c6dec04bd78ccd450';
const SUB = /^[【（(]([^】）)\n]{1,10})[】）)]$/;

/** 欄の文を小見出しで分ける。小見出しのない部分は key '' に入る。 */
function sections(raw: string, at: number) {
  const out: { key: string; raw: string; at: number }[] = [];
  let pos = 0, cur: { key: string; start: number; end: number } | null = null;
  const lines = raw.split('\n');
  const push = () => { if (cur && cur.end > cur.start) out.push({ key: cur.key, raw: raw.slice(cur.start, cur.end), at: at + cur.start }); };
  for (const line of lines) {
    const head = SUB.exec(line);
    if (head) { push(); cur = { key: head[1], start: pos + line.length + 1, end: pos + line.length + 1 }; }
    else if (cur) cur.end = pos + line.length;
    else cur = { key: '', start: pos, end: pos + line.length };
    pos += line.length + 1;
  }
  push();
  return out;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42212' || input.sourceId !== ID) return [];
  const t = input.text, heads = [...t.matchAll(/\n事業名称\n\n([^\n]+)\n/g)];
  const names = heads.map(h => h[1].trim().replace(/（Ｐ[^）]*）$/, ''));
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    if (names.filter(n => n === names[i]).length !== 1 || (input.truncated && i === heads.length - 1)) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length), name = names[i];
    let field: { raw: string; at: number } | null = null, result: { raw: string; at: number } | null = null;
    const a = /\n事業目的\n及び\n事業内容\n\n((?:[^\n]+\n)+)\n成果・実績\n\n((?:[^\n]+\n)+)\n事業評価\n/.exec(seg);
    const b = /\n(【事業目的】\n(?:[^\n]+\n)+)\n/.exec(seg);
    if (a) {
      field = { raw: a[1].slice(0, -1), at: start + a.index! + a[0].indexOf(a[1]) };
      result = { raw: a[2].slice(0, -1), at: start + a.index! + a[0].lastIndexOf(a[2]) };
    } else if (b && b[1].includes('\n【事業内容】\n')) field = { raw: b[1].slice(0, -1), at: start + b.index! + 1 };
    if (!field || /^[\d,，.]+$/m.test(field.raw)) return;
    const p = project(input, `${name}:narrative`, name, null, h[1], start + 1 + '事業名称\n\n'.length);
    p.evaluatedFiscalYear = 2024;
    const secs = sections(field.raw, field.at), keys = secs.map(s => s.key);
    const purpose = secs.find(s => /^(事業)?目的$/.test(s.key)), act = secs.find(s => /^(事業)?内容$/.test(s.key));
    if (keys.length === 1 && keys[0] === '') {
      p.activities = joinWrapped(field.raw, 45);
      p.evidence.push(evidence(input, field.raw, field.at));
    } else if (!keys.includes('') && keys.filter(k => /^(事業)?目的$/.test(k)).length <= 1 && keys.filter(k => /^(事業)?内容$/.test(k)).length <= 1) {
      if (purpose) { p.purpose = joinWrapped(purpose.raw, 45); p.evidence.push(evidence(input, purpose.raw, purpose.at)); }
      if (act) { p.activities = joinWrapped(act.raw, 45); p.evidence.push(evidence(input, act.raw, act.at)); }
    }
    if (result && !/^[\d,，.]+$/m.test(result.raw)) {
      p.outcomes = joinWrapped(result.raw, 45);
      p.evidence.push(evidence(input, result.raw, result.at));
    }
    if (!p.purpose && !p.activities && !p.outcomes) return;
    p.warnings.push('主要な施策の成果に関する説明書の「事業目的及び事業内容」欄（小見出し【目的】【内容】があれば目的・事業内容に分け、なければ全体を事業内容）と「成果・実績」欄。欄の幅での折り返しだけを除いてつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '西海市 令和6年度 主要な施策の成果に関する説明書: 事業目的及び事業内容欄（小見出しで目的・事業内容に分ける）・成果・実績欄。欄の内容が金額表の後に離れて出る表は対象外。',
};
