import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** Keeps one record per name; repeated sheets merge only when every structured value agrees. */
function dedupe(records: ProjectEvaluation[]): ProjectEvaluation[] {
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  const values = (p: ProjectEvaluation) => JSON.stringify([p.department, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value])]);
  for (const p of records) {
    const key = p.projectName, old = out.get(key);
    if (!old) { out.set(key, p); continue; }
    if (values(old) !== values(p)) { conflicts.add(key); continue; }
    old.evidence.push(...p.evidence);
  }
  return [...out].filter(([key]) => !conflicts.has(key)).map(([, p]) => p);
}

// 鹿沼市 事業評価調書. The sheets carry no explicit evaluation year, so only one of the two
// same-template documents is structured (two null-year copies would be indistinguishable).
const KANUMA_SOURCE = '0a2553628020041704435c71';
const KANUMA_START = '事業評価調書\n<Plan> 事業の計画\n';
const KANUMA_SCALE = 'A：計画どおりに事業を進めることが適当である／B：事業の進め方を改善・検討する必要がある／C：事業規模・内容又は実施主体の見直しを検討する必要がある／D：事業の抜本的見直し又は休・廃止を検討する必要がある';
function extractKanuma(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09205' || input.sourceId !== KANUMA_SOURCE) return [];
  const starts = [...input.text.matchAll(new RegExp(KANUMA_START, 'g'))].map(m => m.index!);
  const records: ProjectEvaluation[] = [];
  // The last sheet is cut by the 120,000-character text limit; only sheets followed by another start are complete.
  for (let i = 0; i + 1 < starts.length; i++) {
    const start = starts[i], sheet = input.text.slice(start, starts[i + 1]);
    const name = sheet.slice(KANUMA_START.length).split('\n')[0].trim();
    const plan = sheet.indexOf('<Do> 事業の実施状況'), check = sheet.indexOf('<Check> 評価・分析');
    const scale = sheet.indexOf('A：計画どおりに事業を進めることが適当である');
    const rating = [...sheet.matchAll(/改善の\n方向性\n\n([A-D])\n/g)];
    if (!name || plan < 0 || check < plan || scale < 0 || rating.length !== 1 || !sheet.includes('今後の\n取組方針')) continue;
    const head = KANUMA_START + name;
    const p = project(input, name, name, null, head, start);
    p.projectCode = null;
    const planText = sheet.slice(0, plan);
    const bu = [...planText.matchAll(/^(\S+) 部$/gm)], ka = [...planText.matchAll(/^(\S+) 課$/gm)];
    if (bu.length === 1 && ka.length === 1) {
      p.department = `${bu[0][1]}部${ka[0][1]}課`;
      p.evidence.push(evidence(input, bu[0][0], start + bu[0].index!), evidence(input, ka[0][0], start + ka[0].index!));
    } else p.warnings.push('所管の部・課の記載が「○○ 部」「○○ 課」の形で一つずつ読み取れないため、担当課は未設定。');
    const r = rating[0], rStart = start + r.index!;
    p.ratings.push({ kind: 'self', label: '改善・見直し 改善の方向性', value: r[1], scale: KANUMA_SCALE, evidence: evidence(input, r[0], rStart) });
    p.warnings.push('評価年度・評価対象年度は調書本文に明記がないため未設定。事業費・人件費・指標は年度列（R4〜R8）と値の対応が抽出テキストから確定できないため構造化していない。自己評価の各項目点・合計点も段組みが崩れているため未構造化。');
    records.push(p);
  }
  return dedupe(records);
}

// 北茨城市 令和3年度事務事業評価書（対象：令和2年度実施計画事業）.
const KITA_SOURCE = '5a6f258832f81bb9459ab547';
const KITA_START = '（様式３）\n\n令和3年度事務事業評価書\n（対象：令和2年度実施計画事業）\n';
function extractKitaibaraki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08215' || input.sourceId !== KITA_SOURCE) return [];
  const starts = [...input.text.matchAll(new RegExp(KITA_START, 'g'))].map(m => m.index!);
  const records: ProjectEvaluation[] = [];
  for (let i = 0; i + 1 < starts.length; i++) {
    const start = starts[i], sheet = input.text.slice(start, starts[i + 1]);
    // Some sheets print the name above its label (「名称\n事務事業名\n１新 規」); the 個別施策 line anchors that position.
    let names = [...sheet.matchAll(/事務事業名\n(.+)\n/g)];
    if (names.length === 1 && names[0][1].startsWith('１新')) names = [...sheet.matchAll(/^個別施策（項） .+\n(.+)\n事務事業名\n１新 規\n/gm)];
    if (names.length === 1 && /^[１２]新|^２継/.test(names[0][1])) continue;
    const depts = [...sheet.matchAll(/^担当課 (.+)$/gm)];
    const items = [...sheet.matchAll(/^([①-⑤]) (\S+?)：.+\n評価 (\S) (.+)$/gm)];
    if (names.length !== 1 || depts.length !== 1 || items.length !== 5 || !sheet.includes('二次評価（企画政策課記入欄）')) continue;
    const name = names[0][1].trim();
    const p = project(input, name, name, 2021, names[0][0], start + names[0].index!);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2020;
    p.department = depts[0][1].trim();
    p.evidence.push(evidence(input, KITA_START.trimEnd(), start), evidence(input, depts[0][0], start + depts[0].index!));
    for (const m of items) p.ratings.push({ kind: 'self', label: `${m[1]} ${m[2]}`, value: `${m[3]} ${m[4]}`, scale: null, evidence: evidence(input, m[0], start + m.index!) });
    const amount = [...sheet.matchAll(/R2事業費\n([\d,]+)\n実\n施\n状\n況/g)];
    if (amount.length === 1 && [...sheet.matchAll(/^千円$/gm)].length === 1 && amount[0][1] !== '0') {
      const m = amount[0];
      p.amounts.push({ kind: 'actual', fiscalYear: 2020, amountYen: Number(m[1].replaceAll(',', '')) * 1000, rawValue: m[1], rawUnit: '千円', evidence: evidence(input, m[0], start + m.index!) });
      p.warnings.push('事業費は「２ 事業実績」欄の「R2事業費」（様式上の単位は千円）を令和2年度実績として記録。');
    } else p.warnings.push('R2事業費は値が無い・0・または値と単位の位置が抽出テキストで確定できないため未記録。');
    p.warnings.push('成果目標の数値（最終目標・目標値・実績値・達成度）と総合評価・今後の方向性は段組みが崩れ対応が確定できないため未構造化。');
    records.push(p);
  }
  return dedupe(records);
}

export const kanumaKitaibarakiEntries: Record<string, Entry> = {
  '09205': { extract: extractKanuma, scope: '事業評価調書（事業評価結果一覧 R5jigyou.pdf）のうち抽出テキストで完結している調書の事業名・所管部課・改善の方向性（A〜D）のみ。年度の明記がないため年度は未設定、事業費・指標・自己評価点は列対応が確定できず未構造化。同様式の別資料（jigyouhyouka.pdf）と施策評価・政策評価・外部評価は対象外。' },
  '08215': { extract: extractKitaibaraki, scope: '令和3年度事務事業評価書（対象：令和2年度実施計画事業）のうち抽出テキストで完結している評価書の事業名・担当課・①〜⑤の評価・R2事業費のみ。成果目標の数値と総合評価・今後の方向性は段組み崩れのため未構造化。令和4年度評価の案内ページは対象外。' },
};
