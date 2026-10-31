/**
 * 徳島県「主要施策の成果に関する説明書」（平成30年度・令和3〜6年度。令和元・2年度版は抽出テキストが文字化けのため対象外）。
 * 部局→施策（番号付きの見出し・説明・（所管課））→「主要事業名／主要事業内容及び成果」の表の順で、表の行ごとに
 * 事業名（左欄、約10字で折り返し）・内容（中欄）・成果（右欄）と「（N千円）」の金額が並ぶ。
 * 金額は予算額か決算額かが欄名・見出し・利用上の注意のいずれにも印字されないため収録しない（事業名・所管課のみ）。
 * 抽出テキストでは左欄の折り返しが中欄の行と交互に出力されるため、次の形の事業名だけを収録する:
 *  - 行の始まり（直前の行が「（N千円）」の金額行または表の見出し「主要事業内容及び成果」）にある、空白・句読点を含まない短い行 S と、
 *    その次の中欄の行（18字以上）。中欄の次の行が空白・句読点を含まない短い断片 C なら S+C（折り返し）、そうでなければ S を事業名とする;
 *  - 表の見出し「主要事業名」と「主要事業内容及び成果」の間に事業名だけが並ぶ形では、その各行（表の金額行の数が名前の数以上のときだけ）;
 *  - 事業名が「事業」「費」「業務」「補助金」「交付金」「負担金」「貸付金」で終わること（途中で切れた名前を除く）;
 *  - 次の「主要事業名」より前に金額行があり（施策の見出しを事業名と取り違えない）、行内に「（再掲）」がないこと。
 * 所管課は施策ごとの「（○○課）」の表記（原文の注記のとおり翌年度の所管課名）で、1課のときだけ収録する。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const TITLE = /^(令 和|平 成) ?([０-９\d]{1,2}) ?年 度\n+主要施策の成果に関する説明書/;
const NOTE = /各 部 局 の 主 要 施 策 の 成 果 概 要 に つ い て は [、，] (令 和|平 成) ?([０-９\d元]{1,2}) ?年 度 に お け る 各 施 策 の 所 管 課 等 名 を/;
const AMOUNT = /^（\d{1,3}(?:,\d{3})* ?千円）(?: |$)/;
const HEAD_NAME = '主要事業名', HEAD_BODY = '主要事業内容及び成果';
/** 左欄の1行（事業名またはその断片）: 空白・句読点・箇条書き記号を含まず、括弧・数字・記号で始まらない。 */
const FRAGMENT = /^[^\s。、，,：:○〇◯・●■◆※（(「『\d０-９\-－―－][^\s。、，,：:]{0,13}$/;
const SUFFIX = /(?:事業|費|業務|補助金|交付金|負担金|貸付金)$/;
const PAGE = /^(?:[-－] ?\d+ ?[-－]|\d{1,3})$/;
const ORG = /^[^\s、。（）()]{2,20}(?:課|室|局|センター|事務所|所|本部|事務局|委員会)$/;

type Line = { s: string; at: number };

function extractTokushima(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const title = TITLE.exec(t.slice(0, 200));
  if (!title) return [];
  const fy = (title[1] === '令 和' ? 2018 : 1988) + num(title[2]);
  const note = NOTE.exec(t.slice(0, 20000));
  const lines: Line[] = [];
  let off = 0;
  for (const raw of t.split('\n')) {
    const s = raw.trim();
    if (s) lines.push({ s, at: off + raw.indexOf(s) });
    off += raw.length + 1;
  }
  const isAmount = (i: number) => AMOUNT.test(lines[i]?.s ?? '');
  // 「主要事業名」見出しごとの所管課: 直前の金額行から見出しまでの「（○○課）」。ページ番号だけを挟んだ続きの表は前の見出しを引き継ぐ。
  const deptAt = new Map<number, { name: string; raw: string; at: number } | 'multi' | null>();
  let prevDept: { name: string; raw: string; at: number } | 'multi' | null = null;
  lines.forEach((l, i) => {
    if (l.s !== HEAD_NAME && !l.s.startsWith(`${HEAD_NAME} `)) return;
    let j = i - 1;
    while (j >= 0 && !isAmount(j) && lines[j].s !== HEAD_BODY) j--;
    const region = lines.slice(j + 1, i);
    const found: { orgs: string[]; raw: string; at: number }[] = [];
    for (const r of region) {
      const m = /（([^（）]+)）$/.exec(r.s);
      if (!m) continue;
      const orgs = m[1].split(/[、，]/);
      if (orgs.every(o => ORG.test(o))) found.push({ orgs, raw: m[0], at: r.at + m.index });
    }
    let d: typeof prevDept;
    // 「用地対策課・河川整備課」のように「・」で並べた複数課も複数扱い
    if (found.length === 1 && found[0].orgs.length === 1 && !/(?:課|室|局|センター|所)・/.test(found[0].orgs[0])) d = { name: found[0].orgs[0], raw: found[0].raw, at: found[0].at };
    else if (found.length) d = 'multi';
    else d = j >= 0 && region.every(r => PAGE.test(r.s)) ? prevDept : null;
    deptAt.set(i, d);
    prevDept = d;
  });
  const heads = [...deptAt.keys()];
  const out: ProjectEvaluation[] = [];
  const push = (name: string, parts: Line[], end: number) => {
    // 行の終わり（次の金額行）が次の「主要事業名」より前にあり、行内に（再掲）がないこと
    const head = [...heads].reverse().find(h => h < end);
    const nextHead = heads.find(h => h > end) ?? lines.length;
    let k = end;
    while (k < lines.length && !isAmount(k)) k++;
    if (head === undefined || k >= nextHead) return;
    if (lines.slice(end, k + 1).some(l => l.s.includes('（再掲）'))) return;
    const p = project(input, `${fy}-${out.length + 1}`, name, null, parts[0].s, parts[0].at);
    for (const x of parts.slice(1)) p.evidence.push(evidence(input, x.s, x.at));
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], title.index));
    const d = deptAt.get(head);
    if (d && d !== 'multi') {
      p.department = d.name;
      p.evidence.push(evidence(input, d.raw, d.at));
      if (note) p.evidence.push(evidence(input, note[0], note.index));
      p.warnings.push(note ? `所管課は施策ごとの（）書きで、原文の注記により${note[1].replace(' ', '')}${note[2]}年度の所管課名。` : '所管課は施策ごとの（）書き。');
    } else p.warnings.push(d === 'multi' ? '施策の所管課が複数のため担当課は未収録。' : '施策の所管課の表記が確認できないため担当課は未収録。');
    if (parts.length > 1) p.warnings.push(`事業名は左欄で折り返された2行（「${parts[0].s}」「${parts[1].s}」）を連結。`);
    p.warnings.push(`表題「${title[0].split('\n')[0].replace(/ /g, '')}主要施策の成果に関する説明書」の主要事業。事業ごとに「（N千円）」の金額が印字されているが、予算額・決算額の別が原文に記載されないため金額は未収録。`);
    out.push(p);
  };
  for (let i = 1; i < lines.length - 2; i++) {
    const prev = lines[i - 1].s, s = lines[i];
    // 見出し「主要事業名」と「主要事業内容及び成果」の間に事業名だけが並ぶ形
    if (prev === HEAD_NAME) {
      const zone: Line[] = [];
      let j = i;
      while (j < lines.length && lines[j].s !== HEAD_BODY && zone.length < 4) zone.push(lines[j++]);
      if (lines[j]?.s !== HEAD_BODY || !zone.length) continue;
      // 次の「主要事業名」までの金額行が名前の数以上あること（1つの欄に2つの費目名を並べた行を別事業としない）
      const next = heads.find(h => h > j) ?? lines.length;
      const rows = lines.slice(j, next).filter(l => AMOUNT.test(l.s)).length;
      if (rows >= zone.length && zone.every(z => FRAGMENT.test(z.s) && SUFFIX.test(z.s))) zone.forEach(z => push(z.s, [z], j));
      continue;
    }
    if (!(AMOUNT.test(prev) || prev === HEAD_BODY) || !FRAGMENT.test(s.s) || s.s.includes('主要事業')) continue;
    // 金額行の前の行が名前の断片（句点も末尾の「事業」等もない短い行）なら、金額行が左欄の折り返しの途中に割り込んだ形で S も断片
    const pp = lines[i - 2]?.s ?? '';
    if (AMOUNT.test(prev) && FRAGMENT.test(pp) && !SUFFIX.test(pp)) continue;
    const desc = lines[i + 1];
    // 中欄の行: 18字以上で、左欄の名前が1字ずつ空白で区切られて混入した行（「川 口 ダ ム …」）でないこと
    if (desc.s.length < 18 || AMOUNT.test(desc.s) || /^(?:\S ){3}/.test(desc.s)) continue;
    const c = lines[i + 2];
    const cont = FRAGMENT.test(c.s) && c.s.length <= 12 && !AMOUNT.test(c.s);
    const name = cont ? s.s + c.s : s.s;
    if (!SUFFIX.test(name) || name.length < 4) continue;
    push(name, cont ? [s, c] : [s], cont ? i + 2 : i + 1);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '36000': {
    scope: '主要施策の成果に関する説明書（平成30年度・令和3〜6年度）の主要事業の事業名と所管課（施策単位の（）書き）。各事業の「（N千円）」の金額は予算額・決算額の別が原文に記載されないため未収録。事業名が左欄で3行以上に折り返された事業、中欄と同じ行に混ざった事業、再掲の事業、令和元・2年度版（抽出テキストが文字化け）、評価シート・KPI資料は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, extractTokushima, p => `${p.evaluatedFiscalYear}|${nfkc(p.projectName)}`),
  },
};
