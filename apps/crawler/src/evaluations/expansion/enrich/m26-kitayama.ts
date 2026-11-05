/**
 * 30427 北山村: 電源立地地域対策交付金（水力発電施設周辺地域交付金相当部分）事業評価個表（令和５年度）。目的の欄はなく、
 * 「交付金事業の概要」を事業内容、「交付金事業の定性的な成果及び評価」を成果として収録する。
 * 概要は見出しの次の段落のうち、次の欄（主要政策・施策、「「」で始まる行）の前まで。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { joinWrapped, sheetRecord, type Field } from './m26-util';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '30427' || !/\/disclosure\/files\/R5suihatsu-hyouka\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text, a = t.indexOf('\nⅡ．事業評価個表\n');
  const name = /\n交付金事業の名称\n\n[^\n]+\n([^\n]+事業)\n/.exec(t.slice(a));
  const sum = /\n交付金事業の概要\n\n((?:[^\n「]+\n)+?)「/.exec(t), res = /\n交付金事業の定性的な成果及び評価\n((?:[^\n]+\n)+?)\n/.exec(t);
  const year = /\n事業開始年度\n\n令和５年度 事業終了年度\n\n令和５年度\n/.test(t);
  if (a < 0 || !name || !year || (!sum && !res)) return [];
  const fields: Field[] = [];
  if (sum) { const raw = sum[1].slice(0, -1); fields.push({ key: 'activities', pieces: [{ raw, at: sum.index! + '\n交付金事業の概要\n\n'.length }], value: joinWrapped(raw.split('\n')) }); }
  if (res) { const raw = res[1].slice(0, -1); fields.push({ key: 'outcomes', pieces: [{ raw, at: res.index! + '\n交付金事業の定性的な成果及び評価\n'.length }], value: joinWrapped(raw.split('\n')) }); }
  return [sheetRecord(input, 'kotai', { value: name[1], raw: name[1], at: a + name.index! + name[0].indexOf(name[1]) },
    { evaluationYear: null, evaluatedFiscalYear: 2023 }, null, fields,
    '北山村 交付金事業評価個表（令和５年度）の「交付金事業の概要」を事業内容、「定性的な成果及び評価」を成果として収録（PDFの折り返しの改行を除いた）。目的の欄はない。')];
}

export const entry = {
  extract,
  scope: '北山村 令和５年度 交付金事業評価個表の「交付金事業の概要」と「定性的な成果及び評価」。目的の欄はない。',
};
