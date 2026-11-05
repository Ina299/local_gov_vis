import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 小浜市（教育委員会の点検・評価報告書 平成26年度（平成25年度分））
// 公開済みレコードは同じ報告書の事業費・評価の表の事業名（evaluationYear 2014、evaluatedFiscalYear 2013）。
// 「評価実施結果の概要」の［点検及び評価を行う事務事業の実施状況］は「◆事業名」「（平成２５年度小浜市事務事業評価対象（外）事業）」
// の後に事業ごとの実施状況の段落がある。これを事業内容とする（次の◆の行・空行の手前まで。句点で終わらない段落＝ページで切れたものは採らない）。
// 事務事業評価シートの「意図（どうしたいか）」「成果の概要（目的に対する成果）」の欄は見出しの文字が本文の行の途中に混ざって
// 出力され、欄の境が決まらないため採らない。
const TITLE = /^平成２６年度\n（平成２５年度分）\n\n小浜市教育委員会の事務の管理\n及び執行状況の点検・評価報告書\n/;
const ITEM = /^◆([^\n]+)\n\n（平成２５年度小浜市事務事業評価対象(?:外)?事業）\n\n(（Ｈ[^\n]*）\n)?/gm;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '18204' || !/\/edu\/p000000c_d\/fil\/5024h26\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, title = TITLE.exec(t), out: ProjectEvaluation[] = [];
  if (!title) return [];
  for (const m of t.matchAll(ITEM)) {
    const at = m.index! + m[0].length, lines: string[] = [];
    let pos = at;
    while (pos < t.length) {
      const e = t.indexOf('\n', pos);
      if (e < 0) break;
      const line = t.slice(pos, e);
      if (!line.trim() || line.startsWith('◆')) break;
      lines.push(line);
      pos = e + 1;
    }
    if (!lines.length || !lines.at(-1)!.endsWith('。')) continue;
    const raw = lines.join('\n'), name = m[1].trim();
    const p = project(input, `H25:${name}:narrative`, name, 2014, m[0].trimEnd(), m.index!);
    p.evaluatedFiscalYear = 2013;
    p.activities = unwrap(raw);
    p.evidence.push(evidence(input, title[0], 0), evidence(input, raw, at));
    p.warnings.push('小浜市教育委員会 点検・評価報告書（平成25年度分）の「点検及び評価を行う事務事業の実施状況」の段落を事業内容として収録。'
      + '行の幅での折り返しだけをつないだ。事務事業評価シートの意図・成果の概要の欄は見出しと本文が混ざるため未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '小浜市 教育委員会の点検・評価報告書（平成25年度分）: 事務事業の実施状況の段落（事業内容）。',
};
