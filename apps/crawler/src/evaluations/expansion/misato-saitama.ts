import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

export function extractMisatoSaitama(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11381' || input.sourceId !== 'de5160adc1e1a29f5a6efaff' || input.truncated) return [];
  const raw = input.text;
  if (!raw.startsWith('平成１９年度 事務事業評価表') || !raw.includes('５．外部意見聴取') || !raw.trim().endsWith('く、意義の有る事業のため継続して行っていくべきである。')) return [];
  const heading = raw.match(/コード ([^\n]+)\n主管課局 ([^\n]+)\n事務事業名 ([^\n]+)/);
  if (!heading) return [];
  const p = project(input,heading[1],heading[3],2007,raw,0);
  p.department = heading[2]; p.evaluatedFiscalYear = 2006;
  p.purpose = raw.match(/関連・類似事業\n([\s\S]*?)\n平成１８年度は/)?.[1].replace('\n内容と目的\n','').trim() ?? null;
  p.outcomes = raw.match(/平成１８年度は、([\s\S]*?)\n事業が膠着化/)?.[0].split('\n事業が膠着化')[0].replace('\n現状と結果\n','').trim() ?? null;
  const table = raw.match(/平成１６年度 平成１７年度 平成１８年度\n交流回数 ([０-９]+)回 ([０-９]+)回 ([０-９]+)回\n対 象 数\n参加人数 ([０-９]+)人 ([０-９]+)人 ([０-９]+)人/);
  if (table) {
    for (let y=0;y<3;y++) p.indicators.push({name:'【対象数】参加人数',fiscalYear:2004+y,target:null,actual:table[4+y].normalize('NFKC'),unit:'人',evidence:evidence(input,table[0],table.index)});
    // H18 is 24 in the table and 25 in the narrative; do not choose one silently.
    for (let y=0;y<2;y++) p.indicators.push({name:'【対象数】交流回数',fiscalYear:2004+y,target:null,actual:table[1+y].normalize('NFKC'),unit:'回',evidence:evidence(input,table[0],table.index)});
  }
  for (const [label,pattern] of [
    ['住民ニーズ等の変化',/■ (一部変わった) □/],['対象設定の妥当度',/■ (あまり妥当でない) □/],['成果の達成度',/■ (達成している)\n成果の/],
  ] as const) {
    const m=raw.match(pattern);if(m)p.ratings.push({kind:'self',label,value:m[1],scale:null,evidence:evidence(input,m[0],m.index)});
  }
  p.warnings.push('経費表に予算・決算の種別が明示されないため金額は原文のみ。平成18年度交流回数は本文25回と表24回で不一致のため同年の交流回数を数値化していません。対象数を成果・活動指標と推定分類せず、曖昧な評価選択位置も転記していません。');
  return [p];
}
