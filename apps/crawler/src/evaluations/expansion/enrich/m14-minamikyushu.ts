import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 南九州市（教育委員会の事務の点検・評価報告書 平成26〜令和7年度）
// 公開済みレコードは同じ報告書の事務事業評価シート（評価年度＝報告書の年度、対象年度＝表紙の「（○年度事務事業対象）」）。
// シートの「目的」欄は「対象」「意図（対象をどのような状態にしたいのか）」の2欄で、意図を目的として収録する（築上町・平群町と同じ扱い）。
// 意図の本文は「標を導き出す）」の行（同じ行に続く版もある）から「・どのような活動をするのか」の見出しの手前まで。
// 「手段」欄は活動指標の行と混ざり、欄の終わりが決まらないため採らない。
const DO = /^１ 事務事業の実施（Do）$/gm;
const INTENT = '\n（ここから成果指 ・意図（対象をどのような状態にしたいのか）\n標を導き出す）';
const MEANS = '\n・どのような活動をするのか（教育委員会が行う事務事業の具体的な実施内容）\n';
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\s/g, '');
/** 「平成２６」「令和 6」「令和元」などの和暦を西暦にする。 */
function year(era: string, n: string): number | null {
  const y = n === '元' ? 1 : Number(ascii(n));
  if (!Number.isInteger(y) || y < 1) return null;
  return era === '平成' ? 1988 + y : era === '令和' ? 2018 + y : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '46223' || input.format !== 'pdf' || !/\/material\/files\/group\/32\/[^/]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const cover = /^(平成|令和) ?([０-９\d]+|元) ?年度\n教育委員会の事務の点検・評価報告書\n（(平成|令和) ?([０-９\d]+|元) ?年度事務事業対象）\n/.exec(t);
  if (!cover) return [];
  const ey = year(cover[1], cover[2]), efy = year(cover[3], cover[4]);
  if (ey === null || efy === null || ey !== efy + 1) return [];
  for (const d of t.matchAll(DO)) {
    const at = d.index!, pre = t.slice(Math.max(0, at - 2500), at);
    // 事務事業名は「事 務 事 業 名 ○○」（平成26・27年度）か「○○\n（事務事業名）」の1行。直前のシートのものを採らないよう最後の1件。
    const names = [...pre.matchAll(/(?:^事 務 事 業 名 ([^\n]+)|^([^\n]+)\n（事務事業名）)$/gm)];
    const nm = names[names.length - 1];
    if (!nm) continue;
    const name = (nm[1] ?? nm[2]).trim();
    // 2行に折り返した事業名の2行目（「）」などで始まる）は事業名にならない。
    if (/^[）)・]/.test(name)) continue;
    const head = t.indexOf(INTENT, at), means = t.indexOf(MEANS, at);
    if (head < 0 || means < 0 || head > at + 800 || means < head) continue;
    const from = head + INTENT.length;
    // 「標を導き出す）」の後は改行か、空白1つの後に意図の1行目が続く。
    let raw = t.slice(from, means);
    let start = from;
    if (raw.startsWith(' ')) { raw = raw.slice(1); start += 1; } else if (raw.startsWith('\n')) { raw = raw.slice(1); start += 1; } else continue;
    while (raw.startsWith('\n')) { raw = raw.slice(1); start += 1; }
    raw = raw.replace(/\n+$/, '');
    if (!raw.trim() || raw.includes('\n\n') || /(^|\n)(目|的|手|段|標を導き出す）)(\n|$)/.test(raw)) continue;
    const p = project(input, `narrative:${name}`, name, ey, nm[0], at - pre.length + nm.index!);
    p.projectCode = null; p.evaluatedFiscalYear = efy;
    p.purpose = joinWrapped(raw, 38);
    p.evidence.push(evidence(input, raw, start));
    p.warnings.push('南九州市 教育委員会の事務の点検・評価報告書の事務事業評価シート「目的」欄のうち「意図（対象をどのような状態にしたいのか）」を目的として収録。'
      + '欄の幅での折り返しだけをつないだ。「手段」欄は活動指標の行と混ざるため未収録。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '南九州市 教育委員会の事務の点検・評価報告書（平成26〜令和7年度）の事務事業評価シート: 「目的」欄の意図。手段欄は活動指標と混ざるため対象外。',
};
