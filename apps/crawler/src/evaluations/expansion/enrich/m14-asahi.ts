import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m14-util';

// ---------------------------------------------------------------- 朝日町（山形県）（平成22年度 教育委員会事務事業点検・評価報告書 平成21年度分）
// 公開済みレコードは同じ報告書（49.pdf）の事務事業点検・評価調書（対象年度2009・評価年度2010）。調書の「３．事業の実施状況」欄を
// 事業内容として収録する（見出し「３．」から「４．予算額・決算額」まで）。「２．実施計画との関係」の「施策の目的」は
// 実施計画の施策の目的（複数の事業で同じ文）で事業ごとの目的ではないため採らない。「５．事業の評価」の評価の理由は
// 評価項目・選択肢の行と混ざるため採らない。
const SHEET = '事務事業点検・評価調書\n１．事務事業名\n事務事業名\n\n';
const BODY = '３．事業の実施状況\n';
const NEXT = '４．予算額・決算額';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '06323' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/material/files/group/11/49.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.startsWith('平成 22 年度\n\n朝日町教育委員会事務事業点検・評価報告書\n（平成 21 年度分）\n')) return [];
  let at = t.indexOf(SHEET);
  while (at >= 0) {
    const start = at, next = t.indexOf(SHEET, at + SHEET.length), seg = t.slice(start, next < 0 ? t.length : next);
    at = next;
    // 事業名は見出しの後の最初の段（「所管課・係」の見出しが先に来る版はその次の段）。
    const parts = seg.slice(SHEET.length).split('\n\n');
    const nameIdx = parts[0] === '所管課・係' ? 1 : 0, name = parts[nameIdx]?.trim();
    if (!name || name.includes('\n')) continue;
    const a = seg.indexOf(BODY), b = seg.indexOf(NEXT, a);
    if (a < 0 || b < 0) continue;
    let from = a + BODY.length;
    while (seg[from] === '\n') from++;
    const raw = seg.slice(from, b).replace(/\n+$/, '');
    if (!raw.trim()) continue;
    const nameAt = start + SHEET.length + parts.slice(0, nameIdx).reduce((n, s) => n + s.length + 2, 0);
    const p = project(input, `narrative:${name}`, name, 2010, name, nameAt);
    p.projectCode = null; p.evaluatedFiscalYear = 2009;
    p.activities = raw.split(/\n{2,}/).map(r => unwrap(r)).join('\n');
    p.evidence.push(evidence(input, raw, start + from));
    p.warnings.push('朝日町教育委員会 事務事業点検・評価調書（平成21年度分）の「３．事業の実施状況」欄を事業内容として収録。欄の幅での折り返しだけをつないだ。'
      + '「施策の目的」は実施計画の施策単位の文のため、評価の理由は評価項目の行と混ざるため未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '朝日町（山形県） 教育委員会事務事業点検・評価報告書（平成21年度分）の調書: 「３．事業の実施状況」欄。施策の目的は施策単位のため対象外。',
};
