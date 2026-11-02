import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m14-util';

// ---------------------------------------------------------------- 白石町（白石町教育委員会点検評価報告書 令和６年度事業）
// 公開済みレコードは同じ報告書の主要事業点検・評価シート（対象年度2024）。シートの「1 事業概要」欄（「2 事業実績」の見出しまで）を
// 事業内容として収録する。欄が「（１）目的」「（２）事業内容」に分かれる版は、それぞれを目的・事業内容とする。
// 欄の本文は最初の空行まで。空行の後に表の見出しの1字（「内」「容」）やページ番号以外の行が続く版は、表の列と混ざっているため採らない。
// 事業名はシートの見出しの後、「事業名」の見出しの直前の段（「No.○」の段の次に来る版もある）。
const SHEET = '令和６年度 白石町教育委員会 主要事業点検・評価シート\n\n';
const BLOCK = /\n[1１] 事業概要\n([\s\S]*?)\n[2２] 事業実績\n/;
/** 欄の本文の後に混ざってよい行（表の見出しの1字・ページ番号）。 */
const JUNK = /^(内|容|P\d+)?$/;

/** 本文（最初の空行まで）と、その後が混ざってよい行だけであること。 */
function body(block: string): string | null {
  const cut = block.indexOf('\n\n'), raw = (cut < 0 ? block : block.slice(0, cut)).replace(/\n+$/, '');
  if (cut >= 0 && !block.slice(cut).split('\n').every(l => JUNK.test(l.trim()))) return null;
  const lines = raw.split('\n');
  if (!raw.trim() || lines.some(l => !l.trim() || /^[①-⑳]$/.test(l.trim()))) return null;
  return raw;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '41425' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/0034/7359/125122617266.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.includes('白石町教育委員会点検評価報告書\n[令和６年度事業]\n')) return [];
  let at = t.indexOf(SHEET);
  while (at >= 0) {
    const start = at, next = t.indexOf(SHEET, at + SHEET.length), seg = t.slice(start, next < 0 ? t.length : next);
    at = next;
    const parts = seg.slice(SHEET.length).split('\n\n');
    const ni = /^No\.?\d+$/.test(parts[0]) ? 1 : 0, name = parts[ni]?.trim();
    if (!name || name.includes('\n') || !parts[ni + 1]?.startsWith('事業名\n')) continue;
    const bm = BLOCK.exec(seg);
    if (!bm) continue;
    const blockAt = start + bm.index + bm[0].indexOf('事業概要\n') + '事業概要\n'.length;
    const fields: { key: 'purpose' | 'activities'; raw: string; at: number }[] = [];
    const split = /^（１）目的\n([\s\S]*?)\n\n内\n\n（２）事業内容\n([\s\S]*)$/.exec(bm[1]);
    if (split) {
      const pu = body(split[1]), ac = body(split[2]);
      if (!pu || !ac) continue;
      fields.push({ key: 'purpose', raw: pu, at: blockAt + '（１）目的\n'.length });
      fields.push({ key: 'activities', raw: ac, at: blockAt + bm[1].indexOf('（２）事業内容\n') + '（２）事業内容\n'.length });
    } else {
      if (/（[１２]）/.test(bm[1].split('\n')[0])) continue;
      const ac = body(bm[1]);
      if (!ac) continue;
      fields.push({ key: 'activities', raw: ac, at: blockAt });
    }
    const nameAt = start + SHEET.length + parts.slice(0, ni).reduce((n, s) => n + s.length + 2, 0);
    const p = project(input, `narrative:${name}`, name, null, name, nameAt);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    for (const f of fields) {
      p[f.key] = unwrap(f.raw);
      p.evidence.push(evidence(input, f.raw, f.at));
    }
    p.warnings.push('白石町教育委員会 主要事業点検・評価シート（令和６年度事業）の「1 事業概要」欄を事業内容として収録'
      + '（「（１）目的」「（２）事業内容」に分かれる版はそれぞれ目的・事業内容）。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '白石町 教育委員会点検評価報告書（令和６年度事業）の主要事業点検・評価シート: 「1 事業概要」欄（目的・事業内容に分かれる版はそれぞれ）。表の列と混ざる版は対象外。',
};
