import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 市原市（主要な施策の成果・事業シート集（部局別）の事業シート（概要説明書））
// m0-ichihara.ts は評価対象年度を「令和N年度 事業内容（…）」の見出しから取り、見出しが1行にまとまらない票を採らない。
// 公開済みレコードのうちそうした票から年度なしで作られたもの（同じ部局別PDF）に、同じ判定（下の purposeOf は m0-ichihara.ts と同じ）で
// 「目 的（何をどうしたいのか）」欄の文を足す。年度は付けず、同じ資料から作られた年度なしのレコードとだけ照合させる。
// 事業内容の欄は見出しの位置が票ごとに異なり、欄の範囲が確定しないため採らない。
const SHEET = '施策番号 実行計画番号 ｱｸｼｮﾝﾌﾟﾗﾝID 指標動向\n';
const LABEL = /実施の背景|根拠法令|目 的|何をどうしたいのか|対 象|対象者数|課・係|作成|担当者|事務区分|SDGs|法定受託|自治事務|実施方法|指定管理|業務委託|直接実施|^○$|^～$|^事業$|^期間$/m;
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
    // 「令和N年度 事業内容」の見出しが1行にある票は m0-ichihara.ts が年度つきで扱う。
    if (!dep || /\n令和(\d)年度 事業内容（手段、手法、金額を含めた予算の執行内容など）\n/.test(page1)) return;
    const purpose = purposeOf(body);
    if (!purpose) return;
    const p = project(input, `補強:${code}:年度なし`, name, null, h[0].slice(0, -1), base);
    p.projectCode = code;
    p.department = dep[1];
    p.evidence.push(evidence(input, name, base + nameAt + 1), evidence(input, row[0].slice(0, -1), row.index), evidence(input, dep[0].slice(1, -1), base + dep.index + 1));
    p.purpose = purpose.text;
    p.evidence.push(evidence(input, purpose.text, base + purpose.at));
    p.warnings.push('事業シート（概要説明書）の「目的（何をどうしたいのか）」欄の原文（改行も原文のまま）。欄の本文が単独の段落として確定できる票のみ（背景と同じ段落に続く票は対象外）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract: sheetsOf,
  scope: '市原市 主要な施策の成果・事業シート集（部局別）の事業シートのうち「令和N年度 事業内容」の見出しが1行にない票（年度なしの公開済みレコード）: 目的の欄。背景と目的が同じ段落になる票、事業内容の欄は対象外。',
};
