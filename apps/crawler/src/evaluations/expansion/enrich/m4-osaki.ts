/** 大崎市 (04215): 主要施策の成果（事務事業評価表、令和2〜6年度）の「目的」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ評価表から作られ（事業番号・事務事業名・評価年度）、目的が空欄。
// 「目的」欄は「意図（対象をどういう状態にしたいか）」の見出しと次の「対象 （誰，何に対して）」の見出しの間に印字される。
// 令和4年度以降は「目的」の見出しが1行で前後に付き、令和2・3年度は縦書きの「目」「的」が本文の行の間や行頭に入る。
// 見出しの行だけを除き、本文の行は改行も含めてそのまま採る（見出し以外の行が混ざる欄は採らない）。
// 「実施内容」「成果」の欄は指標名の列と行が交互に混ざるため対象外。
const HEAD = /令和([０-９\d元]+)年度主要施策の成果（事務事業評価表）\n/g;
const INTENT = '\n意図（対象をどういう状態にしたいか）\n';
const TARGET = '\n対象 （誰，何に対して）\n';
const num = (s: string) => s === '元' ? 1 : Number(s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04215' || input.format !== 'pdf') return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, end = heads[i + 1]?.index ?? t.length;
    if (input.truncated && i === heads.length - 1) continue;
    const seg = t.slice(start, end), year = 2018 + num(heads[i][1]);
    // 事務事業名は表面（「事務事業名：」の直前の行）と裏面（「事業番号」「事務事業名」の欄）で一致すること。
    const front = /\n([^\n]+)\n\n事務事業名：\n/.exec(seg);
    const back = /\n事業番号\n\n(\d+)\n\n事務事業名\n\n([^\n]+)\n/.exec(seg);
    if (!front || !back || front[1].trim() !== back[2].trim() || !seg.includes(`\n${back[1]}\n`)) continue;
    const a = seg.indexOf(INTENT), b = seg.indexOf(TARGET, a);
    if (a < 0 || b < 0 || seg.indexOf(INTENT, a + 1) >= 0 || seg.indexOf(TARGET, b + 1) >= 0) continue;
    let from = a + INTENT.length;
    // 令和4年度以降: 見出し「目的」が意図の見出しの直前または直後の行にある。
    const r4 = seg.startsWith('目的\n', from) || seg.slice(0, a).endsWith('\n目的\n');
    if (seg.startsWith('目的\n', from)) from += 3;
    const raw = seg.slice(from, b);
    let lines = raw.split('\n');
    if (!r4) {
      // 令和2・3年度: 縦書きの「目」「的」が、単独の行または本文の行頭（後に空白）としてこの順に1回ずつ現れる。
      const label = (c: string) => lines.flatMap((l, j) => l === c || l.startsWith(`${c} `) ? [j] : []);
      const m = label('目'), k = label('的');
      if (m.length !== 1 || k.length !== 1 || m[0] > k[0]) continue;
      lines = lines.flatMap(l => l === '目' || l === '的' ? [] : [/^[目的] /.test(l) ? l.slice(2) : l]);
    }
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length || lines.some(l => !l.trim() || /^[①-⑳◆]|^対象|^目的$/.test(l))) continue;
    const purpose = lines.join('\n').trim();
    if (purpose.length < 5) continue;
    const name = back[2].trim();
    const p = project(input, `${back[1]}:purpose`, name, null, back[0].slice(1, -1), start + back.index + 1);
    p.evaluatedFiscalYear = year;
    p.purpose = purpose;
    p.evidence.push(evidence(input, raw, start + from));
    p.warnings.push('主要施策の成果（事務事業評価表）の「目的」（意図）欄の原文。縦書きの見出し文字「目」「的」（単独の行または行頭）だけを除いた。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '大崎市 主要施策の成果（事務事業評価表、令和2〜6年度）の「目的」（意図）欄。事務事業名は表面と裏面の記載が一致するものに限る。実施内容・成果の欄は指標名の列と混ざるため対象外。',
};
