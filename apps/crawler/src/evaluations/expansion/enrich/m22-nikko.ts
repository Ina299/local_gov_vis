import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 日光市（物価高騰対応重点支援地方創生臨時交付金事業 評価検証結果概要 R5・R6）
// 公開済みレコードは同じ資料から年度なしで作られている（年度なしの突き合わせ: 同じ資料の根拠を持つ年度なしの事業票）。
// 「事業目的・概要」欄の「●目的」の段落（直後に NO・事業名が続くもの）を目的、その事業の「●概要」の段落を事業内容とする。
// 段落は次の空行・●の小見出し・NO の行まで。実績・効果の欄は総事業費の数値が行頭に混ざるため扱わない。
const ROW = /●目的\n((?:[^\n●]+\n)+?)\n?(\d+)\n\n((?:[^\n]+\n)+?)\n(R[^\n]+)\n/g;

/** 空行・●の小見出し・NO の行で閉じた段落の行（閉じないまま 3000 字を超えるものは採らない）。 */
function paragraph(t: string, at: number): string[] | null {
  const lines: string[] = [];
  for (const line of t.slice(at, at + 3000).split('\n')) {
    if (!line.trim() || line.startsWith('●') || /^\d+$/.test(line)) return lines.length ? lines : null;
    lines.push(line);
  }
  return null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09206' || !/\/r[56]_hyoukakensyou_bukkakoutou\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(ROW)) {
    const purposeAt = m.index! + '●目的\n'.length, purpose = paragraph(t, purposeAt);
    if (!purpose || purpose.join('\n') !== m[1].replace(/\n$/, '')) continue;
    const name = m[3].replace(/\n/g, ''), nameAt = m.index! + m[0].indexOf(`\n${m[2]}\n\n`) + 1;
    const p = project(input, `${m[2]}:${name}:purpose`, name, null, t.slice(nameAt, nameAt + m[2].length + 2 + m[3].length - 1), nameAt);
    p.projectCode = null;
    p.purpose = unwrap(purpose.join('\n'));
    p.evidence.push(evidence(input, purpose.join('\n'), purposeAt));
    // その事業の「●概要」（期間の行の直後）。
    const after = m.index! + m[0].length, head = t.slice(after, after + 40).match(/^(?:[^\n]*\n){0,3}?\n●概要\n/);
    const activities = head ? paragraph(t, after + head[0].length) : null;
    if (activities) { p.activities = unwrap(activities.join('\n')); p.evidence.push(evidence(input, activities.join('\n'), after + head![0].length)); }
    p.warnings.push('日光市 物価高騰対応重点支援地方創生臨時交付金事業 評価検証結果概要の「事業目的・概要」欄から、●目的（目的）と●概要（事業内容）の段落。欄の幅での折り返しは改行を除いてつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '日光市 物価高騰対応重点支援地方創生臨時交付金事業 評価検証結果概要（R5・R6）: 事業目的・概要欄の●目的・●概要。実績・効果の欄は対象外。',
};
