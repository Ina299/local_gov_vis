import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m28-util';

// ---------------------------------------------------------------- 広野町（復興交付金事業計画の個別事業の実績に関する評価様式）
// 公開済みレコードは町サイト掲載の評価様式PDF（03・15・18・20.pdf）の事業番号・事業名から作られ、年度を持たない。
// 「事業目的」または「事業目的・事業地区」欄の、「事業地区」の行（または【事業地区】）の手前までを目的として取る（先頭の【事業目的】は除く）。
// 1票に事業が2つある様式（18.pdf の施設費・用地費）は目的の欄を両方に付ける。
// 「事業結果」欄は「事業の実績に関する評価」の見出しまでを成果として取るが、1票1事業で、図の文字（至・地名など）が混ざらない票に限る。
const BASE = 'https://www.town.hirono.fukushima.jp/_res/projects/default_project/_page_/001/003/890/';
const FILES = ['03.pdf', '15.pdf', '18.pdf', '20.pdf'].map(f => BASE + f);
const ID = /\n事業番号 ?([^\n]*)\n事業名\n([^\n]+)(?=\n)|\n事業番号\n事業名\n\n([^\n]+)\n([^\n]+)(?=\n)/g;
const PURPOSE = /\n事業目的(?:・事業地区)?\n((?:[^\n]+\n)+?)(?:事業地区 |【事業地区】)/;
const RESULT = /\n事業結果\n((?:[^\n]+\n)+?)事業の実績に関する評価\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07541' || !FILES.includes(input.sourceUrl)) return [];
  const t = input.text, ids = [...t.matchAll(ID)];
  const f = PURPOSE.exec(t);
  if (!ids.length || !f || t.match(/\n事業目的(?:・事業地区)?\n/g)!.length !== 1) return [];
  let raw = f[1].replace(/\n$/, ''), at = f.index + f[0].indexOf('\n', 1) + 1;
  const lead = /^【事業目的】/.exec(raw);
  if (lead) { raw = raw.slice(lead[0].length); at += lead[0].length; }
  const r = ids.length === 1 ? RESULT.exec(t) : null;
  const result = r && !r[1].split('\n').some(l => /^(至|【|〈)/.test(l.trim()) || /^\S{1,3}$/.test(l.trim())) ? r : null;
  return ids.map((m, i) => {
    const code = (m[1] ?? m[3]).trim(), name = (m[2] ?? m[4]).trim();
    const p = project(input, `narrative:${code || i}`, name, null, m[0].slice(1), m.index! + 1);
    p.projectCode = code || null;
    p.purpose = lead ? unwrap(lead[0] + raw).slice(lead[0].length) : unwrap(raw);
    p.evidence.push(evidence(input, raw, at));
    if (result) {
      const rr = result[1].replace(/\n$/, '');
      p.outcomes = unwrap(rr);
      p.evidence.push(evidence(input, rr, result.index + '\n事業結果\n'.length));
    }
    p.warnings.push('広野町 復興交付金事業計画の個別事業の実績に関する評価様式の「事業目的」欄を目的として収録'
      + (result ? '、「事業結果」欄を成果として収録' : '') + '。欄の幅での折り返しの改行を除いた。年度は公開済みレコードと同じく未設定。');
    return p;
  });
}

export const entry = {
  extract,
  scope: '広野町 復興交付金事業計画の個別事業の実績に関する評価様式（03・15・18・20.pdf）: 「事業目的」欄（目的）、1票1事業で図の文字が混ざらない票の「事業結果」欄（成果）。年度なしの公開済みレコードと同じPDFに限る。',
};
