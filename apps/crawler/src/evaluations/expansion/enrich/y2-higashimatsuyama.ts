import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 東松山市（実施計画の事務事業シート。年度なし）
// 公開済みレコード（年度なし）は同じPDFの「事業名 （n）事業名 ― / 戦略 x-x 担当課 ○○課」の事業から作られている。
// その直後の「事業の概要・目的」欄の文を目的として足す。欄の見出し「事業の」「概要・目的」は抽出テキストでは文の行の間に
// 単独の行として、または行頭に「事業の 」「概要・目的 」として挟まるため、見出しを除いた行を欄の幅での折り返しだけつないで収録する
// （行末が句点でなく、次の行が※・①等で始まらない改行を折り返しとみなす。根拠には見出しを含む欄全体の原文を記録）。
// 欄は「方向性 現状値」の行または「指標 」で始まる行の前まで。指標名が欄の下にはみ出す事業（欄の最後の行が句点・※注記で終わらない）と、見出しがそろわない事業、同じ事業名が2回以上ある事業は採らない。
// 年度別計画（主な取組）の欄は年度ごとの列が同じ行に混ざるため採らない。
const SOURCE = 'https://www.city.higashimatsuyama.lg.jp/uploaded/attachment/18971.pdf';
const HEAD = /^事業名 （[０-９\d]+）(\S+) (?:―|戦略 [\d-]+) 担当課 (\S+)\n((?:(?!方向性 現状値|指標 |事業名 )[^\n]*\n){1,8})/gm;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11212' || input.sourceUrl !== SOURCE) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  const count = new Map<string, number>();
  for (const h of heads) count.set(h[1], (count.get(h[1]) ?? 0) + 1);
  for (const h of heads) {
    const [, name, dept, block] = h;
    const end = h.index! + h[0].length;
    // 欄の後に「方向性 現状値」の行（または指標の行）が続くこと（欄の終わりが確かめられること）。
    if (count.get(name) !== 1 || !/^(?:[^\n]*方向性 現状値|指標 )/.test(t.slice(end))) continue;
    const raw = block.slice(0, -1), lines = raw.split('\n');
    const labels = { a: 0, b: 0 };
    const body = lines.map(l => {
      if (l === '事業の') return (labels.a++, null);
      if (l === '概要・目的') return (labels.b++, null);
      if (l.startsWith('事業の ')) return (labels.a++, l.slice(4));
      if (l.startsWith('概要・目的 ')) return (labels.b++, l.slice(6));
      return l;
    }).filter((l): l is string => l !== null);
    if (labels.a !== 1 || labels.b !== 1 || !body.length) continue;
    const last = body[body.length - 1];
    if (!(/。$/.test(last) || /^※/.test(last) || /。（[^（）\n]+）$/.test(last))) continue;
    const p = project(input, `${name}:purpose`, name, null, h[0].slice(0, h[0].indexOf('\n')), h.index!);
    p.department = dept;
    p.purpose = body.reduce((acc, l, i) => i === 0 ? l : acc + (/。$/.test(body[i - 1]) || /^[※・①-⑳]/.test(l) ? '\n' : '') + l, '');
    p.evidence.push(evidence(input, raw, h.index! + h[0].indexOf('\n') + 1));
    p.warnings.push('東松山市 事務事業シートの「事業の概要・目的」欄（行の間に挟まる欄の見出しを除き、欄の幅での折り返しだけをつないだ）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '東松山市 実施計画の事務事業シート: 「事業の概要・目的」欄（目的）。指標名が欄にはみ出す事業、同名の事業、年度別計画（年度の列が混ざる）は対象外。',
};
