import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 鯖江市（令和７年度 行政評価外部評価報告書の事務事業調書）
// 公開済みレコードのうち外部評価の対象4事業は、同じ報告書（R7hyoka.pdf）の事務事業調書（基準年度2025、実績はR6年度）。
// 調書の「目的」「概要」欄を取る。左端の縦書き「ＰＬＡＮ（計画）」の1字が欄の行の頭に付くことがあるため、折り返した行では
// その1字と空白を除いてつなぐ（根拠は原文の行そのもの）。平成24年度の一覧（html）は事業名・方向性だけで個票は未取得。
const HEAD = /^令和７年度 事務事業調書（評価対象事業） 基準年度： 2025 \d+\nR7年度 ([^\n]+)\n事業名\n/gm;
/** 縦書きの見出し「ＰＬＡＮ（計画）」の1字に続く折り返し行。 */
const MARGIN = /^[ＰＬＡＮ（計画）] (.+)$/;

/**
 * first（欄の1行目、見出しの後）から stop の行の手前までを欄の続きとしてつなぐ。縦書きの1字＋空白で始まる行はその1字を除く。
 * 句点で終わる行の後は段落の区切りとして改行を残し、それ以外は折り返しとして改行を除く。stop の行で終わること。
 */
function field(lines: string[], i: number, first: string, stop: RegExp): { value: string; count: number } | null {
  let value = first, j = i + 1;
  for (; j < lines.length && !stop.test(lines[j]); j++) {
    const l = MARGIN.exec(lines[j])?.[1] ?? lines[j];
    if (!l.trim() || j - i > 8) return null;
    value += (value.endsWith('。') ? '\n' : '') + l;
  }
  return j < lines.length ? { value, count: j - i } : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '18207' || input.format !== 'pdf' || !input.sourceUrl.endsWith('/R7hyoka.pdf')) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const h of t.matchAll(HEAD)) {
    const start = h.index!, seg = t.slice(start, start + 3000);
    const dept = /\nＰ 部署名 (\S+) 開始年度 /.exec(seg);
    const lines = seg.split('\n'), pi = lines.findIndex(l => l.startsWith('Ｌ 目的 ')), ai = lines.findIndex(l => / 概要 /.test(l));
    if (!dept || pi < 0 || ai < pi) continue;
    // 目的は縦書きの1字だけの行で、概要は「法令等」の行で終わる。
    const purpose = field(lines, pi, lines[pi].slice('Ｌ 目的 '.length), /^[ＰＬＡＮ（計画）]$/);
    const ap = /^[ＰＬＡＮ（計画）] 概要 (.+)$/.exec(lines[ai]);
    const activities = ap && field(lines, ai, ap[1], /^法令等 /);
    if (!purpose) continue;
    const at = (k: number) => start + lines.slice(0, k).join('\n').length + (k ? 1 : 0);
    const p = project(input, `narrative:${h[1]}`, h[1].trim(), 2025, h[0].trimEnd(), start);
    p.projectCode = null; p.evaluatedFiscalYear = 2024; p.department = dept[1];
    p.purpose = purpose.value;
    p.evidence.push(evidence(input, lines.slice(pi, pi + purpose.count).join('\n'), at(pi)));
    if (activities) {
      p.activities = activities.value;
      p.evidence.push(evidence(input, lines.slice(ai, ai + activities.count).join('\n'), at(ai)));
    }
    p.warnings.push('鯖江市 令和７年度事務事業調書（外部評価報告書）の「目的」「概要」欄を目的・事業内容として収録。'
      + '折り返した行の頭にある縦書き見出し（ＰＬＡＮ（計画））の1字を除いてつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '鯖江市 令和７年度 行政評価外部評価報告書の事務事業調書（4事業）: 「目的」「概要」欄。平成24年度の評価結果一覧は個票未取得のため対象外。',
};
