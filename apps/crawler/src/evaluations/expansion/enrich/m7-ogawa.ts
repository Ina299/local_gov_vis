/**
 * 11343 小川町: 第５次総合振興計画 事務事業評価シート（様式１、令和3・4・5・7年度。1資料1事業）。公開済みレコード（公表ページの
 * 課別一覧・令和7年度の評価シート）の空欄に、「目的（何のために行うか）」「手段（内容）」「その他指標に現れない成果」を補う。
 * 目的と手段は左右2列の欄で、抽出テキストでは2列が同じ行に混ざることが多い。手段の見出しから対象の見出しまでが
 * ちょうど2段落（ページ番号の行を除く）で、どの行にも列の継ぎ目（全角文字の間の半角空白）がなく、1段落目が目的の欄の幅に
 * 収まる場合だけ、1段落目を目的、2段落目を手段とする。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';
import { unwrap } from './m1-util';

const FORM = '第５次総合振興計画事務事業評価シート（様式１）';
/** 目的の欄の1行は全角26字前後（手段の欄は30字余り）。 */
const PURPOSE_WIDTH = 28;
/** 2列が1行に混ざった継ぎ目（半角英数・記号以外の文字に挟まれた半角空白）。 */
const SEAM = /[^\x00-\x7f] +[^\x00-\x7f]/;
const width = (l: string) => [...l].reduce((n, c) => n + (/[\x00-\x7f｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

interface Para { raw: string; at: number }
function paragraphs(text: string, from: number, to: number): Para[] {
  const out: Para[] = [];
  for (const m of text.slice(from, to).matchAll(/[^\n]+(?:\n[^\n]+)*/g)) out.push({ raw: m[0], at: from + m.index! });
  return out;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11343' || input.format !== 'pdf' || !input.text.includes(FORM)) return [];
  const text = input.text;
  const years = [...text.matchAll(/(?:^|\n)令和\n\n([3457])\n\n/g)];
  if (years.length !== 1) return [];
  const n = Number(years[0][1]);
  // 提出日（R5.6.23 など）が様式見出しの年度と一致すること。
  const filed = [...text.matchAll(/\nR(\d)\.\d{1,2}\.\d{1,2}\n/g)];
  if (filed.length > 1 || (filed.length === 1 && Number(filed[0][1]) !== n)) return [];
  // 事業名は指標の検証の見出しの次の行（n1-ogawa と同じ。括弧の注記だけが違う場合は予算事業名）。
  const heading = /４ 指標の検証(?:（活動指標・成果指標）)?\n\n?([^\n]+)\n\n?指標名\n/.exec(text), budgetName = /\n④予算事業名 ([^\n]+)\n/.exec(text);
  const name = heading && budgetName && heading[1].startsWith(budgetName[1]) && /^[（(][^（()）]*[）)]$/.test(heading[1].slice(budgetName[1].length))
    ? budgetName : heading ?? budgetName;
  if (!name) return [];
  const nameAt = name.index! + name[0].lastIndexOf(name[1]);

  // 令和7年度の様式は「（２）内容」「(３)対象」、令和3〜5年度は「（3）手段（内容…）」「(2)対象」。
  const means = n === 7 ? /\n（２）内容（どのような取り組みか）\n/.exec(text) : /\n（3）手段（内容・どのような取り組みか）\n/.exec(text);
  const purposeHead = n === 7 ? /\n\(１）目的（何のために行うか）\n/.exec(text) : /\n\(1）目的（何のために行うか）\n/.exec(text);
  if (!means || !purposeHead || purposeHead.index! > means.index!) return [];
  const from = means.index! + means[0].length;
  const target = (n === 7 ? /\n\(３\)対象（誰に対して/ : /\n\(2\)対象（誰に対して/).exec(text.slice(from));
  if (!target) return [];
  const paras = paragraphs(text, from, from + target.index!).filter(p => !/^\d{1,2}$/.test(p.raw));
  const year = 2018 + n;
  const p = project(input, `narrative:${input.sourceId}`, name[1].trim(), year, text.slice(years[0].index!, years[0].index! + years[0][0].length).trim(),
    years[0].index! + (years[0][0].startsWith('\n') ? 1 : 0));
  if (n === 7) {
    // 令和7年度の様式は事業費の表に「実施年度（R６年度）決算」とある（隣の列と同じ行に混ざるため年度の数字まで）。
    if (!/実施年度（R６/.test(text)) return [];
    p.evaluatedFiscalYear = 2024;
  }
  p.evidence.push(evidence(input, FORM), evidence(input, name[1], nameAt));
  const notes: string[] = [];
  if (paras.length === 2 && !paras.some(q => SEAM.test(q.raw) || /目的|手段|対象|成果イメージ/.test(q.raw))
    && Math.max(...paras[0].raw.split('\n').map(width)) <= PURPOSE_WIDTH) {
    p.purpose = unwrap(paras[0].raw); p.activities = unwrap(paras[1].raw);
    p.evidence.push(evidence(input, purposeHead[0].trim(), purposeHead.index! + 1), evidence(input, means[0].trim(), means.index! + 1),
      evidence(input, paras[0].raw, paras[0].at), evidence(input, paras[1].raw, paras[1].at));
    notes.push('「目的（何のために行うか）」「手段（内容）」は左右2列の欄。手段の見出しから対象の見出しまでがちょうど2段落で、2列が同じ行に混ざっていない場合だけ、1段落目を目的、2段落目を手段とした。');
  }
  // その他指標に現れない成果: 見出しの次の行から「５ 事業評価」の手前まで（空行・数値だけの行を含まないもの）。
  const oh = /\n（3）その他指標に現れない成果\n/.exec(text);
  if (oh) {
    const at = oh.index! + oh[0].length, end = text.indexOf('\n５ 事業評価\n', at);
    const raw = end < 0 ? '' : text.slice(at, end).replace(/\n+$/, '');
    if (raw.trim() && !raw.includes('\n\n') && !raw.split('\n').some(l => /^[\d,.％%\s]+$/.test(l) || /指標|目標値|実績値|達成率/.test(l))) {
      p.outcomes = unwrap(raw);
      p.evidence.push(evidence(input, oh[0].trim(), oh.index! + 1), evidence(input, raw, at));
      notes.push('「その他指標に現れない成果」欄を成果として収録。');
    }
  }
  if (!notes.length) return [];
  p.warnings.push(`小川町 事務事業評価シート（令和${n}年度）の文章欄を収録。${notes.join('')}PDFの折り返しの改行を除いた。`);
  return [p];
}

export const entry = {
  extract,
  scope: '小川町 第５次総合振興計画 事務事業評価シート（様式１、令和3・4・5・7年度）の「目的」「手段（内容）」（2列が混ざらず2段落に分かれているもの）と「その他指標に現れない成果」。',
};
