/**
 * 22213 掛川市: 公開済みレコードの空欄に目的・事業内容を補う。
 * - 令和２〜６年度 交付金活用事業評価（m6-f4 と同じ事業別シート）: 「目的」欄（見出しの直後の段落で、次に見出し「対象」が来るもの）。
 * - 令和５年度実績に基づく効果検証（h2-sheets と同じ事務事業評価表）: 「事業目的」と「具体的な事業内容」（見出しの直後の段落で、
 *   次の見出しが続くもの）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

const GRANTS = new Set(['54be8193107649a54d71831d', '54c97639a97d3d38cd238beb', 'f725bf0e514bb0ec25845bcb', 'cbc970535f96eb3a0c4022b7', 'b2da374d594633f77c8aa001']);
const GRANT_TITLE = /^(?:資料２\n\n)?令和([２-６2-6])年度\n(?:新型コロナウイルス感染症対応|物価高騰重点支援)[^]{0,200}?事業評価\n/;
// m6-f4 の事業別シートの見出し（番号・担当課・事業名。事業名の位置は様式で3通り）。目的が見出しから離れて出力される4通り目は採らない。
const DEPT = '([^\\n]{1,40}(?:課|館|局|室))';
const GRANT_SHEETS: RegExp[] = [
  new RegExp(`(?<=\\n)(\\d{1,2})\\n\\n${DEPT}\\n\\n?事業名\\n\\n((?:[^\\n]+\\n){1,2})\\n`, 'g'),
  new RegExp(`(?<=\\n)(\\d{1,2})\\n\\n${DEPT}\\n\\n?事業名\\n\\n([^\\n]+\\n)(?=[①-④]-)`, 'g'),
  new RegExp(`(?<=\\n)(\\d{1,2})\\n\\n${DEPT}\\n\\n([^\\n]+\\n)\\n事業名\\n`, 'g'),
];
const REVIEW = 'af1853fd779abe867aded6ca', REVIEW_HEAD = '（令和５年度実績（決算後））';
/** 本文1行は全角45〜50字。 */
const WRAP = 40;
const join = (raw: string) => raw.split('\n').reduce((acc, l, i, ls) => acc + (i === 0 ? '' : ls[i - 1].length >= WRAP && !/。$/.test(ls[i - 1]) ? '' : '\n') + l, '');
const reiwa = (s: string) => 2018 + Number(s.normalize('NFKC'));

/** 見出し行の直後（空行のあと）の1段落で、その次の段落が next の見出しで始まるもの。 */
function paragraph(text: string, from: number, to: number, label: string, next: RegExp): { raw: string; at: number } | null {
  const seg = text.slice(from, to), hits = [...seg.matchAll(new RegExp(`\\n${label}\\n\\n`, 'g'))];
  if (hits.length !== 1) return null;
  const at = hits[0].index! + hits[0][0].length, end = seg.indexOf('\n\n', at);
  if (end < 0 || !next.test(seg.slice(end + 2))) return null;
  const raw = seg.slice(at, end);
  if (!raw.trim() || /^(対象|目的|事業目的|具体的な|―|－)/.test(raw)) return null;
  return { raw, at: from + at };
}

function grants(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = GRANT_TITLE.exec(t);
  if (!title) return [];
  const year = reiwa(title[1]), out: ProjectEvaluation[] = [];
  const heads = GRANT_SHEETS.flatMap(re => [...t.matchAll(re)]).sort((a, b) => a.index! - b.index!);
  for (const h of heads) {
    if (t.slice(Math.max(0, h.index! - 120), h.index!).includes('資料の見方')) continue;
    const name = h[3].replace(/\n/g, '');
    if (/国の経済対策|目的|事業期間|事業名/.test(name)) continue;
    const at = h.index!, next = t.indexOf('事業名\n', at + h[0].length), end = next < 0 ? t.length : next;
    if (!t.slice(at, end).includes('内部評価')) continue;
    const purpose = paragraph(t, at, end, '目的', /^対象\n/);
    // 「国の経済対策との関係」の値（①-Ⅱ-２．… など）が目的の段落に混ざる票は採らない。
    if (!purpose || purpose.raw.split('\n').some(l => /^(?:[①-④]-)?[Ⅰ-Ⅴ][-.．]/.test(l))) continue;
    const p = project(input, `narrative-${at}`, name, null, h[0], at);
    p.projectCode = null; p.department = h[2]; p.evaluatedFiscalYear = year;
    p.purpose = join(purpose.raw);
    p.evidence.push(evidence(input, title[0].trimEnd(), 0), evidence(input, purpose.raw, purpose.at));
    p.warnings.push(`掛川市 令和${title[1]}年度 交付金活用事業評価の事業別シート（No.${h[1]}）の「目的」欄を収録。見出し「目的」の直後の段落で、次に見出し「対象」が続くものに限る。PDFの折り返しの改行を除いた。`);
    out.push(p);
  }
  return out;
}

function review(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/事務事業評価表\n/g)].map(m => m.index!)
    .filter(i => t.slice(i, i + 200).includes(REVIEW_HEAD) && !t.slice(Math.max(0, i - 20), i).includes('評価書の見かた'));
  starts.forEach((from, k) => {
    let to = starts[k + 1] ?? t.length;
    const policy = t.indexOf('施策の方向評価表', from);
    if (policy >= 0 && policy < to) to = policy;
    const head = t.slice(from, Math.min(to, from + 900));
    // 事業名は、細事業名の次の行で、その後に施策体系の番号と「戦略名」が続く。
    const name = /\n\n([^\n]+)\n\n\d+\n戦略名\n/.exec(head);
    if (!name) return;
    const purpose = paragraph(t, from, to, '事業目的', /^具体的な\n事業内容\n/);
    const content = paragraph(t, from, to, '具体的な\n事業内容', /^対象（誰、何）\n/);
    if (!purpose && !content) return;
    const p = project(input, `narrative-${from}`, name[1], 2024, name[1], from + name.index! + 2);
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, REVIEW_HEAD, t.indexOf(REVIEW_HEAD, from)));
    if (purpose) { p.purpose = join(purpose.raw); p.evidence.push(evidence(input, purpose.raw, purpose.at)); }
    if (content) { p.activities = join(content.raw); p.evidence.push(evidence(input, content.raw, content.at)); }
    p.warnings.push('掛川市 令和５年度実績に基づく効果検証（行政評価）の事務事業評価表の「事業目的」（目的）と「具体的な事業内容」（事業内容）を収録。見出しの直後の段落で、次の見出しが続くものに限る。PDFの折り返しの改行を除いた。');
    out.push(p);
  });
  return out;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22213' || input.truncated) return [];
  if (GRANTS.has(input.sourceId)) return grants(input);
  if (input.sourceId === REVIEW) return review(input);
  return [];
}

export const entry = {
  extract,
  scope: '掛川市 交付金活用事業評価（令和２〜６年度）の事業別シートの「目的」と、令和５年度実績に基づく効果検証（行政評価）の事務事業評価表の「事業目的」「具体的な事業内容」。',
};
