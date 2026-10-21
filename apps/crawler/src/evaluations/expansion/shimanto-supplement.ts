import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** R6 internal evaluations; earlier extraction remains frozen for reproducibility. */
export function extractShimantoSupplement(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '39412' || input.sourceId !== '755fe25e7a7428c39d715bcb' || input.format !== 'pdf') return [];
  const heads = [...input.text.matchAll(/^R6行政評価シート（事後評価用）\n/gm)];
  const records: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!;
    const segment = input.text.slice(start, heads[i + 1]?.index ?? input.text.length);
    const end = /^- 事業番号 (\d+) -$/m.exec(segment);
    const title = /^事業名 (.+)\n担当課 (.+?) 担当係(?: |\n)/m.exec(segment);
    if (!end || !title || !segment.includes('令和５年度の実績に対する評価です。')) continue;
    const raw = segment.slice(0, end.index + end[0].length);
    if (seen.has(end[1])) throw new Error(`Duplicate Shimanto R6 sheet ${end[1]}`);
    seen.add(end[1]);
    const p = project(input, end[1], title[1], 2024, raw, start);
    p.department = title[2]; p.evaluatedFiscalYear = 2023;
    const table = /（単位：千円）\n事 業 費 等 内 訳 事業費\n国 県 地方債 基金 その他 一般財源\n【計画額】[^\n]*\n【実績額】((?: [\d,]+){2,7})\n/.exec(raw);
    if (table) {
      const values = table[1].trim().split(' ').map(x => Number(x.replaceAll(',', '')));
      if (values[0] === values.slice(1).reduce((a, b) => a + b, 0) && !['22', '32'].includes(end[1])) {
        p.amounts.push({kind: 'actual', fiscalYear: 2023, amountYen: values[0] * 1000, rawValue: table[1].trim().split(' ')[0], rawUnit: '千円', evidence: evidence(input, table[0], start + table.index)});
      }
    }
    if (['22', '32'].includes(end[1])) p.warnings.push('事業番号22と32は別の事業内容だが計画額27,484千円・実績額1,041千円と財源配列が一致。共通費用または転記の疑義を解消できないため、両票の金額は原文根拠だけ保持し数値化しない。');
    const outcome = /^成果[^\n]*\n[\s\S]*?(?=\n３ 評価結果)/m.exec(raw);
    if (outcome) {p.outcomes = outcome[0]; p.evidence.push(evidence(input, outcome[0], start + outcome.index));}
    const rating = /^評 価 結 果 ([Ａ-Ｄ]) (現状のまま継続|改善して継続|休廃止|完了) 休廃止の時期[^\n]*/m.exec(raw);
    if (rating) p.ratings.push({kind: 'self',label: '評価結果・今後の方向性',value: `${rating[1]} ${rating[2]}`,scale: 'Ａ 現状のまま継続／Ｂ 改善して継続／Ｃ 休廃止／Ｄ 完了',evidence: evidence(input,rating[0],start+rating.index)});
    p.warnings.push('令和6年度評価・令和5年度実績を各票末尾と冒頭で確認。計画額は予算と同一視しない。実績の空欄、財源合計不一致、符号付き配列は費用を補完しない。目的・実施内容の中央配置ラベルやKPI複数年度列は全票原文で保持。');
    records.push(p);
  }
  return records;
}

/** Complete result rows beyond the cut-off R4 individual-sheet cache. */
export function extractShimantoSummarySupplement(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '39412' || input.sourceId !== 'fec18b909939dd775cf2d8de') return [];
  const year = '業を評価対象とし、令和３年度の実績に基づき評価を行いました。';
  if (!input.text.includes('令和４年度行政評価について') || !input.text.includes(year)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/^(５[７８９]) (?:\(9\) )?(人材育成推進事業「[^」]+」) 人材 ([A-E]) (改善して継続|現状のまま継続)$/gm)) {
    const p = project(input, `name:${m[2]}`, m[2], 2022, m[0], m.index!);
    p.evaluatedFiscalYear = 2021; p.department = '人材';
    p.ratings.push({kind: 'self', label: '評価・今後の方向性', value: `${m[3]} ${m[4]}`, scale: null, evidence: evidence(input, m[0], m.index!)});
    const y = input.text.slice(0, input.text.indexOf(year) + year.length);
    p.evidence.push(evidence(input, y, 0));
    p.warnings.push('事後評価結果一覧の個別結果行から追加。令和4年度個票キャッシュは57番途中で切詰められているため、57〜59番の完全な結果行のみ補完。担当課略称は原文のまま保持。費用・指標はこの資料から推測しない。');
    out.push(p);
  }
  return out;
}
