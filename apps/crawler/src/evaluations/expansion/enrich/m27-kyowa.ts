import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 共和町（電源立地地域対策交付金 事業評価個表 平成30・令和元・令和3年度）
// 公開済みレコードは各年度の「Ⅱ．事業評価個表（年度）」の事業名から作られ、年度は個表の見出しの年度（evaluatedFiscalYear）。
// 個表の「交付金事業の概要」欄（見出しの後、事業名・事業者名の行を除き、「交付金事業に関係する主要政策・施策」の手前までの1段）を
// 事業内容、「交付金事業の定性的な成果及び評価等」欄（左の列の見出しの断片・成果指標の表の残りを除き、
// 「評価に係る第三者機関等の活用の有無」の手前までの1段）を成果とする。どちらも段の途中に空行・短い断片の行がある場合は採らない。
// 年度のない「泊発電所に係る広報・調査等交付金事業」の個表は「交付金事業の成果及び評価」欄だけを成果とする
// （概要の本文は見出しより前に出力され、欄の境が決まらないため事業内容は採らない。「成果目標」「成果指標」は目標のため採らない）。
const SHEET = /^Ⅱ．事業評価個表（(平成|令和)([０-９\d]+|元)年度）$/gm;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const LABEL = /^(交付金事業の名称|交付金事業者名又は間接交付金事業者名|共和町|標及び成果実績|交付金事業の成果目|交付金事業の成果目標及び成果|実績|評価年度の設定理由)$/;

/** at から end までの欄の本文: 先頭の見出し断片・短い行（句点で終わらない）を除いた、空行を含まない最後の段。 */
function body(t: string, at: number, end: number, skip: (l: string) => boolean): { raw: string; at: number } | null {
  let pos = at;
  while (pos < end) {
    const e = t.indexOf('\n', pos), line = t.slice(pos, e);
    if (e < 0 || e > end) return null;
    if (!(line === '' || skip(line))) break;
    pos = e + 1;
  }
  const raw = t.slice(pos, end).replace(/\n+$/, '');
  if (!raw || raw.includes('\n\n')) return null;
  const lines = raw.split('\n'), last = lines.at(-1)!;
  if (!/。$/.test(last) && !/^・/.test(last)) return null;
  if (lines.some(l => LABEL.test(l) || /交付金事業の|^及び成果実績$/.test(l))) return null;
  return { raw, at: pos };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01401' || !/\/assets\/images\/content\/content_\d+_\d+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(SHEET)];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, segEnd = t.indexOf('\n別紙\n', start) < 0 ? t.length : t.indexOf('\n別紙\n', start);
    const end = Math.min(segEnd, heads[i + 1]?.index ?? t.length), seg = t.slice(start, end);
    const n = /\n交付金事業の名称\n(?:1 [^\n]+\n)?(?:地域活性化措置\n)?([^\n]+事業[^\n]*)\n/.exec(seg);
    if (!n) return;
    const name = n[1].trim();
    const year = (h[1] === '平成' ? 1988 : 2018) + (h[2] === '元' ? 1 : Number(ascii(h[2])));
    const p = project(input, `${year}:${name}:narrative`, name, null, h[0], start);
    p.evaluatedFiscalYear = year;
    p.evidence.push(evidence(input, name, start + n.index! + n[0].indexOf(n[1])));
    const skip = (l: string) => LABEL.test(l) || l === name || l.length < 25 && !/。$/.test(l);
    const a0 = seg.indexOf('\n交付金事業の概要\n'), a1 = seg.indexOf('\n交付金事業に関係する', a0 + 1);
    if (a0 >= 0 && a1 > a0) {
      // 概要の見出しの後は事業名・事業者名の行（短い行）だけを除く。本文の先頭行は句点で終わる短い行のこともある。
      const b = body(t, start + a0 + '\n交付金事業の概要\n'.length, start + a1, l => LABEL.test(l) || l === name || /^1 /.test(l));
      if (b) { p.activities = unwrap(b.raw); p.evidence.push(evidence(input, b.raw, b.at)); }
    }
    const o0 = seg.indexOf('\n交付金事業の定性的な成果及び評価等\n'), o1 = seg.indexOf('\n評価に係る第三者機関等の活用の有無\n', o0 + 1);
    if (o0 >= 0 && o1 > o0) {
      const b = body(t, start + o0 + '\n交付金事業の定性的な成果及び評価等\n'.length, start + o1, skip);
      if (b) { p.outcomes = unwrap(b.raw); p.evidence.push(evidence(input, b.raw, b.at)); }
    }
    if (!p.activities && !p.outcomes) return;
    p.warnings.push('共和町 電源立地地域対策交付金 事業評価個表の「交付金事業の概要」欄を事業内容、「交付金事業の定性的な成果及び評価等」欄を成果として収録'
      + '（欄が1段で境が決まる場合のみ）。欄の幅での折り返しだけをつないだ。目的の欄はない。');
    out.push(p);
  });
  // 年度のない個表（泊発電所に係る広報・調査等交付金事業）: 成果及び評価の欄のみ。
  const y = /^別紙\nⅡ．事業評価個表\n番号\n\n交付金事業の名称\n(泊発電所に係る広報・調査等交付金事業)\n/.exec(t);
  const r = /\n交付金事業の成果及び評価\n\n((?:[^\n]+\n)+)\n交付金事業の契約の概要\n/.exec(t);
  if (y && r && t.indexOf('\nⅡ．事業評価個表', y[0].length) < 0) {
    const raw = r[1].slice(0, -1);
    if (raw.endsWith('。')) {
      const p = project(input, `${y[1]}:narrative`, y[1], null, y[0].slice(0, -1), 0);
      p.outcomes = unwrap(raw);
      p.evidence.push(evidence(input, raw, r.index! + r[0].indexOf(r[1])));
      p.warnings.push('共和町 泊発電所に係る広報・調査等交付金事業の事業評価個表の「交付金事業の成果及び評価」欄を成果として収録。欄の幅での折り返しだけをつないだ。');
      out.push(p);
    }
  }
  return out;
}

export const entry = {
  extract,
  scope: '共和町 電源立地地域対策交付金 事業評価個表（平成30・令和元・令和3年度と年度なしの広報・調査等交付金事業）: 交付金事業の概要（事業内容）・定性的な成果及び評価（成果）。目的の欄はない。',
};
