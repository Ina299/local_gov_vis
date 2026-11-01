/** 明石市 (28203): 令和７年度 事務事業点検シート（部局別PDF）の「目的」「指標で表せない成果」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ点検シートの事業（事務事業名・事業所管課・評価年度2025）。1事業2ページで、2ページ目の見出しに同じ整理番号・事務事業名が出る。
// 目的の欄は「目的（誰を・何を、どういう状態にしたいのか）」の次の行から、縦書きの欄名「事業の目的・目標」の1字ずつ（事・業・の）が行頭に付いて印字される。
// 目的が1行（事 …／業／の）か2行（事 …／業 …／の）で、その直後が「目 成果指標」になる票だけを採る（2行のときは1行目が折り返しの長さであること）。
// 2行のときは行頭の欄名の字（業）を除いて1行目に続ける。事業内容の欄は成果指標の表との境目が本文で確定しないため採らない。
// 成果は2ページ目の「指標で表せない成果」の欄（次の「観点（満たしていない観点に「×」）」の見出しまで。欄名の字が混ざらない票のみ）。
const HEAD = /令和７年度 事務事業点検シート\n新規\/継続 [^\n]*整理番号 (\d{10}) - (\d{3})\n事務事業名\n([^\n]+)\n/g;
const PURPOSE = /\n目的（誰を・何を、どういう状態にしたいのか）\n事 ([^\n]+)\n業(?: ([^\n]+))?\nの\n目 成果指標/;
const OUTCOME = /\n指標で表せない成果\n((?:[^\n]{3,}\n)+?)観点（満たしていない観点に「×」）\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '28203' || !input.sourceUrl.includes('/documents/39115/')) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[k + 1]?.index ?? t.length);
    const [, code, branch, rawName] = h, name = rawName.trim();
    const page2 = seg.indexOf(`\n令和７年度 事務事業点検シート\n整理番号 ${code}-${branch} 事務事業名 ${name}\n`);
    const dep = /\n[^\n]* 事業所管課 (\S+)\n/.exec(seg);
    if (page2 < 0 || !dep || /事務事業点検シート|観点（/.test(seg.slice(0, page2).replace(/^令和７年度 事務事業点検シート\n/, ''))) return;
    const p = project(input, `補強:${code}-${branch}`, name, 2025, h[0].slice(0, -1), start);
    p.projectCode = `${code}-${branch}`;
    p.department = dep[1];
    p.evidence.push(evidence(input, dep[0].slice(1, -1), start + dep.index + 1));
    const pu = PURPOSE.exec(seg.slice(0, page2));
    if (pu && (!pu[2] || pu[1].length >= 50)) {
      p.purpose = pu[2] ? pu[1] + pu[2] : pu[1];
      p.evidence.push(evidence(input, pu[0].slice(1), start + pu.index + 1));
    }
    const oc = OUTCOME.exec(seg.slice(page2));
    if (oc && !/観点（|事務事業点検シート/.test(oc[1]) && oc[1].trim().length >= 10) {
      p.outcomes = oc[1].slice(0, -1);
      p.evidence.push(evidence(input, oc[0].slice(1, -1), start + page2 + oc.index + 1));
    }
    if (!p.purpose && !p.outcomes) return;
    p.warnings.push('事務事業点検シートの「目的（誰を・何を、どういう状態にしたいのか）」「指標で表せない成果」欄の原文。目的が2行の票は行頭の縦書きの欄名の字（業）を除いて1行目に続けた（出典は欄名の字を含む原文）。'
      + '成果は改行も原文のまま。事業内容の欄は成果指標の表との境目が抽出テキストで確定しないため未収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '明石市 令和７年度 事務事業点検シート（部局別PDF）から、目的（1〜2行の欄）と2ページ目の「指標で表せない成果」の欄。事業内容は表との境目が確定しないため対象外。',
};
