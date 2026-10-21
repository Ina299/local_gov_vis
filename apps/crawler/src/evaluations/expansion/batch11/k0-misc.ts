import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- 鹿部町（電源立地地域対策交付金 事業評価総括表・個表）
const SHIKABE_DENGEN = new Set(['9cecec734660d0a57110a160', 'b073a3c054e5fffad7c6da08']);
function extractShikabeDengen(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01343' || !SHIKABE_DENGEN.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/Ⅰ．事業評価総括表\n/g)].map(m => m.index!);
  starts.forEach((s, k) => {
    const block = t.slice(s, starts[k + 1] ?? t.length);
    const sheetAt = block.indexOf('Ⅱ．事業評価個表（');
    if (sheetAt < 0) return;
    const summary = block.slice(0, sheetAt), sheet = block.slice(sheetAt);
    const name = /\n交付金事業の名称\n+([^\n]+)\n+交付金事業者名又は\n/.exec(summary);
    const fy = /^Ⅱ．事業評価個表（令和(\d)年度）/.exec(sheet);
    if (!name || !fy) return;
    const n = name[1].trim();
    const repeat = sheet.indexOf(`\n交付金事業の名称\n${n}\n`);
    if (repeat < 0) return;
    const p = project(input, n, n, null, name[0].slice(1, -1), s + name.index + 1);
    p.evaluatedFiscalYear = 2018 + Number(fy[1]);
    p.evidence.push(evidence(input, fy[0], s + sheetAt), evidence(input, `交付金事業の名称\n${n}`, s + sheetAt + repeat + 1));
    // 総括表（単位：円）の総事業費。表記は「総事業費\n考\n<額>円」または「<充当額> 総事業費 <額>」の2通り。
    const total = /\n総事業費\n+考\n+([\d,]+)円\n/.exec(summary) ?? /\n[\d,]+ 総事業費 ([\d,]+)\n/.exec(summary);
    if (total && summary.includes('（単位：円）')) {
      p.amounts.push(amount(input, 'actual', p.evaluatedFiscalYear, total[1], '円', total[0].slice(1, -1), s + total.index + 1));
      p.warnings.push('金額は事業評価総括表（単位：円）の総事業費で、個表の年度（令和N年度）の実績として収録。');
    }
    p.warnings.push('電源立地地域対策交付金の事業評価個表。成果指標・活動指標・担当課室は表の列が抽出テキストで分離しているため未収録。個表の「評価年度」は成果目標の測定年度のため評価年度としては未設定。');
    out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------- 鹿部町（農山漁村振興交付金（山村活性化対策）事業実施主体 評価結果）
const SANSON = '令和３年度 農山漁村振興交付金（山村活性化対策）\n事業実施主体 評価結果';
function extractShikabeSanson(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01343' || input.sourceId !== '8869fc6fea83c9a27ce2b3b7' || !input.text.includes(SANSON)) return [];
  const rating = /\n評 価\n+([ABCＡＢＣ])\n/.exec(input.text), scale = '（注２） 「評価」の区分： Ａ・・優良 Ｂ・・良好 Ｃ・・低調';
  if (!rating || !input.text.includes(scale)) return [];
  const name = '農山漁村振興交付金（山村活性化対策）';
  const p = project(input, name, name, null, SANSON);
  p.evaluatedFiscalYear = 2021;
  p.evidence.push(evidence(input, '令和３年度に実施された農山漁村振興交付金（山村活性化対策）の事業について'));
  p.ratings.push({ kind: 'self', label: '評価（事業実施主体 評価結果）', value: rating[1], scale: '「評価」の区分： Ａ・・優良 Ｂ・・良好 Ｃ・・低調', evidence: evidence(input, rating[0].slice(1, -1), rating.index + 1) });
  p.warnings.push('事業実施主体（鹿部町）による事業評価結果（交付対象年度R1・R2、目標年度R3）。評価対象年度は「令和３年度に実施された…事業について」による。金額・指標は本資料に記載がない。');
  return [p];
}

// ---------------------------------------------------------------- 井原市（デジタル田園都市国家構想交付金事業 効果検証＜令和６年度＞）
type KpiSpec = { name: string; unit: string };
const IBARA: { name: string; groups: RegExp; targetAt: number; actualAt: number; kpis: KpiSpec[]; cost?: string }[] = [
  { name: '未来を担うひとづくり推進事業', groups: /(?:\(目標\) ?-?[\d.,]+\n+){5}(?:\(実績\) ?-?[\d.,]+\n+){3}/g, targetAt: 2, actualAt: 2,
    kpis: [{ name: '社会増減数（転入－転出）', unit: '人' }, { name: '井原市や住んでいる地域のことが好きな生徒児童の割合（生徒児童の郷土愛）', unit: '％' },
      { name: '日々の生活に幸せを感じている生徒児童の割合（生徒児童の幸福度）', unit: '％' },
      { name: 'いばら就職支援事業（合同企業説明会）における市内３高校の在籍生徒数に対する参加申込生徒数の割合（市内事業所への関心度）', unit: '％' }],
    cost: '１４，１８７，７００円（うち、交付対象事業費 14,187,700 円）' },
  { name: '広域連携拠点施設（熱利用施設）整備事業', groups: /(?:\(目標\) [\d,]+\n+){5}\(実績\) [\d,]+\n/g, targetAt: 0, actualAt: 0,
    kpis: [{ name: '3 市 2 町の UIJ ターン者数', unit: '人' }, { name: '3 市 2 町における健活宣言企業数', unit: '社' },
      { name: '圏域内観光拠点（笠岡市及び矢掛町の道の駅）の入込客数', unit: '千人' }, { name: '本施設の年間利用者数', unit: '百人' }] },
];
function extractIbara(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '33207' || input.sourceId !== 'f508dd176df202e61322ae69') return [];
  const t = input.text, title = 'デジタル田園都市国家構想交付金事業\n効果検証\n＜令和６年度＞';
  if (!t.startsWith(title)) return [];
  const out: ProjectEvaluation[] = [];
  for (const spec of IBARA) {
    const head = `（１）事業の名称\n${spec.name}\n`, at = t.indexOf(head);
    if (at < 0 || t.indexOf(head, at + 1) >= 0) continue;
    const end = t.indexOf('（１）事業の名称\n', at + 1), part = t.slice(at, end < 0 ? t.length : end);
    const p = project(input, spec.name, spec.name, null, head.slice(0, -1), at);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title, 0));
    const evalHead = part.indexOf('（６）実績値（令和６年度）の評価');
    if (evalHead >= 0) p.evidence.push(evidence(input, '（６）実績値（令和６年度）の評価', at + evalHead));
    if (spec.cost) {
      const c = part.indexOf(`（２）事 業 費（国補助率１／２）\n${spec.cost}`);
      if (c >= 0) {
        const raw = `（２）事 業 費（国補助率１／２）\n${spec.cost}`;
        p.amounts.push(amount(input, 'actual', 2024, '１４，１８７，７００', '円', raw, at + c));
        p.warnings.push('金額は令和６年度効果検証の「（２）事業費」で、事業実績欄の委託料（12,200,000円＋1,987,700円）の合計と一致するため令和６年度の実績として収録。');
      }
    } else p.warnings.push('事業費は３市２町の広域整備の総額で年度の帰属が本文で確定しないため未収録。');
    const kpiAt = part.indexOf('（５）重要業績評価指標（ＫＰＩ）');
    const groups = kpiAt < 0 ? [] : [...part.slice(kpiAt).matchAll(spec.groups)];
    if (groups.length === spec.kpis.length) {
      groups.forEach((g, i) => {
        const targets = [...g[0].matchAll(/\(目標\) ?(-?[\d.,]+)/g)].map(m => m[1]), actuals = [...g[0].matchAll(/\(実績\) ?(-?[\d.,]+)/g)].map(m => m[1]);
        const raw = g[0].replace(/\n+$/, '');
        p.indicators.push({ name: spec.kpis[i].name, fiscalYear: 2024, target: targets[spec.targetAt], actual: actuals[spec.actualAt], unit: spec.kpis[i].unit,
          evidence: evidence(input, raw, at + kpiAt + g.index!) });
      });
      p.warnings.push('KPIは表の行ごとに（目標）（実績）の値が並ぶ順で指標名と対応づけ、令和６年度の目標・実績のみ収録（年度列の並び：事業開始前の次が1年目）。対応は本文「（６）実績値（令和６年度）の評価」の達成・未達の記述と整合することを確認。');
    } else p.warnings.push('KPI表の値の並びが確定できないため指標は未収録。');
    p.warnings.push('デジタル田園都市国家構想交付金事業の効果検証（令和６年度）。評価年度は本文に明記がないため未設定。');
    out.push(p);
  }
  return out;
}

export const miscEntries: Record<string, Entry> = {
  '01343': {
    extract: input => [...extractShikabeDengen(input), ...extractShikabeSanson(input)],
    scope: '電源立地地域対策交付金の事業評価総括表・個表（令和2・3年度）から交付金事業名・対象年度・総事業費（円）を、農山漁村振興交付金（山村活性化対策）の事業実施主体評価結果から評価区分を構造化。成果・活動指標は列崩れのため対象外。案内ページは対象外。',
  },
  '33207': {
    extract: input => extractIbara(input),
    scope: 'デジタル田園都市国家構想交付金事業の効果検証（令和６年度）の2事業について、事業名・令和６年度KPIの目標と実績・事業費（実績が確定するもののみ）を構造化。行政改革プランの取組実績と案内ページは対象外。',
  },
};
