/**
 * 14204 鎌倉市: 令和６年度 行政評価シート【個表】。「1 事業の目的」の「意図」（「意 …」の行の次が縦の見出しの残り「図」だけの行）を目的として収録する。
 * 意図が1行に収まる場合だけ。年度は「2 令和５年（2023年）度に実施した事業の概要」の年度（公開済みレコードの対象年度と同じ）。
 * シートの見出しの評価年度は資料により表記が揺れるため使わない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m26-util';

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14204' || !/\/keiki\/hyouka\/documents\/[a-z]+\d+r6\.pdf$/.test(input.sourceUrl) || input.truncated) return [];
  const t = input.text;
  const name = /^令和６年（\d+年）度行政評価シート【個表】\n[\s\S]*?\n評価対象事業\n[^\n]+\n\n([^\n]+)\n/.exec(t);
  const intent = /\n1 事業の目的\n対 [^\n]+\n象\n意 ([^\n]+)\n図\n/.exec(t), year = /\n2 令和\S+年（(\d{4})年）度に実施した事業の概要\n/.exec(t);
  if (!name || !intent || !year) return [];
  return [sheetRecord(input, 'intent', { value: name[1], raw: name[1], at: name[0].length - name[1].length - 1 },
    { evaluationYear: null, evaluatedFiscalYear: Number(year[1]) }, null,
    [{ key: 'purpose', pieces: [{ raw: intent[1], at: intent.index! + intent[0].indexOf('\n意 ') + 3 }], value: intent[1] }],
    '鎌倉市 令和６年度 行政評価シート【個表】の「1 事業の目的」のうち「意図」を目的として収録。')];
}

export const entry = {
  extract,
  scope: '鎌倉市 令和６年度 行政評価シート【個表】の「事業の目的」の意図（1行に収まる場合だけ）。',
};
