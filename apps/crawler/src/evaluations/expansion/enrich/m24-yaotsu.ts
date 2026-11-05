/**
 * 21505 八百津町: 電源立地地域対策交付金の事業評価個表（平成30・令和元年度、事業ごとのPDF）。目的の欄はない。
 * 公開済みレコード（事業名・対象年度）に、「交付金事業の定性的な成果及び評価等」欄を成果、「交付金事業の概要」欄を事業内容として
 * 足す。どちらも見出しの直後から次の見出し（「評価に係る第三者機関」「交付金事業に関係する主要政策」）の手前までで、
 * 他の欄の見出し・本文（左の見出し列・第三者機関の記載など）が混ざらない場合だけ採る。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { type Field, sheetRecord } from './m24-util';

const DOCS: Record<string, { name: string; year: number; head: string }> = {
  'H30hoikujo.pdf': { name: '保育所運営事業', year: 2018, head: '事業評価個表（平成30年度）' },
  'R1hoikujo.pdf': { name: '保育所運営事業', year: 2019, head: '事業評価個表（平成３１年度）' },
  'H30tanihorasen.pdf': { name: '谷・洞線 舗装補修工事', year: 2018, head: '事業評価個表（平成30年度）' },
  'R1tanihorasen.pdf': { name: '町道 谷・洞線 外１路線 舗装補修工事', year: 2019, head: '事業評価個表（令和元年度）' },
};
const LABEL = /交付金事業|主要政策|主要施|第三者|成果目標|^実績$|^目標$|^【/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const file = /\/secure\/1108\/([^/]+)$/.exec(input.sourceUrl)?.[1] ?? '', doc = DOCS[file], t = input.text;
  if (input.municipalityCode !== '21505' || !doc || input.truncated || !t.includes(doc.head)) return [];
  const nameAt = t.indexOf(doc.name);
  if (nameAt < 0) return [];
  const fields: Field[] = [];
  const o = /\n交付金事業の定性的な成果及び評価等\n((?:[^\n]+\n)*?[^\n]+)\n評価に係る第三者機関/.exec(t);
  if (o && !o[1].split('\n').some(l => LABEL.test(l.trim()))) fields.push({ key: 'outcomes', raw: o[1], at: o.index! + o[0].indexOf(o[1]) });
  const a = /\n交付金事業の概要\n\n((?:[^\n]+\n)*?[^\n]+)\n\n交付金事業に関係する主要政策/.exec(t);
  if (a && !a[1].split('\n').some(l => LABEL.test(l.trim()))) fields.push({ key: 'activities', raw: a[1], at: a.index! + a[0].indexOf(a[1]) });
  if (!fields.length) return [];
  return [sheetRecord(input, `${doc.year}:${doc.name}`, { value: doc.name, raw: doc.name, at: nameAt }, { evaluationYear: null, evaluatedFiscalYear: doc.year }, fields,
    '八百津町 電源立地地域対策交付金 事業評価個表の「交付金事業の定性的な成果及び評価等」欄（成果）と「交付金事業の概要」欄（事業内容）。'
    + '他の欄の見出し・本文が混ざらない場合のみ収録し、折り返しの改行を除いた。')];
}

export const entry = {
  extract,
  scope: '八百津町 電源立地地域対策交付金 事業評価個表（平成30・令和元年度）: 定性的な成果及び評価等（成果）・交付金事業の概要（事業内容）。目的の欄はない。',
};
