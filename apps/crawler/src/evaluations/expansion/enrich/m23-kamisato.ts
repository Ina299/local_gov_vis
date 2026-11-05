import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { entries as g3 } from '../batch7/g3-mixed';
import { joinWrapped, refill } from './m23-util';

// ---------------------------------------------------------------- 上里町（様式第１号 事務事業評価表・1事業1ファイル）
// 公開済みレコードは batch7/g3-mixed の抽出（事業名・主管課・評価年度・総合評価）で、目的・手段は未収録。
// 「16.事業の目的」〜「19.事 業 費」の範囲は、抽出テキストで次のどちらかの並びになる。
//  (1) 欄の見出し（16〜18 とその説明書き）が先にまとまって出て、本文が後に続く票: 見出しの行を除くと、本文は目的・対象・手段の段落
//      （空行・表の「区」の行で区切る）になる。段落がちょうど3つで「分」の行より前にある票だけ、1つ目を目的、3つ目を手段とする。
//      手段は1行か句点で終わる段落のみ（途中で切れたものは採らない）。
//  (2) 見出しと本文が交互に出る票: 「E.事務事業\nの概要」と「17.事業の対象」の間の1段落を目的とする。手段は見出しの説明書きと行が混ざるため採らない。
// 「D.総合振興計画」の見出しが本文に割り込む票・本文が見出しの前から始まる票・欄が1段落につながる票は採らない。対象は収録先の欄がないため使わない。
const LABELS = new Set(['16.事業の目的', '（何を目的として事業を行うの', 'か。）', 'E.事務事業', 'の概要', '17.事業の対象', '(当該事務事業の目',
  '的･対象・手段を記入 （誰を何を対象としているのか）', 'する。）', '18.事業の手段', '（どんなやり方で事業を行ったの', 'か）']);

interface Para { text: string; start: number; end: number }
function bySequence(t: string, a: number, b: number) {
  const paras: Para[] = [];
  let zone: 'before' | 'between' | 'after' = 'before', cur: Para | null = null, pos = a + 1;
  for (const line of t.slice(a + 1, b).split('\n')) {
    const s = line.trim(), at = pos;
    pos += line.length + 1;
    if (LABELS.has(s)) { if (cur) return null; continue; }
    if (!s || s === '区' || s === '分') {
      cur = null;
      if (s === '区') { if (zone !== 'before') return null; zone = 'between'; }
      if (s === '分') { if (zone !== 'between') return null; zone = 'after'; }
      continue;
    }
    if (zone === 'after' || /^(D\.総合振興|計画|F\.費用)/.test(s)) return null;
    if (cur) { cur.text += '\n' + line; cur.end = at + line.length; } else paras.push(cur = { text: line, start: at, end: at + line.length });
  }
  // 先頭の段落は見出しの直後（空行の後）に始まること。
  if (zone !== 'after' || paras.length !== 3 || !/\n\n$/.test(t.slice(a, paras[0].start))) return null;
  const means = paras[2].text;
  const activities = !means.includes('\n') || /。$/.test(means.trim()) ? joinWrapped(means) : null;
  return { purpose: joinWrapped(paras[0].text), activities, raw: t.slice(paras[0].start, activities ? paras[2].end : paras[0].end), at: paras[0].start };
}

function byLabels(t: string, a: number, b: number) {
  const own = /\nE\.事務事業\nの概要\n\n([^\n][^]*?)\n\n17\.事業の対象\n/.exec(t.slice(a, b));
  if (!own) return null;
  // 見出し「16.事業の目的」から「E.事務事業」までは見出しの行だけであること（本文が見出しの前から始まる票を除く）。
  const head = t.slice(a + 1, a + own.index).split('\n').map(s => s.trim()).filter(Boolean);
  if (!head.every(s => LABELS.has(s)) || own[1].includes('\n\n') || !/。$/.test(own[1].trim())) return null;
  return { purpose: joinWrapped(own[1]), activities: null, raw: own[1], at: a + own.index + own[0].indexOf(own[1]) };
}

function fill(_: ProjectEvaluation, input: CachedInput) {
  const t = input.text, a = t.indexOf('\n16.事業の目的\n'), b = t.indexOf('\n19.事', a);
  if (a < 0 || b < 0 || t.indexOf('16.事業の目的', a + 2) >= 0) return null;
  return bySequence(t, a, b) ?? byLabels(t, a, b);
}

export const entry = {
  extract: (input: CachedInput, inputs: CachedInput[]) => input.municipalityCode !== '11385' ? [] : refill(input, inputs, g3['11385'].extract,
    '上里町 事務事業評価表（様式第１号）の「16.事業の目的」「18.事業の手段」欄。本文の段落と欄の対応が見出しの並びから一意に決まる票のみ収録'
    + '（見出しが先にまとまって出る票は本文が目的・対象・手段の3段落に分かれるもの、見出しと本文が交互に出る票は目的のみ）。折り返しの改行は除いた。', fill),
  scope: '上里町 事務事業評価表（様式第１号）: 「16.事業の目的」と「18.事業の手段」（段落と欄の対応が一意な票のみ）。',
};
