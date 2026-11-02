/**
 * 31202 米子市: 令和７年度 事務事業評価票（継続分、部局別PDF）。公開済みレコード（同じ評価票）の空欄の
 * 目的（「目的（実施理由）」欄）と事業内容（「R6実施内容」欄）を補う。
 * 抽出テキストでは欄の見出しが欄の文の行頭や行間に挟まって出る（見出しは欄の縦の中央）。次の場合だけ採る:
 * - 事業の概要が見出しと同じ1行（「事業の概要 …」）か、見出しを挟んだ2行で、その直後の行から「目的」の見出しが始まる
 *   （目的の欄の先頭に見出しがあるので、欄の文は「（実施理由）」の見出しの行で終わる）。
 * - 事業内容は目的の欄の後から「効果測定方法」の行までで、見出し「R6実施内容」がちょうど1回あり、
 *   隣の欄の切れた文（「定量指標・…」）が混ざらないもの。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';

const HEAD = /令和７年度 事務事業評価票（継続分）\n/g;
/** 箇条の始まり（この記号で始まる行は前の行の続きとみなさない）。 */
const BULLET = /^[・①-⑳〇○●◆■※【]/;

/** 行から見出しの断片を除いてつなぐ。欄の幅いっぱいの行（見出しを含む元の行の長さで判定）の後の改行は折り返しとして除く。 */
function joinLines(rows: { text: string; raw: string }[]): string {
  const width = Math.max(...rows.map(r => r.raw.length));
  return rows.reduce((acc, r, i) => acc + (i === 0 ? '' : rows[i - 1].raw.length >= width - 3 && !/。$/.test(rows[i - 1].text) && !BULLET.test(r.text) ? '' : '\n') + r.text, '');
}
const strip = (line: string, label: string) => line === label ? '' : line.startsWith(`${label} `) ? line.slice(label.length + 1).trim() : null;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '31202' || !input.text.startsWith('令和７年度 事務事業評価票（継続分）\n')) return [];
  const text = input.text, out: ProjectEvaluation[] = [];
  const heads = [...text.matchAll(HEAD)];
  heads.forEach((h, i) => {
    const s = h.index!, t = text.slice(s, heads[i + 1]?.index ?? text.length);
    const id = /^整理番号 (\d+) 事務事業名 (.+?) 担当課名 (\S+)$/m.exec(t);
    const kind = /\n事業の種別 [^\n]*\n/.exec(t), end = t.indexOf('\n効果測定方法');
    if (!id || !kind || end < 0) return;
    const bodyAt = kind.index! + kind[0].length, lines = t.slice(bodyAt, end).split('\n');
    // 事業の概要の欄（1行または見出しを挟んだ2行）の後ろの位置。
    let k: number;
    if (lines[0].startsWith('事業の概要 ')) k = 1;
    else if (lines[1] === '事業の概要' && lines[2]) k = 3;
    else return;
    if (strip(lines[k], '目的') === null) return;
    const reason = lines.findIndex((l, j) => j > k && strip(l, '（実施理由）') !== null);
    if (reason < 0) return;
    const pRows: { text: string; raw: string }[] = [];
    for (let j = k; j <= reason; j++) {
      const v = j === k ? strip(lines[j], '目的')! : j === reason ? strip(lines[j], '（実施理由）')! : lines[j].trim();
      if (j !== k && j !== reason && /^(目的|（実施理由）|R6実施内容)( |$)/.test(lines[j])) return;
      if (v) pRows.push({ text: v, raw: lines[j] });
    }
    if (!pRows.length) return;
    // 事業内容: 目的の欄の後ろ〜効果測定方法の前。
    const rest = lines.slice(reason + 1), labels = rest.filter(l => strip(l, 'R6実施内容') !== null);
    let activities: string | null = null, aRaw = '';
    if (labels.length === 1 && rest.length && !rest.some(l => /^定量指標|^事業概要$|^目的( |$)|^（実施理由）/.test(l) || !l.trim())) {
      const rows = rest.map(l => ({ text: strip(l, 'R6実施内容') ?? l.trim(), raw: l })).filter(r => r.text);
      if (rows.length) { activities = joinLines(rows); aRaw = rest.join('\n'); }
    }
    const lineAt = (j: number) => bodyAt + lines.slice(0, j).reduce((n, l) => n + l.length + 1, 0);
    const p = project(input, `narrative-${id[1]}`, id[2], 2025, id[0], s + id.index!);
    p.id = stableId(input, `narrative-${id[1]}`, 2025);
    p.projectCode = null;
    p.department = id[3];
    p.purpose = joinLines(pRows);
    p.evidence.push(evidence(input, lines.slice(k, reason + 1).join('\n'), s + lineAt(k)));
    if (activities) { p.activities = activities; p.evidence.push(evidence(input, aRaw, s + lineAt(reason + 1))); }
    p.warnings.push('米子市 令和７年度事務事業評価票（継続分）から、目的（「目的（実施理由）」欄）と事業内容（「R6実施内容」欄）を収録。'
      + '欄の見出しが文の行頭・行間に挟まって出力されるため見出しだけを除き、欄の幅で折り返した改行を除いてつないだ（根拠は見出しを含む元の範囲）。'
      + '目的の欄の先頭に見出しがある（欄の境目が確定する）票だけを対象とした。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '米子市 令和７年度 事務事業評価票（継続分、部局別PDF）の目的（実施理由）・R6実施内容。目的の欄の境目が見出しの位置で確定しない票は対象外。結果一覧表は目的の列がない。',
};
