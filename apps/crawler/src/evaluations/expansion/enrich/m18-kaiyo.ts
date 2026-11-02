import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 海陽町（令和7年度（令和6年度決算）事務事業評価シート）
// 公開済みレコードは同じ報告書の評価シートごとの事業（評価年度2025・事業年度2024）。シートの「事業目的」欄の文は、抽出テキストでは
// 事業費の表（Ｒ４〜Ｒ６）と所管種別の後、「主な事業 内容 (Plan)」の欄の段落の直前の段落に来る。
// ここではその段落が文（句点で終わる3行以内）で、「事業目的」「主な事業」の見出しが混ざらない場合に限り目的として足す。
// 見出し「事業目的」が段落の途中の行に割り込むシート（目的の文と事業内容の文が区切りなく続く）は採らない。
// 事業内容の欄は「主な事業」「内容」「(Plan)」の見出しが文の途中の行に割り込むため採らない。
const ID = '351573c2f052934af6522a86';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '36388' || input.sourceId !== ID) return [];
  const t = input.text, heads = [...t.matchAll(/令和[7７]年度（令和[6６]年度決算）事務事業評価シート\n/g)];
  const sheets = heads.map((h, i) => {
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    return { start, seg, name: /\n事業名\n\n([^\n]+)\n/.exec(seg) };
  });
  const count = new Map<string, number>();
  for (const s of sheets) if (s.name) count.set(s.name[1].trim(), (count.get(s.name[1].trim()) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  sheets.forEach(({ start, seg, name }, i) => {
    if (!name || count.get(name[1].trim()) !== 1 || (input.truncated && i === sheets.length - 1)) return;
    // 「主な事業」の行を含む最初の段落と、その直前の段落。
    const paras = [...seg.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ text: m[0], at: m.index! }));
    const k = paras.findIndex(p => /^主な事業/m.test(p.text));
    if (k < 1) return;
    const raw = paras[k - 1].text, lines = raw.split('\n');
    if (!raw.endsWith('。') || /事業目的|^主な事業|^内容$|^\(Plan\)/m.test(raw) || lines.length > 3) return;
    const projectName = name[1].trim();
    const p = project(input, `${projectName}:purpose`, projectName, 2025, name[0].slice(1, -1), start + name.index! + 1);
    p.evaluatedFiscalYear = 2024;
    p.purpose = joinWrapped(raw, 40);
    p.evidence.push(evidence(input, raw, start + paras[k - 1].at));
    p.warnings.push('事務事業評価シートの「事業目的」欄（抽出テキストで事業費・所管種別の後、主な事業内容の欄の直前の段落。欄の幅での折り返しだけを除いてつないだ）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '海陽町 令和7年度（令和6年度決算）事務事業評価シート: 事業目的欄（見出しが文に割り込まず、主な事業内容の欄と区切られているシートのみ）。主な事業内容の欄は見出しが文の途中に割り込むため対象外。',
};
