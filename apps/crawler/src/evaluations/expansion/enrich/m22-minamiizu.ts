import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 南伊豆町（物価高騰対応重点支援地方創生臨時交付金活用事業 成果説明書 R5・実績報告書 R6）
// 公開済みレコードは同じ資料から年度なしで作られている（年度なしの突き合わせ: 同じ資料の根拠を持つ年度なしの事業票）。
// 「事業の目的・効果」欄（目的と効果を合わせた欄）は、欄の見出し（R6 は1字ずつ分かれ、最後の「果」）の直後の空行から
// 「経費の概要」の直前の空行までの段落。結果欄は設定理由・総事業費の値と混ざるため扱わない。
const TITLE = /物価高騰対応重点支援地方創生臨時交付金活用事業(?:成果説明書|実績報告書)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22304' || !/\/R0[56]jisseki\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [], heads = [...t.matchAll(TITLE)];
  heads.forEach((h, i) => {
    const from = h.index!, seg = t.slice(from, heads[i + 1]?.index ?? t.length);
    const nameAt = seg.indexOf('\n名\n\n'), cost = seg.indexOf('\n\n経費の概要\n');
    if (nameAt < 0 || cost < 0 || seg.indexOf('\n\n経費の概要\n', cost + 1) >= 0) return;
    // 事業名: 「名」の後の空行までの行（最後の行が所管課なら除く）。
    const nameLines = seg.slice(nameAt + 4).split('\n\n')[0].split('\n');
    if (nameLines.length > 1 && /課$/.test(nameLines[nameLines.length - 1])) nameLines.pop();
    const label = /(?:\n事 業 の 目 的 ・ 効 果|\n果)\n\n$/.exec(seg.slice(0, seg.lastIndexOf('\n\n', cost - 1) + 2));
    if (!label || nameLines.length > 2) return;
    const at = label.index! + label[0].length, raw = seg.slice(at, cost);
    if (!raw.trim() || raw.includes('\n\n') || !/。$/.test(raw)) return;
    const name = nameLines.join('');
    const p = project(input, `${name}:purpose`, name, null, nameLines.join('\n'), from + nameAt + 4);
    p.projectCode = null;
    p.purpose = unwrap(raw);
    p.evidence.push(evidence(input, raw, from + at));
    p.warnings.push('南伊豆町 物価高騰対応重点支援地方創生臨時交付金活用事業の成果説明書・実績報告書の「事業の目的・効果」欄（目的と効果を合わせた欄）。欄の幅での折り返しは改行を除いてつないだ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '南伊豆町 物価高騰対応重点支援地方創生臨時交付金活用事業 成果説明書（R5）・実績報告書（R6）: 事業の目的・効果欄。',
};
