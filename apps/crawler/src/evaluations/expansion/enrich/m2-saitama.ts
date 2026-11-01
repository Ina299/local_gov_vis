/** さいたま市 (11100): 総合振興計画 基本計画の実施状況報告書（令和4〜7年度実績）の「事業評価シート」の事業目的・事業内容。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, project } from '../shared';

// 公開済みレコードは同じ報告書の「事業の達成状況一覧」の事業行（事業名・局・とりまとめ課・達成度、評価対象年度のみ）。
// 報告書の後半に1事業1枚の事業評価シートがあり、「事業目的」「事業内容」の欄が見出しの直後に印字される。
// 事業名・事業コード（施策コード NN-N-N）の位置は版と段組みで3通り:
//   令和4〜6年度: シート冒頭の「事業コード・事業名」「施策情報」の見出しの直後。事業内容の欄は「Ⓓo（結果）」の見出しで終わる。
//   令和7年度: 事業内容の欄が計画（Ⓟlan）の囲みの括弧・縦書きの「計」「画」の行で終わり、その後の「事業コード」の行
//   （NN-N-N の後に「事業コード・事業名」か「投入資源」の見出し）の直前の1行（間には再掲先の施策コード・課名・Ⓟlan の文字だけ）、
//   または事業目的の見出しより前の「Ⓟlan」の縦書きの直後の行（NN-N-N が続く）。どちらか一方だけで見つかるシートに限る。
// 取組実績（Ⓓo）の欄は見出しの文字と本文が同じ行に混ざるため成果には採らない。
const FY: Record<string, number> = {
  'eb4eeba04595e03f8a6e7116': 2022, // R4_houkokusyo.pdf
  '27d39c3073b7ea5867896be9': 2023, // R5_houkokusyo.pdf
  '5e4c2d909efceb5468981bc6': 2024, // R6_houkokusyo.pdf
  '2d4689fe6a4ad07a0b6fd316': 2025, // R7_houkokusyo.pdf
};
const SHEET = '\n事業評価シート\n';
const PURPOSE = '\n事業目的\n\n', CONTENT = '\n\n事業内容\n\n', VERTICAL = '\n\n計\n画';
const OLD_HEAD = /^事業評価シート\n事業基本情報\n事業コード・事業名\n\n施策情報\n\n([^\n]+)\n\n(\d\d-\d-\d)\n\n－ \d\d\n/;
const NAME_AFTER = /^([^\n]+)\n\n(\d\d-\d-\d)\n\n(?:事業コード・事業名|投入資源)\n/m;
const NAME_BEFORE = /\nⓅ\nl\na\nn\n\n([^\n]+)\n\n(\d\d-\d-\d)\n\n/g;
// 欄の本文に別の欄の見出し・囲みの文字が混ざっていないこと。
const FOREIGN = /^(?:事業目的|事業内容|）|（|計|画|Ⓟ|Ⓓ|l|a|n|o|Ⓓo（結果）|事業コード・事業名|投入資源|結果)$/m;
// 事業内容の欄の後から事業名までに挟まってよい行（計画の囲みの文字・再掲先の施策コード・事業課の欄）。
const FRAME = /^(?:（|）|計|画|Ⓟ|l|a|n|―|\d\d-\d-\d|事業課|[^\n、。]{1,20}(?:課|室|所|局|部|センター))$/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const fy = FY[input.sourceId];
  if (input.municipalityCode !== '11100' || !fy || input.truncated || !input.text.startsWith('さいたま市総合振興計画\n基本計画の実施状況報告書')) return [];
  const t = input.text, starts: number[] = [];
  for (let i = t.indexOf(SHEET); i >= 0; i = t.indexOf(SHEET, i + 1)) starts.push(i + 1);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length);
    const a = seg.indexOf(PURPOSE), b = seg.indexOf(CONTENT, a);
    if (a < 0 || b < 0 || seg.indexOf(PURPOSE, a + 1) >= 0 || seg.indexOf(CONTENT, b + 1) >= 0) return;
    // 事業目的: 見出しから事業内容の見出しまで（縦書きの「計」「画」が間に入る版はその2行の手前まで）。
    let purpose = seg.slice(a + PURPOSE.length, b);
    if (purpose.endsWith(VERTICAL)) purpose = purpose.slice(0, -VERTICAL.length);
    // 事業内容: 見出しの後の空行までの1段落。
    const c0 = b + CONTENT.length, c = seg.indexOf('\n\n', c0);
    if (c < 0) return;
    const content = seg.slice(c0, c), rest = seg.slice(c + 2);
    if (!purpose.trim() || !content.trim() || /\n\n/.test(purpose) || FOREIGN.test(purpose) || FOREIGN.test(content)) return;
    // 事業名の候補（start, end はシート内の位置）。ちょうど1つのときだけ採る。
    const names: { name: string; code: string; start: number; end: number }[] = [];
    const old = OLD_HEAD.exec(seg);
    if (old) {
      if (!rest.startsWith('Ⓓo（結果）\n')) return;
      names.push({ name: old[1], code: old[2], start: 0, end: old[0].length - 1 });
    } else {
      if (!/^(?:（|）|計)\n/.test(rest)) return;
      const n = NAME_AFTER.exec(rest);
      if (n && rest.slice(0, n.index).split('\n').filter(Boolean).every(l => FRAME.test(l)))
        names.push({ name: n[1], code: n[2], start: c + 2 + n.index, end: c + 2 + n.index + n[0].length - 1 });
      for (const m of seg.slice(0, a).matchAll(NAME_BEFORE)) names.push({ name: m[1], code: m[2], start: m.index + 1, end: m.index + m[0].length - 2 });
    }
    if (names.length !== 1) return; // 前後の両方にある・どちらにもないシートは対象外
    const { name, code, start, end } = names[0];
    if (FRAME.test(name.trim()) || /^(?:\d|事業|戦略)/.test(name.trim())) return;
    const from = s + Math.min(start, a + 1), to = s + Math.max(end, c);
    const p = project(input, `${code}:${name.trim()}`, name.trim(), null, t.slice(from, to), from);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.purpose = purpose; p.activities = content;
    p.warnings.push('事業評価シートの「事業目的」「事業内容」欄の原文（改行も原文のまま）。事業名はシートの事業コード欄の行。取組実績の欄は見出しと本文が混ざるため未収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: 'さいたま市 基本計画の実施状況報告書（令和4〜7年度実績）の事業評価シートから、事業目的・事業内容の欄（評価対象年度は報告書の年度）。取組実績の欄は見出しと本文が混ざるため対象外。',
};
