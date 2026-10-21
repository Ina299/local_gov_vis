import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, nfkc } from '../batch7/g1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Non-empty line blocks separated by blank lines, with their offsets. */
function paragraphs(text: string): { start: number; text: string }[] {
  return [...text.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map(m => ({ start: m.index!, text: m[0] }));
}

/** 丹波篠山市 令和6・7年度 行政評価表（事務事業ごとの実施状況・今後の方向性・担当課の一覧）。 */
const SASAYAMA: Record<string, { heading: string; year: number }> = {
  '50b771572fe62f957f717e28': { heading: '令和７年度丹波篠山市行政評価表', year: 2025 },
  'b42d7caf5f5be940b8821587': { heading: '令和６年度丹波篠山市行政評価表', year: 2024 },
};
const DIRECTION = /^(現状維持|拡充|改善|完了|縮小|廃止|統合|休止)$/;
const isDept = (s: string) => !/[、。\d]/.test(s) && !s.split('\n').some(l => l.length > 15) && /(課|室|局|本部|センター|所)$/.test(s);

function extractSasayama(input: CachedInput): ProjectEvaluation[] {
  const doc = SASAYAMA[input.sourceId];
  if (input.municipalityCode !== '28221' || !doc || !input.text.startsWith(doc.heading)) return [];
  const paras = paragraphs(input.text), out: ProjectEvaluation[] = [];
  for (let i = 0; i < paras.length; i++) {
    // The row number and business name printed together on their own line; wrapped names are skipped.
    const head = paras[i].text.match(/^(\d{1,2}) (\S+)$/);
    if (!head) continue;
    // Then 1–2 blocks of 事業概要/実施状況, then 今後の方向性 and 担当課, with no other row number in between.
    let k = -1;
    for (let j = i + 1; j <= i + 3 && j < paras.length; j++) {
      if (DIRECTION.test(paras[j].text)) { k = j; break; }
      if (/(^|\n)\d+( |$)/m.test(paras[j].text) || /No|事務事業名|小目標|中目標|担当課/.test(paras[j].text)) break;
    }
    if (k < i + 2 || k + 1 >= paras.length || i === 0) continue;
    const deptPara = paras[k + 1], prev = paras[i - 1];
    if (!isDept(deptPara.text)) continue;
    // The row must start right after the previous row's 担当課 (or the 担当課 column header) and run without a page/column break.
    if (!(isDept(prev.text) || prev.text === '担当課') || input.text.slice(prev.start + prev.text.length, paras[i].start) !== '\n\n') continue;
    const name = head[2], start = paras[i].start, raw = input.text.slice(start, deptPara.start + deptPara.text.length);
    if (raw.includes('\n\n\n')) continue;
    const p = project(input, name, name, doc.year, raw, start);
    p.department = !deptPara.text.includes('\n') && /(課|室|局|センター|所)$/.test(deptPara.text) ? deptPara.text : null;
    p.ratings.push({ kind: 'self', label: '今後の方向性', value: paras[k].text, scale: null, evidence: evidence(input, raw, start) });
    p.evidence.push(evidence(input, doc.heading, 0));
    p.warnings.push(`${doc.heading}の1行（No・事務事業名・今後の方向性・担当課）から収録。表の列が抽出テキストで折り返し混在するため、前の行の担当課の直後にNo.と事務事業名が1行で始まり、改ページ・段組みの切れ目なく方向性と担当課が続く行のみ対象とし、事務事業名が折り返された行は収録していません。評価対象年度は本文に明記がなく未設定。今後の方向性の区分定義は資料に記載がありません。`);
    if (!p.department) p.warnings.push('担当課が複数行（複数課または課名の折返し）のため担当課は未設定。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectName);
}

/** 平群町 令和4年度 政策基本体系表（個別シート）。目次の行（事務・事業名・主務担当課・予算科目）と個別シート見出しを照合。 */
function extractHeguri(input: CachedInput): ProjectEvaluation[] {
  const title = '令和 4 年度\n\n平群町政策基本体系表';
  const intro = '本体系表は、令和4年度に実施した事業の事務事業評価について、概要を取りまとめたものです。';
  if (input.municipalityCode !== '29342' || input.sourceId !== '094040bcde43ce0547eec588' || !input.text.startsWith(title) || !input.text.includes(intro)) return [];
  const heading = '令和４年度 平群町政策基本体系表（個別シート）';
  const firstSheet = input.text.indexOf(heading);
  const toc = input.text.slice(0, firstSheet);
  const sheets = [...input.text.matchAll(new RegExp(`${heading}[\\s\\S]*?Ⅰ 事務事業の目的・概要`, 'g'))].map(m => ({ start: m.index!, text: m[0], norm: nfkc(m[0]) }));
  const out: ProjectEvaluation[] = [], used = new Set<number>(), ambiguous = new Set<number>();
  for (const m of toc.matchAll(/(?<=^|\n\n)(\d+)\n\n([^\n]+)\n\n([^\n]+?)\n\n(\d+)\n\n([\d/]+)\n\n([\d/]+)\n\n([^\n]+)(?=\n)/g)) {
    const [row, , name, dept] = m;
    const key = nfkc(name), d = nfkc(dept);
    const hits = sheets.filter(s => s.norm.includes(key) && s.norm.includes(d));
    if (hits.length !== 1) continue;
    const sheet = hits[0];
    // A sheet claimed by two 目次 rows (one name contained in another) is ambiguous: drop both.
    if (used.has(sheet.start)) { ambiguous.add(sheet.start); continue; }
    used.add(sheet.start);
    const p = project(input, `${dept}:${name}`, name, null, sheet.text, sheet.start);
    p.department = dept; p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, row, m.index), evidence(input, intro));
    p.warnings.push('目次の行（事務・事業名・主務担当課）と、見出しに同じ事業名・担当課を含む個別シートが1対1で対応したもののみ収録。評価対象年度は「令和4年度に実施した事業の事務事業評価」の記載による。個別シートの成果指標・コストは年度列と値の対応が抽出テキストで確定できないため未収録。評価実施年度は本文に明記がなく未設定。');
    out.push(p);
  }
  return mergeReprints(out.filter(p => !ambiguous.has(Number(p.evidence[0].cell!.match(/chars:(\d+)-/)![1]))), p => p.projectCode!);
}

/** 東かがわ市 PDCAチェックシート（全体版）。事業名は一覧ページ（HTML）の掲載事業名と一致したものに限る。 */
function extractHigashikagawa(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '37207' || input.sourceId !== '3f1cea6b6be2b03c48b0fdde') return [];
  const list = inputs.find(i => i.sourceId === '035e2407e0e75fb430699029')?.text;
  if (!list) return [];
  // 一覧の行: No / 担当課名（同じ課が続く行は省略）/ 事務事業名(PDFファイル:…) / 対象年度
  const listed = new Map<string, string | null>();
  let dept: string | null = null;
  for (const m of list.matchAll(/\n(\d+)\n(?:([^\n(]+)\n)?([^\n]+)\(PDFファイル:[^)]+\)\n(令和\d+年度)(?=\n)/g)) {
    if (m[2]) dept = m[2];
    listed.set(m[3], m[4] === '令和5年度' ? dept : null);
  }
  const heading = 'ＰＤＣＡチェックシート\n実施年度\n\n令和５年度\n';
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/ＰＤＣＡチェックシート\n実施年度\n\n令和５年度\n(?:\n事務事業名\n\n([^\n]+)\n|([^\n]+)\n\n事務事業名\n)/g)) {
    const name = m[1] ?? m[2];
    if (!listed.has(name)) continue;
    const start = m.index!, raw = m[0].replace(/\n$/, '');
    const end = input.text.indexOf('■目的', start);
    const header = input.text.slice(start, end < 0 ? start + 300 : end);
    const p = project(input, name, name, null, raw, start);
    p.evaluatedFiscalYear = 2023;
    const d = listed.get(name);
    const di = d ? header.indexOf(`\n\n${d}\n\n`) : -1;
    if (d && di >= 0) { p.department = d; p.evidence.push(evidence(input, d, start + di + 2)); }
    p.warnings.push('PDCAチェックシートの見出し（実施年度・事務事業名）から収録し、事務事業名が一覧ページの掲載名と一致したもののみ対象。評価対象年度はシートの「実施年度 令和５年度」による。担当課は一覧ページの担当課名がシート見出し部にも記載されている場合のみ設定。インプット（投入金額等）は予算・決算の別が記載されず、成果指標は列の折返しで目標値と達成値の対応が確定できないため未収録。評価実施年度はシート本文に明記がなく未設定。');
    if (!p.department) p.warnings.push('担当課はシート見出し部で一覧と一致する記載を確認できなかったため未設定。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectName);
}

export const entries: Record<string, Entry> = {
  '28221': { extract: extractSasayama, scope: '令和6・7年度行政評価表の事務事業の行から、No.と事務事業名が1行に揃い直後に今後の方向性・担当課が続く行の事務事業名・担当課・今後の方向性を構造化。事業名が折り返された行、平成29年度の施策―事務事業評価表（施策評価に付属する予算・決算一覧）、平成30・令和元年度の施策評価、案内ページは対象外。' },
  '29342': { extract: extractHeguri, scope: '令和4年度実施事業の平群町政策基本体系表（個別シート）のうち、目次の事務・事業名・主務担当課と1対1で対応した各シートの事業名・担当課・評価対象年度を構造化。成果指標・コスト（年度列の対応が確定できない）、課題の記述、新型コロナ交付金実施事業の一覧は対象外。' },
  '37207': { extract: extractHigashikagawa, scope: '令和5年度実施分のPDCAチェックシート全体版から、一覧ページの掲載事業名と一致した各シートの事務事業名・担当課（シートにも記載がある場合）・実施年度を構造化。インプット金額（予算・決算の別が不明）、成果指標（目標値・達成値の対応が確定できない）、チェックシートの見方は対象外。' },
};
