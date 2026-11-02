/**
 * 08215 北茨城市: 令和3年度事務事業評価書（対象：令和2年度実施計画事業）。公開済みレコード（同じ評価書の事務事業名）の空欄の目的・事業内容に
 * 「１ 事業の概要・成果目標」の「目的及び背景」欄と「事業内容」欄を補う。
 * 抽出テキストでは欄の見出し（目的／及び／背景／事業／内容）が本文より前にまとめて出て、2つの欄の本文が続けて出る。事務事業名の後、
 * 事業期間・新規継続などの見出しや数字だけの行を除いた本文が、次のどちらかの形のものに限って採る。
 * - 空行（または見出し「事業／内容」）で区切られたちょうど2つの塊: 1つ目を目的、2つ目を事業内容とする。
 * - 1つの塊: 欄の幅に満たず句点で終わる行で段落を区切り、1段落目を目的とする。目的及び背景の欄は3行分の高さなので、1段落目が3行未満のときは
 *   3行目までの行がどれも句点で終わらない（目的の欄の2段落目とみなせる行がない）場合に限る。1段落目がちょうど3行（欄が埋まっている）で、
 *   残りが1段落のときだけ、残りを事業内容とする。
 * どの欄も見出しの語だけの行・数字だけの行を含まないものに限る。PDFの折り返しの改行は除く。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { unwrap } from './m1-util';

const HEADING = '令和3年度事務事業評価書\n（対象：令和2年度実施計画事業）';
const SHEET = /\n事務事業名\n([^\n]+)\n((?:[^\n]*\n)*?)\n成果\n目標\n/g;
/** 事業期間・新規継続・欄の見出しなど、本文の前後に出る見出しの行 */
const HEADER = /^(担当課 .*|平成|令和|(平成|令和) ?[０-９\d]+|[０-９\d]+|年度|年度 ～|～|事業|期間|１新 規|２継 続|継続|新規|→|目的|及び|背景|内容|施策|区分)$/;

interface Part { text: string; at: number }
/** 折り返しの改行を除く。欄の最長行が30字未満なら（短い箇条を並べた欄）改行は折り返しではないのでそのまま。 */
const join = (s: string) => Math.max(...s.split('\n').map(l => l.length)) >= 30 ? unwrap(s) : s;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08215' || input.format !== 'pdf' || !input.text.includes(HEADING)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(SHEET)) {
    const name = m[1].trim();
    if (HEADER.test(name)) continue;
    const h = t.lastIndexOf(HEADING, m.index!);
    if (h < 0 || t.slice(h, m.index!).includes('\n事務事業名\n')) continue;
    // 本文の塊（見出し・空行以外の行の連続）とその位置
    const bodyAt = m.index! + '\n事務事業名\n'.length + m[1].length + 1;
    const blocks: Part[] = [];
    let pos = bodyAt, cur: Part | null = null;
    for (const line of m[2].split('\n')) {
      if (!line.trim() || HEADER.test(line.trim())) cur = null;
      else if (cur) cur.text += '\n' + line;
      else blocks.push(cur = { text: line, at: pos });
      pos += line.length + 1;
    }
    let purpose: Part | null = null, activities: Part | null = null;
    if (blocks.length === 2) [purpose, activities] = blocks;
    else if (blocks.length === 1) {
      const lines = blocks[0].text.split('\n'), width = Math.max(...lines.map(l => l.length));
      const ends = lines.flatMap((l, i) => /。$/.test(l) && l.length < width - 2 ? [i] : []);
      const n = (ends[0] ?? -1) + 1;
      if (n > 0 && n <= 3 && lines.slice(n, 3).every(l => !/。$/.test(l))) {
        const text = lines.slice(0, n).join('\n');
        purpose = { text, at: blocks[0].at };
        if (n === 3 && ends.length === 2 && ends[1] === lines.length - 1) activities = { text: lines.slice(n).join('\n'), at: blocks[0].at + text.length + 1 };
      }
    }
    // 数字だけの行を含まず、15字以上の行があること（表の項目名だけの塊を除く）
    const usable = (p: Part | null) => p && p.text.split('\n').some(l => l.length >= 15) && !/^[\d,.]+$/m.test(p.text) ? p : null;
    // 2つの塊の片方が使えない（見出しの残り・表の項目名など）ときは、欄の区切りが想定と違うので両方とも採らない。
    if (blocks.length === 2 && (!usable(purpose) || !usable(activities))) continue;
    purpose = usable(purpose); activities = usable(activities);
    if (!purpose && !activities) continue;
    const p = project(input, `${name}|narrative`, name, 2021, `事務事業名\n${m[1]}`, m.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2020;
    p.evidence.unshift(evidence(input, HEADING, h));
    if (purpose) { p.purpose = join(purpose.text); p.evidence.push(evidence(input, purpose.text, purpose.at)); }
    if (activities) { p.activities = join(activities.text); p.evidence.push(evidence(input, activities.text, activities.at)); }
    p.warnings.push('北茨城市 令和3年度事務事業評価書の「目的及び背景」欄を目的、「事業内容」欄を事業内容として収録。2つの欄の本文が続けて出るため、'
      + '空行・見出しで2つに分かれたもの、または目的の欄（3行分）の終わりが句点の行で確定するものに限る。PDFの折り返しの改行を除いた（最長行が30字未満の欄は改行を残した）。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '北茨城市 令和3年度事務事業評価書（令和2年度実施計画事業）: 「目的及び背景」（目的）と「事業内容」（事業内容）。2つの欄の境目が確定するものに限る。',
};
