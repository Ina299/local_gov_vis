/**
 * 佐賀県 令和６年度 決算説明報告書・施策方針実施状況報告書（令和７年９月）の各施策「２．主な事業の実績」表
 * （事業名／事業内容／決算額/予算額（千円））。部局は報告書の部ごとの扉（「政 策 部」等）に従う。
 * 抽出テキストでは事業名欄が複数行に分かれ事業内容の行と交互に出力されるため、次の条件をすべて満たす行だけを収録する:
 *  - 表内の番号行が 1..n の順に並び、金額「A/B」の個数が n と一致し、番号k → 金額k → 番号k+1 の順に交互に現れる（列の対応の証明）;
 *  - 事業名欄の断片（13字以下の短い行）をつないだ名称が「…事業」で終わり、括弧の対応がとれる。
 * 令和５年度版は抽出テキストが文字化け（フォント符号化の欠落）しているため対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, mergeReprints, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const TITLE = '令和６年度\n\n決 算 説 明 報 告 書\n施策方針実施状況報告書\n令和７年９月';
const DEPTS = ['政策部', '総務部', '地域交流部', '県民環境部', '健康福祉部', '産業労働部', '農林水産部', '県土整備部', '教育委員会', '警察本部'];
const HEADER = new Set(['事業名', '事', '業', '内', '容', '業 内 容', '業 内', '事 業 内 容', '決算額/予算額（千円）', '業名']);
const FW = '０１２３４５６７８９';
const toInt = (s: string) => Number(s.replace(/[０-９]/g, c => String(FW.indexOf(c))));
const G = String.raw`\d{1,3}(?: ?,\d{3})*`;
const PAIR = new RegExp(String.raw`(?<![\d,.])(?:(${G})|([-－]))\s?[/／]\s?(${G})(?![\d,])`, 'g');
const NL = String.fromCharCode(10);
const PAIR_LINE = new RegExp(String.raw`(?:${G}|[-－])\s?[/／]\s?${G}`);
const balanced = (s: string) => [['（', '）'], ['「', '」'], ['(', ')']].every(([o, c]) => s.split(o).length === s.split(c).length);

type Tok = { kind: 'idx'; n: number; start: number; end: number } | { kind: 'pair'; m: RegExpExecArray; start: number; end: number };

function departments(t: string): { start: number; name: string; raw: string }[] {
  const out: { start: number; name: string; raw: string }[] = [];
  for (const m of t.matchAll(/\n\n((?:[^\n]\n\n){1,5}[^\n])\n\n\n/g)) {
    const name = m[1].replace(/\n/g, '');
    if (DEPTS.includes(name)) out.push({ start: m.index! + 2, name, raw: m[1] });
  }
  return out;
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '41000') return [];
  const t = input.text;
  if (!t.startsWith(TITLE)) return [];
  const depts = departments(t);
  if (depts.map(d => d.name).join() !== DEPTS.join()) return [];
  const out: ProjectEvaluation[] = [];
  const secStarts = [...t.matchAll(/２．主な事業の実績\n/g)].map(m => m.index!);
  secStarts.forEach((s, si) => {
    const e = t.indexOf('３．今後の取組方針', s);
    if (e < 0 || (secStarts[si + 1] !== undefined && e > secStarts[si + 1])) return;
    const sec = t.slice(s, e);
    const pairs = [...sec.matchAll(PAIR)];
    const n = pairs.length;
    if (!n) return;
    const idx = [...sec.matchAll(/^([0-9０-９]{1,2})$/gm)]
      .filter(m => sec.slice(m.index! + m[0].length, m.index! + m[0].length + 3) !== '\n\n\n' && toInt(m[1]) <= n);
    if (idx.length !== n || idx.some((m, k) => toInt(m[1]) !== k + 1)) return;
    // 番号k → 金額k → 番号k+1 の交互の並び
    const toks: Tok[] = [];
    for (let k = 0; k < n; k++) {
      toks.push({ kind: 'idx', n: k + 1, start: idx[k].index!, end: idx[k].index! + idx[k][0].length });
      toks.push({ kind: 'pair', m: pairs[k], start: pairs[k].index!, end: pairs[k].index! + pairs[k][0].length });
    }
    if (toks.some((tk, k) => k > 0 && tk.start < toks[k - 1].end)) return;
    const dept = [...depts].reverse().find(d => d.start < s);
    if (!dept) return;
    for (let k = 0; k < n; k++) {
      // 事業名: 番号行の直前の1行（改行1つで隣接）が「…事業」で終わる13字以下の行で、そのさらに前の行が事業名欄の断片でない（空行・長い行・金額行）場合のみ。
      const iAbs = s + idx[k].index!;
      const before = t.slice(0, iAbs - 1);
      if (t[iAbs - 1] !== NL) continue;
      const nameStart = before.lastIndexOf(NL) + 1;
      const nameLine = t.slice(nameStart, iAbs - 1);
      const prevStart = t.lastIndexOf(NL, nameStart - 2) + 1;
      const prevLine = t.slice(prevStart, nameStart - 1).trim();
      if (nameStart - 1 < s + (k === 0 ? 0 : pairs[k - 1].index!)) continue;
      const nm = nameLine.trim();
      if (nm !== nameLine || nm.length < 4 || nm.length > 13 || !/事業$/.test(nm) || !balanced(nm) || /[。、：:・0-9]/.test(nm)) continue;
      void prevLine;
      // 前の事業の金額（先頭行は表見出し）から事業名の行まで、および番号行から当該金額までに、事業名欄の断片になりうる短い行
      // （13字以下で句点で終わらない、見出し・金額・番号・記号でない行）が1つでもあれば、事業名が複数行に分かれている可能性があるため収録しない。
      const regionStart = s + (k === 0 ? sec.indexOf('決算額/予算額（千円）') : pairs[k - 1].index! + pairs[k - 1][0].length);
      const between = (a: number, b: number) => t.slice(a, b).split(NL).map(x => x.trim()).filter(x => x.length > 0);
      const fragment = (x: string) => x.length <= 13 && !/[。、：]/.test(x) && !HEADER.has(x) && !PAIR_LINE.test(x) && !/^[0-9０-９]+$/.test(x) && !/^[・※]$/.test(x);
      if (between(regionStart, nameStart).some(fragment)) continue;
      if (between(iAbs + idx[k][0].length, s + pairs[k].index!).some(fragment)) continue;
      // 番号行の後（空行を挟む）の行が括弧書き（例「（デジ田交付金）」）の場合は事業名の続きの可能性があるため収録しない。
      const after = /^\n+([^\n]*)/.exec(t.slice(iAbs + idx[k][0].length));
      if (after && /^[（(]/.test(after[1].trim()) && after[1].trim().length <= 13) continue;
      const name = nm;
      const frags = [{ text: nm, start: nameStart }];
      const pm = pairs[k];
      const p = project(input, `${si + 1}-${k + 1}`, name, null, frags[0].text, frags[0].start);
      for (const f of frags.slice(1)) p.evidence.push(evidence(input, f.text, f.start));
      p.evidence.push(evidence(input, idx[k][0], s + idx[k].index!), evidence(input, TITLE, 0));
      p.department = dept.name;
      p.evidence.push(evidence(input, dept.raw, dept.start));
      p.evaluatedFiscalYear = 2024;
      const unit = evidence(input, '決算額/予算額（千円）', t.indexOf('決算額/予算額（千円）', s));
      p.evidence.push(unit);
      if (pm[1]) p.amounts.push(amount(input, 'actual', 2024, pm[1], '千円', pm[0], s + pm.index!));
      else p.warnings.push('決算額欄が「-」のため決算額なし（予算額のみ）。');
      p.amounts.push(amount(input, 'budget', 2024, pm[3], '千円', pm[0], s + pm.index!));
      p.warnings.push('令和６年度決算説明報告書「主な事業の実績」の「決算額/予算額（千円）」欄。予算額は最終予算か当初予算かが印字されないため参考値（繰越を含む場合がある）。事業名は番号の直前に1行で印字された「…事業」の行。部局は報告書の部の扉による。');
      out.push(p);
    }
  });
  return mergeReprints(out, p => `${p.department}|${nfkc(p.projectName)}`);
}

export const entries: Record<string, Entry> = {
  '41000': {
    scope: '令和６年度 決算説明報告書・施策方針実施状況報告書の各施策「主な事業の実績」表のうち、番号と金額（決算額/予算額、千円）の並びが検算でき事業名欄が「…事業」として復元できる行のみ。部局は部ごとの扉による。令和５年度版（抽出テキスト文字化け）、歳入歳出決算の表、施策指標は対象外。',
    extract: (input) => extractOne(input),
  },
};
