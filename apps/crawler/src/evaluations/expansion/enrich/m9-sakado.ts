import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 坂戸市「令和 6 年度事務事業評価シート【様式1】」
// 公開済みレコード（令和7年度事務事業評価 PDF の評価シートから作成。目的・事業概要なし）の補強用。
// 抽出テキストは様式の行ごとに並ぶため、欄の見出し行の間をそのまま採る。
//  目的   ← 「目標（対象をどのような状態にするために当該事業を行っているか、…）」の次の行から「事 事業概要（…）」の行まで
//  事業内容 ← 「事 事業概要（…）」の次の行から、縦書きの見出しの「事」だけの行・年度の表の見出し行まで
//  成果   ← 「指標③」の行の次から、見出しだけの「要 指標に対する達成度」の行まで（指標に対する達成度の文）
// 縦書きの見出し「事務事業の概要」の1字と空白が行頭に挟まることがあり、その1字と空白だけを除く（事業内容の欄のみ。
// 目的・成果の欄に挟まる場合は採らない）。折り返しの改行は除き、句点で終わる行の後の改行は残す。
// シートの区切りは「事 務 事 業 名」の行（表題行は「【様式1】」の有無・前置きの数字が揺れるため）。
const HEAD = /^事 務 事 業 名 .+? 整理№ \d+$/gm;
const GOAL = '\n目標（対象をどのような状態にするために当該事業を行っているか、具体的な目標（数値）など。）\n';
const SUMMARY = '事 事業概要（取組内容・活動内容など、目的を達成するために何をしているか。）\n';
const PREFIX = /^[事務業の概要総] /;

interface Field { value: string; raw: string; at: number }

function join(lines: string[]): string {
  return lines.reduce((acc, l, i) => acc + (i === 0 ? '' : lines[i - 1].endsWith('。') ? '\n' : '') + l, '');
}

function field(seg: string, at: number, re: RegExp, strip: boolean): Field | null {
  const ms = [...seg.matchAll(re)];
  if (ms.length !== 1) return null;
  const raw = ms[0][1].slice(0, -1);
  let lines = raw.split('\n');
  if (lines.some(l => !l.trim())) return null;
  if (lines.some(l => PREFIX.test(l) || /^[事務業の概要総]$/.test(l.trim()))) {
    if (!strip) return null;
    // 見出しの1字だけの行（「務 」など）は除く。
    lines = lines.map(l => l.replace(PREFIX, '').replace(/^[事務業の概要総]$/, '')).filter(l => l.trim());
  }
  return { value: join(lines.map(l => l.trim())), raw, at: at + ms[0].index! + ms[0][0].indexOf(ms[0][1]) };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sheet(input: CachedInput, at: number, seg: string): ProjectEvaluation | null {
  const name = /^事 務 事 業 名 (.+?) 整理№ \d+\n/.exec(seg);
  // 表題（令和 6 年度）は区切りの直前の行にある。
  if (!name || !/令和 6 年度事務事業評価シート(?: 【様式1】)?\n$/.test(input.text.slice(Math.max(0, at - 40), at))) return null;
  const purpose = field(seg, at, new RegExp(`${esc(GOAL)}((?:[^\\n]+\\n)+?)${esc(SUMMARY)}`, 'g'), false);
  const activities = field(seg, at, new RegExp(`\\n${esc(SUMMARY)}((?:[^\\n]+\\n)+?)事\\n令和5年度 令和6年度 令和7年度\\n`, 'g'), true);
  const outcomes = field(seg, at, /\n概 指標③\n((?:[^\n]+\n)+?)要 指標に対する達成度\n/g, false);
  if (!purpose && !activities && !outcomes) return null;
  const p = project(input, `${name[1]}:narrative`, name[1], null, name[0].trimEnd(), at);
  p.evaluatedFiscalYear = 2024;
  if (purpose) { p.purpose = purpose.value; p.evidence.push(evidence(input, purpose.raw, purpose.at)); }
  if (activities) { p.activities = activities.value; p.evidence.push(evidence(input, activities.raw, activities.at)); }
  if (outcomes) { p.outcomes = outcomes.value; p.evidence.push(evidence(input, outcomes.raw, outcomes.at)); }
  p.warnings.push('坂戸市 令和6年度事務事業評価シート【様式1】の「目標（対象をどのような状態にするために…）」を目的、「事業概要」を事業内容、「指標に対する達成度」を成果として収録。'
    + '折り返しの改行と、事業概要の行頭に挟まる縦書きの見出しの1字だけを除いた。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11239' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/uploaded/attachment/34846.pdf')) return [];
  const t = input.text, starts = [...t.matchAll(HEAD)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const p = sheet(input, s, t.slice(s, starts[i + 1] ?? t.length));
    if (p) out.push(p);
  });
  return out.filter(p => out.filter(o => o.projectName === p.projectName).length === 1);
}

export const entry = { extract, scope: '坂戸市 令和6年度事務事業評価シート【様式1】の目標（目的）・事業概要・指標に対する達成度。取得済みテキストは途中までのため、その範囲の事業のみ。' };
