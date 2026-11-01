/**
 * 11243 吉川市: 令和7年度 事務事業評価シート（部別PDF）。様式に目的欄はなく、「事 業 概 要」欄を公開済みレコード（同じシート）の
 * 空欄の事業内容として補う。抽出テキストの形は2通り。
 *  - 欄ごとに区切られた形: 見出しの直後から事業費表の見出し（令和4年度）の直前まで。
 *  - 行の配置を保った形: 「施策の展開」の行と事業費表の見出し行の間。欄の左に印字された「項」「事 業 概 要」が本文の行の間
 *    （または行頭）に入るため、その見出しだけを除く。見出しがそれぞれ1回だけの場合に限る。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { block, blockEvidence } from './m3-narrative';

const SHEET = /事務事業評価シート\n\n令和7年度\n基\n\n事務事業名\n\n所管部署名\n\n([^\n]+)\n(?:([^\n]+)\n)?\n/g;
const STOP = /^令和4年度$/;
/** 行の配置を保った形の票の先頭（事業番号・事務事業名）。 */
const LAYOUT = /令和7年度 事務事業評価シート [^\n]*No\. (\d{8})\n[^\n]*\n基\n事務事業名 ([^\n]+)\n/g;
const MARK = /^(・|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩|【|※|○|〇)/;

function sheetRecord(input: CachedInput, at: number, name: string, head: string): ProjectEvaluation {
  const p = project(input, `narrative-${at}`, name, 2025, head, at);
  p.id = stableId(input, `narrative-${at}`, 2025);
  p.projectCode = null; p.evaluatedFiscalYear = 2025;
  p.warnings.push('吉川市 令和7年度 事務事業評価シートの「事業概要」欄を事業内容として収録（様式に目的欄はない）。欄の見出し（項・事 業 概 要）とPDFの折り返しの改行だけを除いた。');
  return p;
}

function separated(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, heads = [...t.matchAll(SHEET)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    // 保存テキストが途中で切れている資料の最後の票は使わない。
    if (input.truncated && k === heads.length - 1) return;
    const seg = t.slice(h.index!, heads[k + 1]?.index ?? t.length);
    const name = h[1] + (h[2] ?? '');
    // 折り返した事業名は、つないだ名前が同じ票の別の箇所に1行で印字されている場合だけ（公開済みの抽出と同じ）。
    if (h[2] && !seg.slice(h[0].length).includes(name)) return;
    const ms = [...seg.matchAll(/\n事 業 概 要\n\n/g)];
    if (ms.length !== 1) return;
    const at = h.index! + ms[0].index! + ms[0][0].length;
    const b = block(t, at, STOP, { minWrap: 50 });
    if (!b || !t.startsWith('\n令和4年度\n\n令和5年度\n', at + b.raw.length)) return;
    const p = sheetRecord(input, h.index!, name, h[0].trimEnd());
    p.activities = b.value;
    p.evidence.push(blockEvidence(input, b));
    out.push(p);
  });
  return out;
}

function layout(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, heads = [...t.matchAll(LAYOUT)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (input.truncated && k === heads.length - 1) return;
    const seg = t.slice(h.index!, heads[k + 1]?.index ?? t.length);
    const a = [...seg.matchAll(/\n施策の展開 実施計画の位置付け [^\n]*\n/g)], z = seg.indexOf('\n令和4年度 令和5年度 令和6年度 令和7年度 令和8年度\n');
    if (a.length !== 1 || z < 0 || a[0].index! > z) return;
    const from = a[0].index! + a[0][0].length, raw = seg.slice(from, z);
    const lines = raw.split('\n');
    if (lines.filter(l => l === '項').length !== 1 || lines.filter(l => /^事 業 概 要( |$)/.test(l)).length !== 1 || /事 業 概 要[^\n]*事 業 概 要/.test(raw)) return;
    const body = lines.filter(l => l !== '項' && l !== '事 業 概 要').map(l => l.replace(/^事 業 概 要 /, '').trim());
    if (!body.length || body.some(l => !l || /^(事|業|概|要|項|施 ?策|区分|決算|予算)$/.test(l) || /[☑□]|千円/.test(l))) return;
    let value = '';
    body.forEach((l, i) => { value += i === 0 ? l : (MARK.test(l) || /。$/.test(body[i - 1]) ? '\n' : '') + l; });
    if (value.length < 6) return;
    const p = sheetRecord(input, h.index!, h[2].trim(), h[0].trimEnd());
    p.projectCode = h[1];
    p.activities = value;
    p.evidence.push(evidence(input, raw, h.index! + from));
    out.push(p);
  });
  return out;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11243' || input.format !== 'pdf') return [];
  if (input.text.startsWith('事務事業評価シート')) return separated(input);
  if (input.text.startsWith('令和7年度 事務事業評価シート ')) return layout(input);
  return [];
}

export const entry = {
  extract,
  scope: '吉川市 令和7年度 事務事業評価シートの「事業概要」欄（欄の見出しが1回だけで、事業費表の見出しの直前で終わるもの）。様式に目的欄はない。',
};
