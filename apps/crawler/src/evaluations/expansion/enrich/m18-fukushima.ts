import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 福島町（令和7年度（令和6年度決算）事務事業評価結果表・評価シート）
// 公開済みレコードは同じPDFの冒頭の評価点集表の行（整理番号・担当課・事務事業名）から作られた（評価年度2025・事業年度2024）。
// 各評価シートは「整理番号 NN」で始まり、「事業の目的」欄の「(2)意図（対象をどのような状態にしたいのか）」の内容は、
// 縦書きの見出し「的」の後（同じ行または次の行）から空行・次の欄の見出しの手前まで。ここでは整理番号で点集表の事業名に対応させ、
// シートに同じ事業名（財務名称）があり、意図の内容が句点で終わり縦書き見出しの1字の行が割り込まない場合に限り、目的として足す。
// (1)対象・(3)手段の欄は2列の内容が前後して並ぶため採らない。
const ID = '527239bf6bce14df1c6aec0a';
const HEADING = '令和７年度（令和６年度決算） 事務事業評価結果表\nR７評価点集表';
const ROW = /\n\n(\d+)\n\n(?:([^\n]+?)\n\n([^\n]+?)|(\S+?(?:局|課|係|所|室|センター|園)) (\S+))\n\n\d\n\n\d\n\n\d+\n\n-?\d\n\n-?\d\n\n-?\d+\n\n\d+\n\n[A-D]\n\n[A-D]\n\n[A-D]\n\n[A-D](?=\n)/g;
const INTENT = '(2)意図（対象をどのような状態にしたいのか）\n';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01332' || input.sourceId !== ID || !input.text.startsWith(HEADING)) return [];
  const t = input.text, end = t.indexOf('事務事業評価シート'), table = t.slice(0, end < 0 ? t.length : end);
  const names = new Map<number, { dept: string; name: string }[]>();
  for (const m of table.matchAll(ROW)) {
    const no = Number(m[1]), row = { dept: m[2] ?? m[4], name: m[3] ?? m[5] };
    names.set(no, [...(names.get(no) ?? []), row]);
  }
  const sheets = [...t.matchAll(/令和７年度（令和６年度決算）事務事業評価シート\n整理番号 (\d+)\n/g)];
  const seen = new Map<number, number>();
  for (const s of sheets) seen.set(Number(s[1]), (seen.get(Number(s[1])) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  sheets.forEach((s, i) => {
    const no = Number(s[1]), rows = names.get(no);
    if (!rows || rows.length !== 1 || seen.get(no) !== 1 || (input.truncated && i === sheets.length - 1)) return;
    const { dept, name } = rows[0], start = s.index!, seg = t.slice(start, sheets[i + 1]?.index ?? t.length);
    if (!seg.includes(`\n${name}\n`)) return;
    const k = seg.indexOf(INTENT);
    if (k < 0) return;
    let at = k + INTENT.length;
    if (seg.startsWith('的 ', at)) at += 2;
    else if (seg.startsWith('的\n', at)) at += 2;
    else return;
    const lines: string[] = [];
    for (let pos = at; pos < seg.length;) {
      const nl = seg.indexOf('\n', pos), line = seg.slice(pos, nl < 0 ? seg.length : nl);
      if (!line.trim() || /^\(1\)町関与の根拠/.test(line)) break;
      lines.push(line);
      pos = nl < 0 ? seg.length : nl + 1;
    }
    const raw = lines.join('\n');
    if (!raw.endsWith('。') || lines.some(l => l.trim().length <= 1)) return;
    const p = project(input, `整理番号${s[1]}:purpose`, name, 2025, s[0].slice(0, -1), start);
    p.evaluatedFiscalYear = 2024;
    p.department = dept;
    p.purpose = joinWrapped(raw, 30);
    p.evidence.push(evidence(input, raw, start + at));
    p.warnings.push('事務事業評価シートの「事業の目的」欄の「(2)意図（対象をどのような状態にしたいのか）」（縦書きの見出しの字を除き、欄の幅での折り返しだけを除いてつないだ）。事業名は整理番号で評価点集表に対応させた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '福島町 令和7年度（令和6年度決算）事務事業評価シート: 事業の目的欄の(2)意図（目的）。(1)対象・(3)手段の欄は2列の内容が前後して並ぶため対象外。',
};
