import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 伊平屋村（令和４年度（繰越）沖縄離島活性化推進事業費補助金検証シート）
// 公開済みレコードは同じ検証シート（事業ごとに1ファイル、対象年度＝令和４年度）の事業。
// 「事業内容」欄（見出しの直前、事業実施年度の行の後の段落）を事業内容、成果目標の「進捗状況説明」欄を成果として取る。
// 進捗状況説明は見出しの直後が文章で始まる版だけ（目標値の見出し・年度の断片が混ざる版は取らない）。目的の欄は様式にない。
const HEAD = /^市町村名\n\n伊平屋村\n\n令和[４4]年度（(?:事故)?繰越）沖縄離島活性化推進事業費補助金検証シート\n事業名\n\n([^\n]+)\n\n担当部課名\n/;
const ACTIVITIES = /\n令和[^\n]*年度\n\n((?:[^\n]+\n){1,6}?)事業内容\n/;
const PROGRESS = /\n進\n捗\n状\n況\n説\n明\n\n((?:[^\n]+\n)+?)\n/;

const join = (raw: string) => raw.split('\n').map(l => l.trim()).filter(Boolean)
  .reduce((acc, l, i, a) => i === 0 ? l : acc + (/。$/.test(a[i - 1]) || /^[○〇]/.test(l) ? '\n' : '') + l, '');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '47359' || input.format !== 'pdf' || !/\/3639_651\d_misc\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, h = HEAD.exec(t);
  if (!h) return [];
  const p = project(input, `narrative:${h[1]}`, h[1].trim(), null, h[0].slice(0, -1), 0);
  p.projectCode = null; p.evaluatedFiscalYear = 2022;
  const a = ACTIVITIES.exec(t);
  if (a && t.split('\n事業内容\n').length === 2 && /。$/.test(a[1].trim())) {
    p.activities = join(a[1]);
    p.evidence.push(evidence(input, a[1].trimEnd(), a.index + a[0].indexOf(a[1], 1)));
  }
  const o = PROGRESS.exec(t);
  if (o && t.split('\n進\n捗\n状\n況\n説\n明\n').length === 2 && o[1].split('\n')[0].length >= 20 && /。$/.test(o[1].trim())) {
    p.outcomes = join(o[1]);
    p.evidence.push(evidence(input, o[1].trimEnd(), o.index + o[0].indexOf(o[1], 1)));
  }
  if (!p.activities && !p.outcomes) return [];
  p.warnings.push('伊平屋村 沖縄離島活性化推進事業費補助金検証シートの「事業内容」欄を事業内容、成果目標の「進捗状況説明」欄を成果として収録（折り返しの改行は除いた）。');
  return [p];
}

export const entry = {
  extract,
  scope: '伊平屋村 令和４年度 沖縄離島活性化推進事業費補助金検証シート（3639_651x_misc.pdf）: 「事業内容」欄・成果目標の「進捗状況説明」欄。',
};
