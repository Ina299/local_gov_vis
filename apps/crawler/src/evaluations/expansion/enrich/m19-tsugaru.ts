import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- つがる市（教育委員会事務の点検及び評価報告書 令和4・6・7年度分）
// 公開済みレコード（batch9/i5-c.ts）は同じ事業別シートの見出し（事業№・事業名・担当・当初予算・決算）から作られ、目的は未収録だった。
// 「事業目的」欄の本文は、欄見出し（事業計画実績・総合評価・方向性の縦書き1字ずつの塊）の後に始まり、
// 改行なしで「事業計画・実績」欄（①…の箇条や金額）が続く。境目が本文で確定する場合だけ目的とする:
//   本文が「事業目的」の直後（縦書き見出しの塊・空行のみを挟む）から始まり、最初の句点で終わる行までが目的で、
//   その次が空行か箇条の記号（①・(1)など）で始まる行であること。「事業目的 …」と同じ行に続く票（前半が別の場所にある）は採らない。
// 令和3年度分は見出しの並びが異なり、事業目的が事業名より前に来るため対象外。
const DOCS: Record<string, number> = { '0c1c322eedff34ba6f305af1': 7, '3f94ddcd3ed666e8f8709fff': 6, '6802f03cbdc4f8cbd82804b3': 4 };
const kanji = (n: number) => String(n).replace(/\d/g, d => String.fromCharCode(0xff10 + Number(d)));
const HEAD = /事 業 №\n\n(\d+)\n\n/g;
// 事業名と担当の欄（公開済みレコードの抽出と同じ2通りの並び）。
const NAME = /^(?:予\n\n)?(?:[^\n]*\n+){0,8}?事業名\n\n(?:([^\n]+)\n\n担当\n\n([^\n]+(?:\n[^\n]+)?)|担当\n\n([^\n]+)\n\n([^\n]+(?:\n[^\n]+)?))\n\n/;
const LABELS = /^事業目的\n\n((?:(?:事\n計\n実|業\n画\n績|総\n評|合\n価|方向性)\n\n)*)/;
const MARK = /^(①|②|③|④|⑤|[①-⑳]|\(\d+\)|（\d+）|\([１-９]\)|・|※)/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const reiwa = DOCS[input.sourceId];
  if (input.municipalityCode !== '02209' || !reiwa || !input.text.startsWith(`教育委員会事務の点検及び評価報告書\n\n－令和${kanji(reiwa)}年度分－`)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, body = start + h[0].length, end = heads[k + 1]?.index ?? t.length;
    const seg = t.slice(body, end), nm = NAME.exec(seg);
    if (!nm) return;
    const [name, dept] = nm[1] !== undefined ? [nm[1], nm[2]] : [nm[3], nm[4]];
    if (!/^(?:[^\n]+\n)?[^\n]+課$/.test(dept) || /課$/.test(name) || /^(?:事業名|担当|事業目的)$/.test(name)) return;
    const o = seg.indexOf('事業目的\n\n');
    if (o < 0 || seg.indexOf('事業目的', o + 1) >= 0) return;
    const lab = LABELS.exec(seg.slice(o))!;
    const at = o + lab[0].length, rest = seg.slice(at);
    const lines = rest.split('\n'), stop = lines.findIndex(l => /。$/.test(l));
    if (stop < 0 || stop > 4 || lines.slice(0, stop + 1).some(l => !l.trim() || MARK.test(l) || l.length < 2)) return;
    const next = lines[stop + 1] ?? '';
    if (next !== '' && !MARK.test(next)) return;
    const raw = lines.slice(0, stop + 1).join('\n');
    // 欄の幅（行の最大長）いっぱいの行の後の改行は折り返しとして除く。
    const width = Math.max(...lines.slice(0, stop + 1).map(l => l.length));
    const value = lines.slice(0, stop + 1).reduce((acc, l, i, a) => acc + (i === 0 ? '' : a[i - 1].length >= width - 2 && !/。$/.test(a[i - 1]) ? '' : '\n') + l, '');
    if (value.length < 10) return;
    const p = project(input, `事業№${h[1]}|narrative`, name, null, h[0] + nm[0], start);
    p.projectCode = `事業№${h[1]}`;
    p.department = dept.replace('\n', '');
    p.evaluatedFiscalYear = 2018 + reiwa;
    p.purpose = value;
    p.evidence.push(evidence(input, raw, body + at));
    p.warnings.push(`つがる市 教育委員会事務の点検及び評価報告書（令和${reiwa}年度分）の事業別シートの「事業目的」欄を目的に収録（折り返しの改行は除去）。`
      + '本文は事業計画・実績の欄と改行なしで続くため、最初の句点の行の次が空行か箇条の記号で始まり、境目が確定する票に限る。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: 'つがる市 教育委員会事務の点検及び評価報告書（令和4・6・7年度分）の事業別シート: 「事業目的」の文章（事業計画・実績欄との境目が確定するものだけ）。',
};
