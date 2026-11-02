import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m17-util';

// ---------------------------------------------------------------- 松島町（教育行政点検評価報告書 令和4〜6年度）
// 公開済みレコードは第3章の基本施策ごとの事業（「（１） 事業名」）から作られ、目的・概要が空。「事業目的と概要」欄は
// 「◎」で始まる目的の行と「①」〜の概要（取組）の行が「事業実施状況」の見出しまで空行なしで続く。◎の行を目的、
// ①〜の行を事業内容とする（行がどちらの記号でも始まらない場合は前の行の折り返し）。事業実施状況・効果・課題は3列が
// 交互に出力されるため採らない。年度は第3章の見出し「令和６年度松島町教育行政点検評価」（評価対象の年度）。
const CHAPTER = /^(?:-\s?[０-９\d]+\s?)?第３章 令和([０-９]+)年度松島町教育行政点検評価$/m;
const FIELD = /^(?:-\s?[０-９\d]+\s?)?【担当課：([^】\n]+)】\n基本施策[^\n]*\n（[０-９]+）\s?([^\n]+)\n事業目的と概要\n((?:[^\n]+\n)+?)事業実施状況\n/gm;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '04401' || !/\/uploaded\/attachment\/16(19|20|22)\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, ch = CHAPTER.exec(t), out: ProjectEvaluation[] = [];
  if (!ch) return [];
  const year = 2018 + Number(ascii(ch[1]));
  for (const m of t.matchAll(FIELD)) {
    if (m.index! < ch.index!) continue;
    const lines = m[3].slice(0, -1).split('\n');
    // ◎の段（目的）と①〜の段（概要）に分ける。最初の行は◎で始まること。
    const goal: string[] = [], items: string[] = [];
    let cur: string[] | null = null, ok = /^◎/.test(lines[0]);
    for (const l of lines) {
      if (/^◎/.test(l)) { if (cur === items) ok = false; cur = goal; }
      else if (/^[①-⑳] ?/.test(l)) cur = items;
      if (!cur) ok = false;
      cur?.push(l);
    }
    if (!ok || !goal.length) continue;
    const at = m.index! + m[0].indexOf('\n事業目的と概要\n') + '\n事業目的と概要\n'.length;
    const p = project(input, `R${ascii(ch[1])}:${m[2]}:narrative`, m[2].trim(), null, m[0].slice(0, m[0].indexOf('\n事業目的と概要')), m.index!);
    p.evaluatedFiscalYear = year;
    p.department = m[1];
    const goalRaw = goal.join('\n');
    p.purpose = unwrap(goalRaw).replace(/^◎ ?/gm, '');
    p.evidence.push(evidence(input, ch[0], ch.index!), evidence(input, goalRaw, at));
    if (items.length) {
      const itemsRaw = items.join('\n');
      p.activities = unwrap(itemsRaw);
      p.evidence.push(evidence(input, itemsRaw, at + goalRaw.length + 1));
    }
    p.warnings.push('松島町教育行政点検評価の「事業目的と概要」欄のうち、「◎」の行を目的、「①」〜の行を事業内容として収録。欄の幅での折り返しだけをつないだ。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '松島町 教育行政点検評価報告書（令和4〜6年度）: 「事業目的と概要」欄の◎（目的）と①〜（事業内容）。事業実施状況・効果・課題は列が交互に出力されるため対象外。',
};
