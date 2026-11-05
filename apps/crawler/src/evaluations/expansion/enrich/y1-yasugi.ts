import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 安来市（第２期 まち・ひと・しごと創生総合戦略 令和７年度 事業評価シート）
// 公開済みレコードは同じ資料（R7hyoukakekka.pdf）の事業評価シートから作られ、年度の記載がないため評価年度は未設定。
// 抽出テキストは行ごとに左の「目的」「手段（Plan）」欄と右の課題・委員意見・改善策の欄が空白区切りで並ぶ。左の欄は
// 行の先頭の語になるため、行の先頭の語を順につなぐ。ただし右の欄と取り違えないよう、次の場合に限る。
//   - 最後の行以外は欄の幅いっぱい（WIDE 以上）で句点で終わらない（折り返し）。最後の行は句点で終わる。
//   - 最後の行が幅いっぱいなら、次の行が評価の行（「B B」「- -」等）・ラベルだけの行であること（文が続くおそれがあるため）。
// 欄の中に空白がある（語が欄の途中で切れる）と、上の条件を満たさず採らない。
const URL = /\/suishinkaigi\.data\/R7hyoukakekka\.pdf$/;
const WIDE = 38;
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);
/** 欄が終わったことが確かな行（評価の行・ラベルだけの行）。 */
const STOP = /^(?:[A-D-] [A-D-]|目的|手段（Plan）(?: R2)?|R2)$/;

/** lines[from] から、label のラベルを先頭から除いた行の先頭の語をつなぐ。 */
function column(lines: string[], from: number, label: string): { text: string; last: number } | null {
  const parts: string[] = [];
  for (let k = from; k < lines.length && k < from + 6; k++) {
    const line = lines[k].startsWith(`${label} `) ? lines[k].slice(label.length + 1) : lines[k];
    const word = line.split(' ')[0];
    if (!word || STOP.test(lines[k])) return null;
    parts.push(word);
    if (word.endsWith('。')) {
      if (width(word) >= WIDE && !STOP.test(lines[k + 1] ?? '')) return null;
      return { text: parts.join(''), last: k };
    }
    if (width(word) < WIDE) return null;
  }
  return null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '32206' || !URL.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(/^事業名 (.+?) 内部評価（Check） 外部評価（Check）$/gm)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const lines = seg.split('\n'), s = lines.findIndex(l => l.startsWith('施策 '));
    // 目的の欄は「施策」の行の次の行から。「目的」のラベルはその行か次の行の先頭にある。
    if (s < 0 || !lines.slice(s + 1, s + 3).some(l => l === '目的' || l.startsWith('目的 '))) continue;
    const c = column(lines, s + 1, '目的');
    if (!c || !lines.slice(s + 1, c.last + 2).some(l => l === '目的' || l.startsWith('目的 '))) continue;
    const offset = (k: number) => start + lines.slice(0, k).reduce((n, l) => n + l.length + 1, 0);
    const raw = lines.slice(s + 1, c.last + 1).join('\n');
    const p = project(input, `${h[1]}:narrative`, h[1], null, h[0], start);
    p.projectCode = null;
    p.purpose = c.text;
    p.evidence.push(evidence(input, raw, offset(s + 1)));
    p.warnings.push('第２期総合戦略 令和７年度 事業評価シートの「目的」欄。抽出テキストでは右の課題・委員意見の欄と同じ行に並ぶため、各行の先頭の語'
      + '（欄の幅いっぱいで折り返した行と、句点で終わる最後の行）をつないだ。根拠の原文には右の欄の文も含まれる。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '安来市 第２期総合戦略 令和７年度 事業評価シート: 目的（左の欄の行頭の語をつなぎ、折り返しと句点で欄の終わりが確かめられるものだけ）。年度の記載がない公開済みレコードと同じ資料。',
};
