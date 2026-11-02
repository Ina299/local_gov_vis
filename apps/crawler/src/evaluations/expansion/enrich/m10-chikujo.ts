import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped, radicals } from './m10-util';

// ---------------------------------------------------------------- 築上町（2024年度 事務事業評価シート）
// 公開済みレコードは同じ資料の評価シートから作られ（事業名・担当課は康熙部首を通常の漢字に直したもの）、目的が空欄。
// 「２．事業の概要」の「手段（どのように）」の見出しの後に、空行で区切られた2つの段（手段の文、意図の文）が続き、その後に
// 「意図（どうしたいのか）」の見出しが来る形に限る（意図の文の折り返しが見出しの行に付く場合はつなぐ）。段が3つ以上ある
// シートは手段と意図の境が決まらないため採らない。意図→目的、手段→事業内容。
const HEAD = /2024年度\n予算事業名\n\n事 務 事 業 評 価 シ ー ト\n\n/g;
/** 公開済みレコードの事業名・担当課と同じ直し方（康熙部首のNFKCだけ）。 */
const asPublished = (s: string) => s.replace(/[⺀-⿟]/g, c => c.normalize('NFKC'));
const FIELD = /\n手段\n（どのように）\n\n((?:[^\n]+\n)+)\n((?:[^\n]+\n)+)意図\n（どうしたいのか）(?: ([^\n]+))?\n\n３．事業の実績/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40647' || !/\/R6_hyokasheet\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[k + 1]?.index ?? t.length);
    const nm = /^2024年度\n予算事業名\n\n事 務 事 業 評 価 シ ー ト\n\n(?:事業No\.\d+\n\n)?([^\n]+)\n/.exec(seg);
    const dept = /\n担当課 ([^\n]+)\n/.exec(seg), no = /事業No\.(\d+)/.exec(seg), f = FIELD.exec(seg);
    if (!nm || !dept || !no || nm[1].startsWith('担当課') || !f) return;
    const name = asPublished(nm[1].trim());
    const p = project(input, `No.${no[1]}:narrative`, name, 2024, nm[0].replace(/\n+$/, ''), start);
    p.department = asPublished(dept[1].trim());
    const actRaw = f[1].slice(0, -1), purRaw = f[2] + '意図\n（どうしたいのか）' + (f[3] ? ' ' + f[3] : '');
    const at = start + f.index! + f[0].indexOf('\n\n', '\n手段\n（どのように）'.length) + 2;
    p.activities = radicals(joinWrapped(actRaw, 35));
    p.purpose = radicals(joinWrapped(f[2].slice(0, -1) + (f[3] ? '\n' + f[3] : ''), 35));
    p.evidence.push(evidence(input, actRaw, at), evidence(input, purRaw, at + f[1].length + 1));
    p.warnings.push('事務事業評価シート「２．事業の概要」の「意図（どうしたいのか）」「手段（どのように）」欄。欄の幅での折り返しだけをつなぎ、康熙部首の字形を通常の漢字に直した。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '築上町 2024年度 事務事業評価シート: 意図（目的）・手段（事業内容）。手段と意図の段の境が決まらないシートは対象外。',
};
