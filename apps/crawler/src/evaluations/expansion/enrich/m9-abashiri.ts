import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 網走市「令和６年度 主要施策の成果等報告書」
// 公開済みレコード（同じ報告書の事業ごとの表から作成。目的・取組内容・実績なし）の補強用。
// 表の欄見出しは縦書き（「意\n図」「内取\n容組」「実\n績」「方今\n向後\n性の」）で、対象と意図（目的）の本文は
// 段組みで行が交互に混ざることがあるため、次の形に限って採る。
//  目的   ← 「図」の行・空行の後の段落。途中の行は欄の幅（28字以上）で句点で終わらず、最後の行が句点で終わること
//           （対象の行が交互に挟まる形は行の長さで外れる）。
//  事業内容 ← 「内取\n容組」・空行の後、空行の後に「実\n績」が続く段落（取組内容）。
//  成果   ← 「実\n績」・空行の後、空行の後に「方今\n向後\n性の」が続く段落（実績）。
// 見出しがまとめて先に出る形（本文の並びが確定しない）は採らない。
const HEAD = /\n事業名：\n\n([^\n]+)\n\n年度\n/g;

interface Field { value: string; raw: string; at: number }

function purpose(seg: string, at: number): Field | null {
  const ms = [...seg.matchAll(/\n図\n\n((?:[^\n]+\n)+)\n/g)];
  if (ms.length !== 1) return null;
  const raw = ms[0][1].slice(0, -1), lines = raw.split('\n');
  if (lines.slice(0, -1).some(l => l.length < 28 || l.endsWith('。')) || !lines[lines.length - 1].endsWith('。')) return null;
  return { value: lines.join(''), raw, at: at + ms[0].index! + '\n図\n\n'.length };
}

function between(seg: string, at: number, re: RegExp, lead: string): Field | null {
  const ms = [...seg.matchAll(re)];
  if (ms.length !== 1) return null;
  const raw = ms[0][1].slice(0, -1);
  return { value: unwrap(raw), raw, at: at + ms[0].index! + lead.length };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01211' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/uploaded/attachment/13392.pdf')) return [];
  const t = input.text;
  if (!t.startsWith('令和６年度\n主要施策の成果等報告書\n')) return [];
  const starts = [...t.matchAll(/\n事業名：/g)].map(m => m.index!), out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const seg = t.slice(s, starts[i + 1] ?? t.length);
    const head = new RegExp(HEAD.source).exec(seg);
    if (!head || head.index !== 0 || !/\n年度\n\n予算現額\n\nR6\n/.test(seg)) return;
    const name = head[1].replace(/ 担当部署：.*$/, '').trim();
    const pur = purpose(seg, s);
    const act = between(seg, s, /\n内取\n容組\n\n((?:[^\n]+\n)+)\n実\n績\n/g, '\n内取\n容組\n\n');
    const res = between(seg, s, /\n実\n績\n\n((?:[^\n]+\n)+)\n方今\n向後\n性の\n/g, '\n実\n績\n\n');
    if (!pur && !act && !res) return;
    const p = project(input, `${name}:narrative`, name, null, head[1], s + head.index! + '\n事業名：\n\n'.length);
    p.evaluatedFiscalYear = 2024;
    if (pur) { p.purpose = pur.value; p.evidence.push(evidence(input, pur.raw, pur.at)); }
    if (act) { p.activities = act.value; p.evidence.push(evidence(input, act.raw, act.at)); }
    if (res) { p.outcomes = res.value; p.evidence.push(evidence(input, res.raw, res.at)); }
    p.warnings.push('網走市 主要施策の成果等報告書（令和６年度）の「意図」を目的、「取組内容」を事業内容、「実績」を成果として収録。意図は折り返しの改行だけを除いた。'
      + '対象と意図の行が混ざる形・見出しがまとめて出る形は採らない。');
    out.push(p);
  });
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '網走市 令和６年度 主要施策の成果等報告書の意図（目的）・取組内容・実績。公開済みの同報告書由来レコードの補強用。' };
