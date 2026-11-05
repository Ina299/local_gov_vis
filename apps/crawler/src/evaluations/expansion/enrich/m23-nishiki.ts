import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as sousei } from '../batch12/m5-sousei';
import { joinWrapped, refill, startOf } from './m23-util';

// ---------------------------------------------------------------- 錦町（令和6年度デジタル田園都市国家構想交付金事業の効果検証・資料２）
// 公開済みレコードは batch12/m5-sousei の抽出（事業名・評価対象年度）。各シートの「事業目的・概要」「内容」欄は、
// 抽出テキストで欄の見出しが本文の縦の中央に1行で割り込む（本文の前半＋空行＋見出し＋空行＋本文の後半）。
// 目的: 「事業開始年度」欄の年度の行の次から見出し「事業目的・概要」の前までを前半、見出しの後を後半とし、後半の行数が前半の行数±1で、
//       その行で文が終わる（句点で終わる、または後半が空行・見出しまで続く）位置がちょうど1つに決まる票だけ採る。
// 内容: 目的の後から「事業費（円）」の前までで、見出し「内容」が1回だけ現れ、前後の行数の差が1以下で、金額の行を含まない票だけ採る。
// 値は見出しの行と空行を除いて折り返しをつないだもの。根拠は見出しを含む原文の範囲。
type Line = { text: string; start: number; end: number };
function linesOf(t: string, from: number, to: number): Line[] {
  const out: Line[] = [];
  let pos = from;
  for (const raw of t.slice(from, to).split('\n')) { out.push({ text: raw, start: pos, end: pos + raw.length }); pos += raw.length + 1; }
  return out;
}

function fill(p: ProjectEvaluation, input: CachedInput) {
  const t = input.text, s = startOf(p);
  if (s === null) return null;
  const nextSheet = t.indexOf('交付対象事業の名称', s), end = nextSheet < 0 ? t.length : nextSheet;
  // 「事業費（円）」の欄がない票は次のシートの手前まで（内容は金額の行を含むので採られない）。
  const label = t.indexOf('\n\n事業目的・概要\n\n', s), c = t.indexOf('\n\n事業費（円）', s), cost = c < 0 || c > end ? end : c;
  if (label < 0 || label > end || cost < label) return null;
  // 前半: 年度の行（「令和/平成…年度（」で始まる）の次から見出しの前まで（空行なし）。
  const before = linesOf(t, t.lastIndexOf('\n\n', label - 1) + 2, label);
  const yearAt = before.findIndex(l => /^(令和|平成)[^\n]*年度（/.test(l.text));
  const pre = before.slice(yearAt + 1);
  if (yearAt < 0 || !pre.length || pre.some(l => !l.text.trim())) return null;
  const postFrom = label + '\n\n事業目的・概要\n\n'.length;
  const blank = t.indexOf('\n\n', postFrom), chunk = linesOf(t, postFrom, blank < 0 || blank > cost ? cost : blank);
  const ks = [pre.length - 1, pre.length, pre.length + 1].filter(k => k >= 1 && k <= chunk.length && (/。$/.test(chunk[k - 1].text.trim()) || k === chunk.length));
  if (ks.length !== 1) return null;
  const post = chunk.slice(0, ks[0]);
  const purpose = joinWrapped([...pre, ...post].map(l => l.text).join('\n'));
  const raw = { start: pre[0].start, end: post[post.length - 1].end };

  // 内容
  let activities: string | null = null;
  const rest = linesOf(t, post[post.length - 1].end + 1, cost);
  const at = rest.map((l, i) => (l.text === '内容' ? i : -1)).filter(i => i >= 0);
  if (at.length === 1) {
    const body = rest.filter(l => l.text.trim() && l.text !== '内容');
    const above = rest.slice(0, at[0]).filter(l => l.text.trim()).length, below = body.length - above;
    if (body.length && Math.abs(above - below) <= 1 && !body.some(l => /[0-9０-９,]+(千円|円)$/.test(l.text.trim()))) {
      activities = joinWrapped(body.map(l => l.text).join('\n'));
      raw.end = body[body.length - 1].end;
    }
  }
  return { purpose, activities, raw: t.slice(raw.start, raw.end), at: raw.start };
}

export const entry = {
  extract: (input: CachedInput, inputs: CachedInput[]) => input.municipalityCode !== '43501' ? [] : refill(input, inputs, sousei['43501'].extract,
    '錦町 令和6年度デジタル田園都市国家構想交付金事業の効果検証（資料２）の「事業目的・概要」「内容」欄。見出しが本文の中央に割り込むため、'
    + '見出しの前後の行数が釣り合い、欄の終わりが一意に決まる票のみ収録。値は見出しの行を除いて折り返しをつないだもの（根拠は見出しを含む原文）。', fill),
  scope: '錦町 令和6年度デジタル田園都市国家構想交付金事業の効果検証（資料２）: 「事業目的・概要」と「内容」（欄の範囲が一意に決まる票のみ）。',
};
