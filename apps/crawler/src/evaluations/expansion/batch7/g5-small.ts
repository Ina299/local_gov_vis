import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const num = (s: string) => Number(s.replace(/[,\s]/g, '').replace('△', '-'));

/** 北広島市 令和7年度 事務事業評価（精選・重点評価対象事業）一覧。事業名・所管課の対応のみ（評価・事業費の列は段組み崩れ）。 */
const KITAHIROSHIMA_ID = '74ba661e79c459360609259f';
// [group span start, span end, rows of [name as printed, department as printed]]
const KITAHIROSHIMA_GROUPS: [string, string, [string, string][]][] = [
  ['障がい者日常生活用具給付等事業', '小中一貫教育・教育施策推進課\n（現：学校教育課）', [
    ['障がい者日常生活用具給付等事業', '福祉課'], ['医療的ケア児・者受入促進事業', '福祉課'], ['産科小児科誘致推進事業', '健康推進課'],
    ['小中一貫教育推進事業', '小中一貫教育・教育施策推進課\n（現：学校教育課）']]],
  ['6\n\n学力向上推進事業', '学校教育課\n\n4,860', [['学力向上推進事業', '学校教育課']]],
  ['7\n\nコミュニティ・スクール推進事業', '（現：社会教育課）\n\n2,360', [['コミュニティ・スクール推進事業', '小中一貫教育・教育施策推進課\n（現：社会教育課）']]],
  ['学校適正規模・適正配置検討事業\n\n夜間中学校費用負担事業\n\n教育総務課\n\n学校教育課\n（現：教育支援課）', '（現：教育支援課）', [
    ['学校適正規模・適正配置検討事業', '教育総務課'], ['夜間中学校費用負担事業', '学校教育課\n（現：教育支援課）']]],
  ['10 都市景観形成事業', '行政管理課（現：DX推進課）\n\n行政管理課（現：DX推進課）', [
    ['都市景観形成事業', '都市計画課'], ['JR新駅整備事業\n（現：交通結節点形成事業）', 'ボールパーク推進課\n（現：都市整備課）'],
    ['情報通信基盤設備管理事業', '行政管理課（現：DX推進課）']]],
  ['17 除雪ＤＸ推進事業', '19 地域運動部活動推進事業', [['除雪ＤＸ推進事業', '土木事務所']]],
];
// 事業費（R6決算額）: only where the first number follows the department on the same row.
const KITAHIROSHIMA_COST: Record<string, string> = {
  '学力向上推進事業': '6\n\n学力向上推進事業\n\n学校教育課\n\n4,860\n',
  'コミュニティ・スクール推進事業': '7\n\nコミュニティ・スクール推進事業\n\n小中一貫教育・教育施策推進課\n（現：社会教育課）\n\n2,360\n',
  '除雪ＤＸ推進事業': '17 除雪ＤＸ推進事業\n\n土木事務所\n\n9,383\n',
};
function extractKitahiroshima(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01234' || input.sourceId !== KITAHIROSHIMA_ID || input.truncated) return [];
  const text = input.text, title = '令和7年度\n対象事業';
  if (!text.startsWith(title) || !text.includes('事務事業評価（精選・重点評価対象事業）') || !text.includes('事業費\n（R6決算額）')) return [];
  const out: ProjectEvaluation[] = [];
  for (const [from, to, rows] of KITAHIROSHIMA_GROUPS) {
    const s = text.indexOf(from), e = s < 0 ? -1 : text.indexOf(to, s);
    if (s < 0 || e < 0) return [];
    const span = text.slice(s, e + to.length);
    let cursor = 0;
    for (const [name, dept] of rows) {
      const ni = span.indexOf(name, cursor); if (ni < 0) return [];
      cursor = ni + name.length;
      if (span.indexOf(dept, cursor) < 0) return [];
    }
    for (const [name, dept] of rows) {
      const flat = (x: string) => x.replace(/\n/g, '');
      const p = project(input, `${flat(dept)}:${flat(name)}`, flat(name), 2025, span, s);
      p.projectCode = null; p.department = flat(dept); p.evaluatedFiscalYear = 2024;
      p.evidence.push(evidence(input, title, 0));
      const cost = KITAHIROSHIMA_COST[name], ci = cost ? text.indexOf(cost) : -1;
      if (cost && ci >= 0) {
        const v = cost.trimEnd().split('\n').pop()!;
        p.amounts.push({ kind: 'actual', fiscalYear: 2024, amountYen: num(v) * 1000, rawValue: v, rawUnit: '千円', evidence: evidence(input, cost.trimEnd(), ci) });
      }
      p.warnings.push('令和7年度 事務事業評価（精選・重点評価対象事業）一覧の1事業。表の段組みが崩れているため、事業名と所管課は同じ表区画内の記載順で対応付け。一次・二次評価、財源内訳、事業内容、二次評価コメントは行との対応が確定できないため未収録。事業費（R6決算額、千円）は事業名・所管課の直後に続き財源内訳と整合する行のみ。名称・所管課の（現：…）は原文の注記をそのまま保持。既存の個別評価から構造化済みの7事業は除外。');
      out.push(p);
    }
  }
  return out;
}

/** 春日部市 令和５年度行政評価 外部評価結果報告書（外部評価対象2事業の行政評価シート＋審議会評価）。 */
function extractKasukabe(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11214' || !input.sourceId.startsWith('48876615') || input.truncated) return [];
  const text = input.text;
  if (!text.startsWith('令和５年度行政評価\n外部評価結果報告書') || !text.includes('令 和 ４ 年 度 の 実 績 に つ い て 行 政 評 価 を 実 施')) return [];
  const years = [2018, 2019, 2020, 2021, 2022];
  const yearHead = '平成30年度\n\n令和元年度\n\n令和2年度\n\n令和3年度\n\n令和4年度\n\n';
  const specs: { name: string; dept: string; costRe: RegExp; unit: string }[] = [
    { name: 'かすかべフードセレクション推進事業', dept: '観光振興課', costRe: /決算額\(千円\)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/, unit: '人' },
    { name: '新産業創出支援事業', dept: '商工振興課', costRe: /\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n決算額\(千円\)/, unit: '件' },
  ];
  const out: ProjectEvaluation[] = [];
  for (const [k, spec] of specs.entries()) {
    const s = text.indexOf(`事業名\n${spec.name}\n（補助金名）`);
    const e = k + 1 < specs.length ? text.indexOf(`事業名\n${specs[k + 1].name}`) : text.length;
    if (s < 0 || e < 0) return [];
    const sheet = text.slice(s, e);
    const at = (raw: string) => evidence(input, raw, s + sheet.indexOf(raw));
    const p = project(input, `${spec.dept}:${spec.name}`, spec.name, 2023, `事業名\n${spec.name}`, s);
    p.department = spec.dept; p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, '令 和 ４ 年 度 の 実 績 に つ い て 行 政 評 価 を 実 施'));
    const content = sheet.match(/事業\n内容\n\n([\s\S]+?)\n\n成果\n指標/);
    if (content) p.activities = content[1].replace(/\n/g, '');
    const yi = sheet.indexOf(yearHead), cost = sheet.match(spec.costRe);
    if (yi >= 0 && cost) {
      const raw = cost[0].replace(/^\n/, '').replace(/\n$/, '');
      years.forEach((y, i) => p.amounts.push({ kind: 'actual', fiscalYear: y, amountYen: num(cost[i + 1]) * 1000, rawValue: cost[i + 1], rawUnit: '千円', evidence: at(raw) }));
    }
    const ind = sheet.match(/成果\n指標\n\n([^\n]+)\n/);
    const tgt = sheet.match(/成果指標の目標値\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n/);
    const act = sheet.match(/成果指標の実績値\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n/);
    if (ind && tgt && act && yi >= 0) {
      const strip = (v: string) => v === '-' ? null : v.endsWith(spec.unit) ? v.slice(0, -spec.unit.length) : null;
      if ([...tgt.slice(1, 6), ...act.slice(1, 6)].every(v => v === '-' || v.endsWith(spec.unit)))
        years.forEach((y, i) => {
          const target = strip(tgt[i + 1]), actual = strip(act[i + 1]);
          if (target === null && actual === null) return;
          p.indicators.push({ name: ind[1], fiscalYear: y, target, actual, unit: spec.unit, evidence: at(sheet.slice(tgt.index!, act.index! + act[0].length).trimEnd()) });
        });
    }
    const self = sheet.match(/今後の (現状維持|拡充|見直し|縮小)/);
    const scale = '【拡充】：予算・取組増の上で継続、【現状維持】：計画通り継続、【見直し】：改善の上で継続、【縮小】：縮小・休止・廃止を検討';
    if (self) p.ratings.push({ kind: 'self', label: '今後の方向性（担当課）', value: self[1], scale: sheet.includes(scale) ? scale : null, evidence: at(self[0]) });
    const ext = sheet.match(/【外部評価結果としての今後の方向性】【(拡充|現状維持|見直し|縮小)】/);
    if (ext) p.ratings.push({ kind: 'external', label: '外部評価結果としての今後の方向性', value: ext[1], scale: sheet.includes(scale) ? scale : null, evidence: at(ext[0]) });
    p.warnings.push('外部評価結果報告書に収録された行政評価シートと審議会の評価結果。評価年度=令和5年度、対象=令和4年度実績（報告書本文に明示）。決算額・成果指標は表頭の平成30〜令和4年度の5列が揃う場合のみ年度別に収録。成果指標の実績「-」は空欄として扱い0にしない。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '01234': { extract: extractKitahiroshima, scope: '北広島市 令和7年度 事務事業評価（精選・重点評価対象事業）一覧のうち既存未収録の事業。事業名・所管課と一部の事業費（R6決算）。評価区分・財源・コメントは段組み崩れのため対象外。' },
  '11214': { extract: extractKasukabe, scope: '春日部市 令和5年度 外部評価結果報告書の対象2事業。行政評価シートの事業内容・決算額推移・成果指標、担当課と審議会の今後の方向性。報告書本文の制度説明・委員意見は対象外。' },
};
