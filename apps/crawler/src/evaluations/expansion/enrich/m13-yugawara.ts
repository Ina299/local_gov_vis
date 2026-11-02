import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 湯河原町（令和７年度事務事業評価シート、目的・内容）
// 公開済みレコードは「令和７年度事務事業評価 対象事業一覧」の事業名（評価年2025・事業概要は令和６年度）。金額・評価は n5-yugawara.ts で補強済み。
// 評価シート「１ 事業概要（令和６年度）」の縦書き見出し「目／的」「対／象」「内／容」の欄を取る。見出しと本文が
// 「目 的 → 本文 → 対 象 → 本文 → 内 容 → 本文 → ２ 実施結果」の順に並ぶ（または「容 → 本文 → 内」と見出しが本文を挟む）シートだけを対象にし、
// 見出しがまとめて出力されて本文との対応が並び順でしか決まらないシートは採らない。
const SHEET_HEAD = /^令和７年度事務事業評価シート\n/gm;
const FIELDS = /\n目\n\n的\n\n((?:[^\n]+\n)*?[^\n]+)\n\n対\n\n象\n\n((?:[^\n]+\n)*?[^\n]+)\n\n(?:内\n\n容\n\n((?:[^\n]+\n)*?[^\n]+)\n\n|容\n\n((?:[^\n]+\n)*?[^\n]+)\n\n内\n\n)２ 実施結果\n/;
/** 見出しの1字や表の数値だけの行が混ざる欄は採らない。 */
const STRAY = /^([目的対象内容]|[\d,]+|○)$/m;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14384' || input.format !== 'pdf') return [];
  const t = input.text, starts = [...t.matchAll(SHEET_HEAD)].map(m => m.index!), out: ProjectEvaluation[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i], seg = t.slice(start, starts[i + 1] ?? t.length);
    const names = [...seg.slice(0, 400).matchAll(/\n事 務 事 業 名 ([^\n]+)\n/g)];
    if (names.length !== 1 || !seg.includes('１ 事業概要（令和６年度）')) continue;
    const name = names[0][1].trim(), k = (seen.get(name) ?? 0) + 1;
    seen.set(name, k);
    const f = FIELDS.exec(seg);
    if (!f) continue;
    const purpose = f[1], content = f[3] ?? f[4];
    if (STRAY.test(purpose) || STRAY.test(content)) continue;
    const p = project(input, `narrative:${name}#${k}`, name, 2025, seg.slice(0, names[0].index! + names[0][0].length - 1), start);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    const at = (s: string, from: number) => start + seg.indexOf(s, from);
    p.purpose = unwrap(purpose);
    p.activities = unwrap(content);
    p.evidence.push(evidence(input, '１ 事業概要（令和６年度）', at('１ 事業概要（令和６年度）', 0)),
      evidence(input, purpose, at(purpose, f.index)), evidence(input, content, at(content, f.index + f[0].indexOf(content))));
    p.warnings.push('湯河原町 令和７年度事務事業評価シート「１ 事業概要（令和６年度）」の「目的」欄を目的、「内容」欄を事業内容として収録。'
      + '見出しと本文が交互に並ぶシートのみ（見出しがまとめて出力されたシートは対象外）。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '湯河原町 令和７年度事務事業評価シート（課別PDF）: 事業概要（令和６年度）の「目的」「内容」欄（見出しと本文が交互に並ぶシートのみ）。',
};
