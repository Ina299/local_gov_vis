/** 市原市 (12219): 主要な施策の成果・事業シート集（部局別）の事業シート（概要説明書）の「目的」「事業内容」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコード（batch11/k0-ichihara.ts）と同じ票の区切り・事業名（索引の同じ実行計画番号の行）・担当部・評価対象年度で照合する。
// 1ページ目の上段は「根拠法令等」「実施の背景」「目 的（何をどうしたいのか）」の欄だが、抽出テキストでは欄の文字と本文の並びが票ごとに異なり、
// 背景と目的の本文が1つの段落に続けて出る票も多い。目的の本文が単独の段落として確定できる次の2つの並びに限る。
//  A: 空行の後の段落の直後（空行なし）に「目 的」「（何をどうしたいのか）」の2行が続く。
//  N: 「目 的」の行と空行の後に1〜2段落があり、その最後の段落の直後（空行の後）に「（何をどうしたいのか）」が続く（2段落のときの前段は背景）。
// どちらも、目的の後から「実施主体」までに別の文章の段落がない（＝目的の候補が1つしかない）票だけを採る。
const SHEET = '施策番号 実行計画番号 ｱｸｼｮﾝﾌﾟﾗﾝID 指標動向\n';
const LABEL = /実施の背景|根拠法令|目 的|何をどうしたいのか|対 象|対象者数|課・係|作成|担当者|事務区分|SDGs|法定受託|自治事務|実施方法|指定管理|業務委託|直接実施|^○$|^～$|^事業$|^期間$/m;
// 事業内容欄の中に縦書きの「事業概要」の文字や他の欄の文字が混ざる票は採らない。
const CONTENT_FOREIGN = /^(?:事|業|概|要)(?: |$)|^(?:関連事業|実施主体|補助先|貸付先|その他の内容)|（同一目的事業等）/m;
const prose = (block: string) => block.split('\n').some(l => l.length >= 30);

function purposeOf(body: string): { text: string; at: number } | null {
  const a = /\n\n((?:[^\n]+\n)*?[^\n]+)\n目 的\n（何をどうしたいのか）\n/.exec(body);
  let text: string, at: number, after: number;
  if (a) {
    text = a[1]; at = a.index + 2; after = a.index + a[0].length;
    if (body.indexOf('\n目 的', after) >= 0 || body.indexOf('何をどうしたいのか', after) >= 0) return null;
  } else {
    const l = body.indexOf('\n目 的\n\n'), q = body.indexOf('\n\n（何をどうしたいのか）\n');
    if (l < 0 || q < l || body.indexOf('\n目 的\n\n', l + 1) >= 0 || body.indexOf('何をどうしたいのか', q + 4) >= 0) return null;
    const from = l + '\n目 的\n\n'.length, blocks = body.slice(from, q).split('\n\n');
    if (blocks.length > 2 || !blocks.every(b => b && !LABEL.test(b) && prose(b) && /[。す]$/.test(b))) return null;
    text = blocks.at(-1)!; at = q - text.length; after = q + '\n\n（何をどうしたいのか）\n'.length;
  }
  // 目的の欄は3行まで。それより長い段落は背景の本文が続けて出たもの（欄からあふれた票も区別できないため採らない）。
  if (!text.trim() || LABEL.test(text) || !/[。）す]$/.test(text) || text.split('\n').length > 3) return null;
  // 目的の後から実施主体の欄まで（対象・実施方法の欄）に、別の文章の段落があれば目的の位置が確定しない。
  const end = body.indexOf('\n実施主体\n', after);
  if (end < 0) return null;
  if (body.slice(after, end).split('\n\n').some(b => !LABEL.test(b) && b.split('\n').filter(x => x.length >= 38).length >= 2)) return null;
  return { text, at };
}

function sheetsOf(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '12219') return [];
  const t = input.text, first = t.indexOf(SHEET);
  if (first < 0 || !t.includes('主要な施策の成果・事業シート集')) return [];
  const index = t.slice(0, first);
  const starts: number[] = [];
  for (let i = first; i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    if (input.truncated && k === starts.length - 1) return;
    const base = s + SHEET.length, body = t.slice(base, starts[k + 1] ?? t.length);
    const h = /^([^\n]*)\n(\d{7})\n+(?:\d{5}\n+)?事業シート（概要説明書）\n/.exec(body);
    if (!h) return;
    const code = h[2];
    const row = new RegExp(`${code}(?: |\\n+)([^\\n]+)\\n`).exec(index);
    if (!row) return;
    const name = row[1].trim(), page1 = body.slice(0, 1500), nameAt = page1.indexOf(`\n${name}\n`);
    if (nameAt < 0) return;
    const dep = /\n担当部 (\S+)\n/.exec(page1);
    // 評価対象年度は「令和N年度 事業内容」欄の見出し（公開済みレコードと同じ取り方。見出しのない票は採らない）。
    const fy = /\n令和(\d)年度 事業内容（手段、手法、金額を含めた予算の執行内容など）\n/.exec(page1);
    if (!dep || !fy) return;
    const purpose = purposeOf(body);
    // 事業内容: 見出しの次の行から「関連事業（同一目的事業等）」の欄の手前まで。
    const c0 = fy.index + fy[0].length, c1 = body.indexOf('\n\n関連事業\n（同一目的事業等）', c0);
    const content = c1 > c0 ? body.slice(c0, c1) : null;
    const activities = content && content.trim() && !CONTENT_FOREIGN.test(content) && !content.includes('\n\n') ? content : null;
    if (!purpose && !activities) return;
    const p = project(input, `補強:${code}`, name, null, h[0].slice(0, -1), base);
    p.projectCode = code;
    p.department = dep[1];
    p.evaluatedFiscalYear = 2018 + Number(fy[1]);
    p.evidence.push(evidence(input, name, base + nameAt + 1), evidence(input, row[0].slice(0, -1), row.index), evidence(input, dep[0].slice(1, -1), base + dep.index + 1));
    if (purpose) {
      p.purpose = purpose.text;
      p.evidence.push(evidence(input, `${purpose.text}`, base + purpose.at));
    }
    if (activities) {
      p.activities = activities;
      p.evidence.push(evidence(input, fy[0].slice(1) + activities, base + fy.index + 1));
    }
    p.warnings.push('事業シート（概要説明書）の「目的（何をどうしたいのか）」「事業内容」欄の原文（改行も原文のまま）。目的は欄の本文が単独の段落として確定できる票のみ（背景と同じ段落に続く票は対象外）。'
      + '事業内容は縦書きの欄名などが混ざらない票のみ。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract: sheetsOf,
  scope: '市原市 主要な施策の成果・事業シート集（部局別）の事業シート（概要説明書）から、目的・事業内容の欄（評価対象年度は「令和N年度 事業内容」の見出し）。背景と目的が同じ段落になる票、他の欄の文字が混ざる事業内容は対象外。',
};
