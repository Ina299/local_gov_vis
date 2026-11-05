/**
 * 13215 国立市: 令和６年度 事務事業マネジメントシート（事業ごとのPDF R6_jimuNN.pdf）。公開済みレコード（事業名・2024年度）に、
 * 「１ 現状把握の部」の「(1) 事務事業の目的」の欄（経緯・背景・課題等／事業の対象者及び対象とした理由／直接的な効果及び
 * 施策の成果向上への道筋の3項目と各項目の見出し）を目的として足す。欄は1段組みで、「(2)各指標等の推移」の見出しまで続く。
 * 「事務事業の概要」の事業内容欄は活動実績の欄と行ごとに混在するため採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m24-util';

const PURPOSE = /\n\(1\) 事務事業の目的\n(この事業を実施する経緯・背景・課題等（なぜこの事業を行うのか）\n[\s\S]*?)\n\n?\(2\)各指標等の推移\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13215' || !/\/R6_jimu\d+\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text;
  if (!/^評価実施\n\n令和\n\n6\n\n事務事業マネジメントシート\n/.test(t) || t.split('事務事業マネジメントシート').length !== 2) return [];
  const name = /\n事務事業名\n\n([^\n]+)\n/.exec(t), m = PURPOSE.exec(t);
  if (!name || !m || !m[1].includes('\n事業の対象者及び対象とした理由') || !m[1].includes('\nこの事業による直接的な効果及び施策の成果向上への道筋\n')) return [];
  const value = name[1].trim();
  return [sheetRecord(input, value, { value, raw: name[0].trim(), at: name.index! + 1 }, { evaluationYear: 2024, evaluatedFiscalYear: 2024 },
    [{ key: 'purpose', raw: m[1], at: m.index! + m[0].indexOf(m[1]) }],
    '国立市 令和６年度事務事業マネジメントシートの「(1) 事務事業の目的」欄（経緯・背景・課題等、対象者と理由、直接的な効果と施策の成果向上への道筋）。'
    + '各項目の見出しを含めて収録し、折り返しの改行を除いた。')];
}

export const entry = {
  extract,
  scope: '国立市 令和６年度 事務事業マネジメントシート（R6_jimuNN.pdf）: 「(1) 事務事業の目的」欄。事業内容欄は活動実績の欄と混在するため対象外。',
};
