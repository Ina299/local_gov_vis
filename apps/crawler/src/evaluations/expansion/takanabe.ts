import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

const SOURCE = '0e5d011993cf2854e9c348b1';
const HEADER = /^評価表 高鍋町総合計画施策別実施計画及び事務事業評価表/gm;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const number = '[0-9][0-9,.]*';

export function extractTakanabe(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '45401' || input.sourceId !== SOURCE) return [];
  const starts = [...input.text.matchAll(HEADER)];
  const records: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i].index!;
    // Supplemental subsidy tables are not independent evaluation sheets.
    const raw = input.text.slice(start, starts[i + 1]?.index ?? input.text.length).split('附表 高鍋町')[0];
    const name = raw.match(/^事務事業名 (.+)$/m)?.[1];
    const code = raw.match(/事務事業番号 (\d+) 記入対象年度 26/)?.[1];
    if (!name || !raw.includes('判定結果') || !raw.includes('◎事務事業評価')) continue;
    const record = project(input, code ?? `name:${name}`, name, null, raw, start);
    if (!code) { record.projectCode = null; record.warnings.push('原典事務事業番号が空欄のため名称から安定IDを生成。'); }
    record.department = raw.match(/^担当課\(局\)･係 (.+?) 記入者/m)?.[1] ?? null;
    record.warnings.push('記入対象年度26の記載はあるが、評価実施年度の明示は確認できないため評価年度は不明。');
    const table = raw.match(/予算区分 平成25年度決算 平成26年度決算[\s\S]*?^合計 ([0-9,]+) 円 ([0-9,]+) 円/m);
    if (table) {
      record.evaluatedFiscalYear = 2014;
      record.amounts.push({ kind: 'actual', fiscalYear: 2014, amountYen: Number(table[2].replaceAll(',', '')),
        rawValue: table[2], rawUnit: '円', evidence: evidence(input, table[0], start + table.index!) });
      record.warnings.push('平成25年度欄は費目の欠測記号と合計0が併記されるため前年度0円を実績として採用していません。決算合計は事業全体の金額で、附表の補助額を重複加算していません。');
    }
    const activity = raw.match(/^事業の内容 ([\s\S]*?)\n補助事業の有無/m);
    if (activity) record.activities = activity[1].trim();
    const setting = raw.match(/この事務事業の成果を数値化したもの……成果指標 単位 この事務事業の業務量を数値化したもの……活動指標 単位\n([\s\S]*?)◎目標達成状況/);
    const achievement = raw.match(/◎目標達成状況[\s\S]*?◎事務事業評価/)?.[0] ?? '';
    if (setting) for (const line of setting[1].trim().split('\n')) {
      // Only paired rows retain explicit left/right ownership after text extraction.
      const pair = line.match(/^(\S+) (\S+) (\S+) (\S+)$/);
      if (!pair) continue;
      for (const [label, indicatorName, unit] of [['成果指標', pair[1], pair[2]], ['活動指標', pair[3], pair[4]]]) {
        let target: string | null = null;
        let actual: string | null = null;
        const prefix = `${escape(indicatorName)} ${escape(unit)}`;
        if (label === '成果指標') {
          const row = achievement.match(new RegExp(`目標値 (${number}) (${number}) (${number})\\n${prefix} 実績値 (${number}) (${number}) (${number})(?=\\n| )`));
          if (row) { target = row[3]; actual = row[6]; }
        } else {
          const row = achievement.match(new RegExp(`${prefix} 計画値 (${number}) (${number}) (${number})\\n(?:[活動指標] )?実績値 (${number}) (${number}) (${number})(?=\\n| )`));
          if (row) { target = row[3]; actual = row[6]; }
        }
        record.indicators.push({ name: `【${label}】${indicatorName}`, unit,
          fiscalYear: 2014, target, actual, evidence: evidence(input, setting[0] + achievement.slice('◎目標達成状況'.length), start + setting.index!) });
      }
    }
    const applicability = raw.match(/事務事業評価適合性\n(?:内\n)?(適合|不適合)/);
    if (applicability) record.ratings.push({ kind: 'self', label: '事務事業評価適合性', value: applicability[1], scale: null,
      evidence: evidence(input, applicability[0], start + applicability.index!) });
    record.warnings.push('指標設定の左右両列が明確な行だけ活動・成果を区別。単独列・折返し行や年度空欄の位置を推測していません。');
    records.push(record);
  }
  return records;
}
