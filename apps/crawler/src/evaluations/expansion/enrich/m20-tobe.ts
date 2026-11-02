import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 砥部町（令和４年度【令和３年度事業】教育委員会点検評価報告書、事業別評価表）
// 公開済みレコードは同じ報告書（25980.pdf、対象年度＝令和３年度）の事業別評価表。「事業目的」欄を目的として取る。
// 欄の本文は見出し「事業目的」の前の行に始まり、見出し（と取組内容の番号「１」）の後の行に続くことがある。
// 見出しの前の1行が句点で終われば1行だけ、そうでなければ見出しの後の最初の行が句点で終わる場合に限り2行をつなぐ
// （3行以上にわたる版は欄の終わりが決まらないため採らない）。取組内容・自己評価は表の列が混ざるため取らない。
const SHEET = /事業№\n\n(\d+)\n\n(?:([^\n]+)\n\n事業名|事業名\n\n([^\n]+))\n\n(?:決算額\n\n[^\n]+|[^\n]+\n\n決算額)\n\n([^\n]+)\n\n事業目的\n\n(?:１\n\n)?([^\n]+)\n/g;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '38402' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/25980.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  if (!t.startsWith('令和４年度【令和３年度事業】')) return [];
  for (const m of t.matchAll(SHEET)) {
    const name = (m[2] ?? m[3]).trim(), l1 = m[4].trim(), l2 = m[5].trim();
    if (/^(事業名|決算額|事業№)$/.test(name)) continue;
    const at1 = m.index! + m[0].indexOf(`\n\n${m[4]}\n\n事業目的\n`) + 2;
    let purpose: string, raw: string;
    if (l1.endsWith('。')) { purpose = l1; raw = m[4]; }
    else if (l2.endsWith('。') && l2 !== '１') { purpose = l1 + l2; raw = t.slice(at1, m.index! + m[0].length - 1); }
    else continue;
    const p = project(input, `narrative:${name}`, name, null, m[0].slice(0, m[0].indexOf('\n\n', m[0].indexOf(name) + name.length)), m.index!);
    p.projectCode = null; p.evaluatedFiscalYear = 2021;
    p.purpose = purpose;
    p.evidence.push(evidence(input, raw, at1));
    p.warnings.push('砥部町 教育委員会点検評価報告書（令和３年度事業）事業別評価表の「事業目的」欄を目的として収録。'
      + '見出しの前後に分かれて出力された本文は、句点までの2行に限りつないだ（見出し・取組内容の番号の行は含めない）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '砥部町 令和４年度【令和３年度事業】教育委員会点検評価報告書（25980.pdf）の事業別評価表: 「事業目的」欄（2行までで句点で終わる版のみ）。',
};
