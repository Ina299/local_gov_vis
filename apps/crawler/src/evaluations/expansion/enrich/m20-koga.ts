import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 古河市（令和６年度 成果説明書兼事業評価書）
// 公開済みレコードは同じ評価書（R6hyouka.pdf）の重点事業（対象年度＝令和６年度）。事業ごとの票の「【目的・成果見込】」欄を目的、
// 「【令和 6年度 事業の手段】」欄を事業内容として取る。目的欄は右段の「【事業の対象】」と行ごとに交互に出力される版があるため、
// 見出しの直後に【事業の対象】が来る版（交互に混ざる版）は目的を採らず、目的の本文が空行と【事業の手段】の見出しで閉じる版だけを採る。
// 事業の手段は見出しの次の行から空行までの箇条（右段だけの欄）。
const HEAD = /\n事業名称\n\n([^\n]+)\n\n所属課\n/g;
const PURPOSE = /\n【目的・成果見込】\n((?:[^\n]+\n)+)\n【令和 ?6年度 事業の手段】\n/;
const MEANS = /\n【令和 ?6年度 事業の手段】\n((?:[^\n]+\n)+)\n/;
/** 箇条・小見出しの始まり（この記号で始まる行は前の行の続きとみなさない）。 */
const MARK = /^[・〇○◯●■□◆①-⑳【（(]|^[0-9０-９]+[.．、)）]/;

/** 欄の幅での折り返しの改行を除く。句点で終わる行の後、箇条の記号で始まる行の前、欄の幅に満たない行の後の改行は残す。 */
function join(lines: string[]): string {
  const width = Math.max(...lines.map(l => l.length));
  return lines.reduce((acc, l, i) => {
    const prev = lines[i - 1];
    const wrap = i > 0 && !prev.endsWith('。') && !MARK.test(l) && prev.length >= width - 3;
    return acc + (i === 0 ? '' : wrap ? '' : '\n') + l;
  }, '');
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08204' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/R6hyouka.pdf')) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if ((seg.match(/【目的・成果見込】/g) ?? []).length !== 1 || (seg.match(/事業の手段】/g) ?? []).length !== 1) continue;
    const p = project(input, `narrative:${h[1].trim()}`, h[1].trim(), null, h[0].slice(1, -1), start + 1);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    const pm = PURPOSE.exec(seg);
    if (pm && !pm[1].includes('【') && pm[1].includes('。')) {
      p.purpose = join(pm[1].trimEnd().split('\n').map(l => l.trim()));
      p.evidence.push(evidence(input, pm[1].trimEnd(), start + pm.index + '\n【目的・成果見込】\n'.length));
    }
    const mm = MEANS.exec(seg);
    if (mm) {
      const lines = mm[1].trimEnd().split('\n').map(l => l.trim());
      if (!lines.some(l => /^【(事業の対象|策定時特記事項|評価時特記事項|実施経緯|実施体制)】/.test(l))) {
        // 右段は幅が狭く、箇条の記号のない項目の行と折り返しの行を区別できないため、改行はそのまま残す。
        p.activities = lines.join('\n');
        p.evidence.push(evidence(input, mm[1].trimEnd(), start + mm.index + mm[0].indexOf(mm[1])));
      }
    }
    if (!p.purpose && !p.activities) continue;
    p.warnings.push('古河市 令和６年度成果説明書兼事業評価書の「【目的・成果見込】」欄を目的、「【令和 6年度 事業の手段】」欄を事業内容として収録。'
      + '目的は右段の【事業の対象】と行が交互に混ざらない版のみ。目的は欄の幅での折り返しの改行を除き、事業の手段は改行をそのまま残した。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '古河市 令和６年度 成果説明書兼事業評価書（R6hyouka.pdf）: 「【目的・成果見込】」（事業の対象の欄と混ざらない版のみ）・「【令和 6年度 事業の手段】」欄。',
};
