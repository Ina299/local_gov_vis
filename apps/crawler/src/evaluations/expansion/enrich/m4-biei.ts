/** 美瑛町 (01459): 美瑛町まちづくり評価調書（令和元・2年度事業）の「事業の概要・目的」「事業目的」「事業概要」「実施結果・現状」。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコード（batch12/m7-c）は同じ資料（評価一覧表と評価調書）から作られ、目的・事業内容・成果が空欄。
// 令和元年度事業の調書は「事業の概要・目的」の欄名が1行で立ち、その後に本文の段落、空行を挟んで「実施による効果」の欄名が
// 1行で続く票だけを採る（欄名が本文の行頭に混ざる票、担当係名が本文の段落に混ざる票は採らない）。「事業の概要・目的」は目的とする。
// 令和2年度事業の調書は縦書きの欄名「事 業 目 的」「事 業 概 要」の後の段落を、次の欄名が1行ずつ立って続く場合だけ採る
// （事業目的→目的、事業概要→事業内容、実施結果・現状→成果）。欄名が本文の行に混ざる票は採らない。
// 令和4年度の個別施策評価調書の小事業（公開済みレコードの大半）は事業ごとの本文欄を持たないため対象外。
const HEAD = /美瑛町まちづくり評価調書\n/g;
const R1 = /\n事業の概要・目的\n\n([^\n]+(?:\n[^\n]+)*)\n\n実施による効果\n/;
const V = (s: string) => s.split('').join('\n\n');
const R2_OUTLINE = new RegExp(`\\n${V('事業概要')}\\n\\n([^\\n]+(?:\\n[^\\n]+)*)\\n\\n${V('事業目的')}\\n\\n`);
const R2_PURPOSE = new RegExp(`\\n${V('事業目的')}\\n\\n([^\\n]+(?:\\n[^\\n]+)*)\\n\\n実施結果・現状\\n\\n`);
const R2_RESULT = new RegExp(`\\n${V('事業目的')}\\n\\n[^\\n]+(?:\\n[^\\n]+)*\\n\\n実施結果・現状\\n\\n([^\\n]+(?:\\n[^\\n]+)*)\\n\\n２\\n\\n事業評価\\n`);
const fw = (s: string) => s === '元' ? 1 : Number(s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01459' || input.format !== 'pdf') return [];
  const t = input.text, starts = [...t.matchAll(HEAD)].map(m => m.index!), out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    if (input.truncated && i === starts.length - 1) return;
    const sheet = t.slice(s, starts[i + 1] ?? t.length);
    // 年度は調書の直前の「令和○年度事業」の見出し（公開済みレコードの評価対象年度と同じ）。
    const y = /令和(元|[０-９\d]+)年度事業\n[^\n]*\n*$/.exec(t.slice(Math.max(0, s - 30), s));
    if (!y) return;
    const year = 2018 + fw(y[1]);
    const fields: { key: 'purpose' | 'activities' | 'outcomes'; m: RegExpExecArray }[] = [];
    let nm: RegExpExecArray | null;
    if (year === 2019) {
      nm = /^美瑛町まちづくり評価調書\n\n事業概要\n事業名\n\n([^\n]+)\n\n担当課・係名\n/.exec(sheet);
      const m = R1.exec(sheet);
      if (m) fields.push({ key: 'purpose', m });
    } else if (year === 2020) {
      const names = [...sheet.matchAll(/\n名 ([^\n]+)\n/g)];
      nm = names.length === 1 ? names[0] : null;
      for (const [key, re] of [['purpose', R2_PURPOSE], ['activities', R2_OUTLINE], ['outcomes', R2_RESULT]] as const) {
        const m = re.exec(sheet);
        if (m) fields.push({ key, m });
      }
    } else return;
    if (!nm || !fields.length) return;
    const name = nm[1].trim();
    const p = project(input, `${year}:${name}:narrative`, name, null, nm[1], s + nm.index! + nm[0].indexOf(nm[1]));
    p.evaluatedFiscalYear = year;
    for (const { key, m } of fields) {
      p[key] = m[1];
      p.evidence.push(evidence(input, m[1], s + m.index! + m[0].indexOf(m[1])));
    }
    p.warnings.push(year === 2019
      ? '美瑛町まちづくり評価調書（令和元年度事業）の「事業の概要・目的」欄の本文を目的として収録（欄名と本文が段組みで混ざらない票のみ）。'
      : '美瑛町まちづくり評価調書（令和2年度事業）の「事業目的」を目的、「事業概要」を事業内容、「実施結果・現状」を成果として収録（欄名と本文が段組みで混ざらない欄のみ）。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '美瑛町 まちづくり評価調書（令和元年度事業: 「事業の概要・目的」→目的。令和2年度事業: 「事業目的」→目的、「事業概要」→事業内容、「実施結果・現状」→成果）。欄名と本文が段組みで混ざる票は対象外。令和4年度の個別施策評価調書の小事業は本文欄がないため対象外。',
};
