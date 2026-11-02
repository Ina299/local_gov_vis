import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 下川町（令和７年度 事務事業評価調書（令和６年度決算）、資料３）
// 公開済みレコードは同じ調書（02-R7hyouka.pdf）と総合計画審議会の中間報告（01-R7houkoku.pdf）の事務事業（対象年度＝令和６年度）。
// 中間報告は審議会の意見だけなので、調書の「事業の目的」欄を目的、「事業の概要」欄を事業内容として取る。
// 事業名は「事業名」の見出しの次の行で、その次の行が「施 策」の見出しの版だけ（見出しと事業名の間に表の数値などが割り込む版は採らない）。
// 欄は見出しの次の行から次の見出し（「事業の概要」「令和６年度実施内容」）の手前まで。
const HEAD = /\n事業名\n([^\n]+)\n施 策\n/g;
const BODY = /\n事業の目的\n((?:[^\n]+\n)+?)事業の概要\n((?:[^\n]+\n)+?)\n?令和６年度実施内容\n/;

/** 句点で終わる行と、記号で始まる行の前でだけ改行を残し、欄の幅での折り返しの改行は除く。 */
const join = (lines: string[]) => lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') || /^[・※]/.test(l) ? '\n' : '') + l, '');
const ok = (lines: string[]) => lines.length > 0 && !lines.some(l => /^[\d,]+$|^(施 策|推進施策|担当課|事業名)/.test(l));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01468' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/02-R7hyouka.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/\n事業名\n/g)].map(m => m.index!);
  for (const h of t.matchAll(HEAD)) {
    const start = h.index!, next = starts.find(s => s > start);
    if (next === undefined && input.truncated) continue;
    const seg = t.slice(start, next ?? t.length), b = BODY.exec(seg);
    if (!b) continue;
    const pl = b[1].trimEnd().split('\n'), al = b[2].trimEnd().split('\n');
    if (!ok(pl) || !ok(al)) continue;
    const name = h[1].trim();
    const p = project(input, `narrative:${name}`, name, null, h[0].slice(1, -1), start + 1);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.purpose = join(pl.map(l => l.trim()));
    p.activities = join(al.map(l => l.trim()));
    const at = start + b.index;
    p.evidence.push(evidence(input, b[1].trimEnd(), at + '\n事業の目的\n'.length), evidence(input, b[2].trimEnd(), at + b[0].indexOf('事業の概要\n') + '事業の概要\n'.length));
    p.warnings.push('下川町 令和７年度事務事業評価調書（令和６年度決算）の「事業の目的」欄を目的、「事業の概要」欄を事業内容として収録。欄の幅での折り返しの改行を除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '下川町 令和７年度 事務事業評価調書（02-R7hyouka.pdf）: 「事業の目的」（目的）・「事業の概要」（事業内容）欄。事業名の行の位置が決まらない版は対象外。',
};
