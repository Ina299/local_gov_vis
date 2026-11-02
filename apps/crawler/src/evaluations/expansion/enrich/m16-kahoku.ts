import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 河北町教育委員会 事務事業点検及び評価報告書（令和５年度・令和４年度分）
// 公開済みレコードは同じ報告書の「事務事業点検及び評価調書」から作られ、目的が空。調書の「２ 事業の概要」の
// 「事業目的」「事業内容」欄を足す。抽出テキストで「事業目的\n\n本文1行\n\n事業内容\n\n本文1行\n\n」と見出しと本文が
// 交互に並ぶ調書に限る（学校教育課の調書は見出しが続けて出て本文の対応が並び順でしか決まらないため対象外）。
// 事業名は「事業名\n\n番号 事業名」の行。年度は表紙の「令和５年度 …（令和４年度分）」。
const n = (s: string) => Number(s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '06321' || !/\/material\/files\/group\/14\/R5jimujigyouhyouka\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, title = /^令和([０-９\d]+)年度\n\n河北町教育委員会事務事業点検及び評価報告書\n（令和([０-９\d]+)年度分）\n/.exec(t);
  if (!title) return [];
  // 調書ごとに区切り、事業名が「事業名\n\n番号 事業名」の形で出る調書だけを採る。
  const sheets = [...t.matchAll(/事務事業点検及び評価調書\n/g)].map(m => m.index!), out: ProjectEvaluation[] = [];
  for (let i = 0; i < sheets.length; i++) {
    if (input.truncated && i === sheets.length - 1) continue;
    const start = sheets[i], seg = t.slice(start, sheets[i + 1] ?? t.length);
    const head = /^事務事業点検及び評価調書\n１\n\n事業名等\n事業名\n\n[０-９\d]+ ([^\n]+)\n\n/.exec(seg);
    if (!head) continue;
    const end = seg.indexOf('\n事業の実施状況\n');
    const f = /\n事業目的\n\n([^\n]+)\n\n事業内容\n\n([^\n]+)\n\n/.exec(seg.slice(0, end < 0 ? seg.length : end));
    if (!f || [...seg.matchAll(/\n事業目的\n/g)].length !== 1) continue;
    const name = head[1].trim();
    const nameAt = start + head[0].indexOf(head[1], head[0].indexOf('事業名\n\n'));
    const p = project(input, `${name}:purpose`, name, 2018 + n(title[1]), head[1], nameAt);
    p.evaluatedFiscalYear = 2018 + n(title[2]);
    p.purpose = f[1].trim();
    p.activities = f[2].trim();
    const at = start + f.index! + '\n事業目的\n\n'.length;
    p.evidence.push(evidence(input, f[1], at));
    p.evidence.push(evidence(input, f[2], at + f[1].length + '\n\n事業内容\n\n'.length));
    p.warnings.push('河北町教育委員会 事務事業点検及び評価調書の「事業目的」「事業内容」欄（見出しと本文が交互に並ぶ調書に限る）。');
    out.push(p);
  }
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '河北町教育委員会 事務事業点検及び評価調書（令和４年度分）の「事業目的」「事業内容」欄（見出しの位置が確定する調書のみ）。' };
