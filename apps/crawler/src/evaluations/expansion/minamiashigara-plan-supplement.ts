import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

const reviewedUnits: Record<string, [string, string]> = {
  '発達支援相談窓口の設置': ['発達支援相談については、臨床心理士による相談を行い、', '\n14\n課題'],
  '市民音楽祭': ['市制施行 50 周年記念事業として、令和４年８月に文化会館で市民音楽', '市制施行 50 周年記念事業として、令和５年１月に'],
  '体育センターグラウンドの芝生化': ['体育センターグラウンドを JFA 仕様の人工芝に整備した。', '\n関係指標 基準値'],
  '体育センター第１体育室の床と温水プールの改修': ['体育センターが安全、快適で利用しやすい施設であるために、', '\n32\n課題'],
  '南足柄みらい創りカレッジの人材育成プログラム': ['様々な人材が交流する中で課題や解決方法を話し合い人材育成につな', '\nイ 南足柄 （２）－①－ウと同じ'],
  'ボランティア体験プログラム': ['小学生等を対象に、長期休業期間中の安全な活動場所の確保や様々な学', '青少年の社会参加活動を活発にするため、'],
  'ジュニアリーダーの育成': ['青少年の社会参加活動を活発にするため、', '\n関係指標 基準値'],
  '都市計画道路 千津島・苅野線の整備': ['東名高速道路大井松田 IC から工場・観光拠点へのアクセス向上を図る', '\n関係指標 基準値'],
  'COOL CHOICE の普及啓発': ['道の駅「足柄・金太郎のふるさと」での普及啓発イベントの開催や市主', '\n道の駅「足柄・金太郎のふるさと」での普及啓発イベントの開催や市主'],
  'マイエコ 10 宣言の普及啓発': ['道の駅「足柄・金太郎のふるさと」での普及啓発イベントの開催や市主', '市庁舎の空調設備の更新や文化会館の舞台照明設備の更新など、23 の'],
};

/** Individually scored implementation items, not the 28 broad policy evaluations. */
export function extractMinamiashigaraPlanSupplement(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14217' || input.sourceId !== '35bb75b0750a7331ec57c1e7' || input.format !== 'pdf' || input.truncated) return [];
  const start = input.text.indexOf('Ⅱ 評価結果\n１ 重点プロジェクトの評価結果一覧');
  const end = input.text.indexOf('２ 策定項目の評価結果一覧\n', start);
  if (start < 0 || end < 0) return [];
  const scope = '重点プロジェクトについては、13 の施策における 45 の取組項目ごとに、計画期間中（令和\n２年度から令和５年度まで）の取組内容や成果、課題、関係する指標の達成状況を確認し、こ\nれらの状況等を踏まえて総合的な評価を行います。';
  if (!input.text.includes(scope)) return [];
  return [...input.text.slice(start, end).matchAll(/(?:^| )([アイウエオ]) (.+) ([◎〇△×])$/gm)].flatMap((m, i) => {
    const name = m[2].replace(/ ・/g, '・');
    const anchors = reviewedUnits[name];
    if (!anchors) return [];
    const detailStart = input.text.indexOf('Ⅲ 分野別の評価\n');
    let a = input.text.indexOf(anchors[0], detailStart);
    if (name === 'マイエコ 10 宣言の普及啓発') a = input.text.indexOf(anchors[0], a + anchors[0].length);
    const b = input.text.indexOf(anchors[1], a + anchors[0].length);
    if (a < detailStart || b < a) throw new Error(`Reviewed independent unit changed: ${name}`);
    const p = project(input, `plan-2020-2023-item-${i + 1}`, m[2].replace(/ ・/g, '・'), null, m[0], start + m.index!);
    p.evidence.push(evidence(input, scope));
    p.evidence.push(evidence(input, input.text.slice(a, b), a));
    p.ratings.push({ kind: 'self', label: '令和2～5年度計画期間の取組項目総合評価', value: m[3], scale: '◎ 成果あり / 〇 やや成果あり / △ あまり成果なし / × 成果なし', evidence: evidence(input, m[0], start + m.index!) });
    p.warnings.push('重点プロジェクトの取組項目から具体的な相談業務・施設改修・開催事業等の実施内容を確認できた単位のみ部分構造化。上位施策・総括的な連携推進・他取組への包含項目は採用しない。令和2～5年度の4年間総括であり、単年度実績へ変換しない。令和6年9月は報告書日付で評価実施年度は未確定。折返し名称・上位施策28項目・費用・指標数値は抽出していない。');
    return [p];
  });
}
