import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 階上町（令和７年度 教育委員会点検・評価報告書、事業点検・評価シート）
// 公開済みレコードは同じ報告書（20251127-091816.pdf）の「評価結果一覧表」（評価年度＝令和７年度、対象年度＝令和６年度）。
// 各シートの「事業の目的」「事業内容」欄を目的・事業内容として取る。欄の見出しは複数行の欄の縦中央に出力されるため、
// 見出しの行に本文があれば欄は奇数行（見出しの行が中央）、見出しだけの行なら偶数行（見出しの前後に同じ行数）とみなし、
// 「計画の体系」の行から「事業の対象」の行までが二つの欄でちょうど埋まる場合だけ採る。折り返しの改行は除いてつなぐ。
// 「判定説明及び考察」は評価の説明で成果の欄ではないため取らない。

interface Line { s: string; at: number }
interface Cell { value: string; at: number; end: number; next: number }

/** lines の start 行目から、label を縦中央に持つ欄を読む（value: 折り返しを除いた本文、at〜end: 原文の範囲、next: 次の欄の開始行）。 */
function cell(lines: Line[], start: number, label: string): Cell | null {
  const k = lines.slice(start).findIndex(l => l.s === label || l.s.startsWith(`${label} `));
  if (k < 0) return null;
  const head = lines[start + k], inline = head.s !== label;
  if (!inline && k === 0) return null;
  // 見出しの前に k 行あるので、見出しの後にも k 行（見出しの行に本文があれば見出しの行を含めて 2k+1 行）。
  const next = start + 2 * k + 1;
  if (next > lines.length) return null;
  const parts = lines.slice(start, next).flatMap(l => l === head ? (inline ? [l.s.slice(label.length + 1)] : []) : [l.s]);
  const last = lines[next - 1];
  return { value: parts.map(x => x.trim()).join(''), at: lines[start].at, end: last.at + last.s.length, next };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02446' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/20251127-091816.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(/^令和7年度（令和6年度実施分） 事 業 点 検 ・ 評 価 シ ー ト\n事務事業名 ([^\n]+?) 番 号 (\d+)\n/gm)];
  for (const m of heads) {
    const name = m[1].trim();
    const plan = t.indexOf('\n計画の体系 ', m.index!), target = t.indexOf('\n事業の対象 ', m.index!);
    if (plan < 0 || target < 0 || target - m.index! > 1500 || heads.some(h => h.index! > m.index! && h.index! < target)) continue;
    const lines: Line[] = [];
    for (let at = t.indexOf('\n', plan + 1) + 1; at <= target; ) {
      const nl = t.indexOf('\n', at);
      lines.push({ s: t.slice(at, nl), at }); at = nl + 1;
    }
    const a = cell(lines, 0, '事業の目的'), b = a && cell(lines, a.next, '事業内容');
    if (!a || !b || b.next !== lines.length || !a.value || !b.value) continue;
    // 見出しは各欄に1つだけ（欄の境界を見出しの位置から決めるため）。
    const region = lines.map(l => l.s);
    if (region.filter(s => s.startsWith('事業の目的')).length !== 1 || region.filter(s => s.startsWith('事業内容')).length !== 1) continue;
    const p = project(input, `narrative:${m[2]}`, name, 2025, m[0].slice(0, -1), m.index!);
    p.projectCode = null; p.evaluatedFiscalYear = 2024;
    p.purpose = a.value;
    p.activities = b.value;
    p.evidence.push(evidence(input, t.slice(a.at, a.end), a.at), evidence(input, t.slice(b.at, b.end), b.at));
    p.warnings.push('階上町 教育委員会点検・評価報告書（令和７年度・令和６年度実施分）の事業点検・評価シートの「事業の目的」「事業内容」欄を収録。'
      + '欄の見出しが複数行の欄の縦中央に出力されるため、見出しの位置から欄の行数を決め、二つの欄が「計画の体系」から「事業の対象」までの行をちょうど埋める場合に限り、折り返しの改行を除いてつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '階上町 令和７年度 教育委員会点検・評価報告書（20251127-091816.pdf）の事業点検・評価シート: 「事業の目的」「事業内容」欄。',
};
