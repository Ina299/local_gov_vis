import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m28-util';

// ---------------------------------------------------------------- 南阿蘇村（まち・ひと・しごと創生総合戦略に係る効果検証（結果）報告）
// 公開済みレコードは各報告PDFの検証結果の表の事業名から作られ、対象年度は表の年度欄（R4→2022、R6→2024）。評価年度なし。
// 表は1事業1行で、抽出テキストでは列ごとに段落になる。事業名は短い行（7字以下）を折り返した段落、
// 「事業内容」の見出しの後の、句点で終わる最初の段落（事業名の段落を除く）を事業内容として取る。
// 表に事業が1つだけの資料に限る（事業名の段落が1つ、年度欄が1つ）。目的の欄はない。
const FILES = [
  'https://www.vill.minamiaso.lg.jp/kiji003691/3_691_10737_up_qkwzuh78.pdf',
  'https://www.vill.minamiaso.lg.jp/kiji003691/3_691_6657_up_ompoypw1.pdf',
];

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '43433' || !FILES.includes(input.sourceUrl)) return [];
  const t = input.text, blocks: { text: string; at: number }[] = [];
  let pos = 0;
  for (const part of t.split('\n\n')) { blocks.push({ text: part, at: pos }); pos += part.length + 2; }
  const years = blocks.filter(b => /^R\d+$/.test(b.text.trim()));
  const names = blocks.filter(b => { const ls = b.text.split('\n'); return ls.length >= 2 && ls.every(l => l.length && l.length <= 7) && /(事業|プロジェクト)$/.test(ls.join('')); });
  const label = blocks.findIndex(b => /(^|\n)事業内容$/.test(b.text));
  if (years.length !== 1 || names.length !== 1 || label < 0) return [];
  const content = blocks.slice(label + 1).find(b => b !== names[0] && /。$/.test(b.text));
  if (!content) return [];
  const name = names[0].text.split('\n').join('');
  const p = project(input, 'narrative:1', name, null, names[0].text, names[0].at);
  p.projectCode = null;
  p.evaluatedFiscalYear = 2018 + Number(years[0].text.trim().slice(1));
  p.activities = unwrap(content.text, 20);
  p.evidence.push(evidence(input, content.text, content.at));
  p.warnings.push('南阿蘇村 総合戦略に係る効果検証報告の検証結果の表の「事業内容」欄を事業内容として収録。欄の幅での折り返しの改行を除いた。目的の欄はない。');
  return [p];
}

export const entry = {
  extract,
  scope: '南阿蘇村 まち・ひと・しごと創生総合戦略に係る効果検証（結果）報告: 表に1事業だけの資料の「事業内容」（事業内容）。目的の欄はない。',
};
