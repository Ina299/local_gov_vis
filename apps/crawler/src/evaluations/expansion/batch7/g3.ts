/** Batch-7 extractors (g3): 稲城市・下野市・狛江市・国分寺市・取手市 here; the rest live in g3-hokkaido.ts / g3-mixed.ts. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { entries as hokkaido } from './g3-hokkaido';
import { entries as mixed } from './g3-mixed';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const yen = (s: string) => Number(s.replace(/[▲\s]/g, '').replaceAll(',', ''));

/** Same-key reprints merge only when their structured values agree; otherwise every copy is dropped. */
function dedupe(records: [string, ProjectEvaluation][]): ProjectEvaluation[] {
  const out = new Map<string, ProjectEvaluation>(), bad = new Set<string>();
  const values = (p: ProjectEvaluation) => JSON.stringify([p.department, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value]), p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual])]);
  for (const [key, p] of records) {
    const old = out.get(key);
    if (!old) { out.set(key, p); continue; }
    if (values(old) !== values(p)) { bad.add(key); continue; }
    old.evidence.push(...p.evidence);
  }
  return [...out].filter(([k]) => !bad.has(k)).map(([, p]) => p);
}

// ---- 13225 稲城市: 令和７年度 地方公会計制度を活用した事務事業評価（令和６年度事務事業分） ----
function extractInagi(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '124a87f7288826fd218a95a4') return [];
  const t = input.text, title = '令 和 ７ 年 度\n\n地方公会計制度を活用した 事務事業評価\n（令和６年度事務事業分）';
  if (!t.startsWith(title)) return [];
  const listStart = t.indexOf('対象事業一覧\n\n事業名\n\n担当部署\n\n'), listEnd = t.indexOf('■令和７年度\n\n稲城市行政運営評価委員会');
  if (listStart < 0 || listEnd < listStart) return [];
  // List rows: No / 事業名 / 部 / 課 (課 may share the 部 line).
  const rows = new Map<number, { name: string; dept: string; raw: string; start: number }>();
  for (const m of t.slice(listStart, listEnd).matchAll(/\n\n([１-９]|1[01])\n\n([^\n]+)\n\n([^\n]+)(?:\n\n([^\n]+課))?(?=\n\n(?:[２-９]|1[01])\n|\n\n$)/g)) {
    const no = Number(m[1].normalize('NFKC'));
    rows.set(no, { name: m[2], dept: m[4] ? `${m[3]} ${m[4]}` : m[3], raw: m[0].slice(2), start: listStart + m.index! + 2 });
  }
  const heads = [...t.matchAll(/地方公会計制度を活用した事務事業評価票\nNo\n\n(\d+)\n/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const no = Number(heads[i][1]), row = rows.get(no);
    if (!row || out.some(p => p.projectCode === String(no))) continue;
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const p = project(input, String(no), row.name, 2025, row.raw, row.start);
    p.projectCode = String(no); p.department = row.dept; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title, 0), evidence(input, heads[i][0], start));
    if (seg.includes('（単位：円、％、人）')) {
      // 行政コスト計算書 columns; kept only when all three subtotals reconcile.
      for (const m of seg.matchAll(/令和([４５６])年度\n((?:[\d,]+\n){13}[\d.]+ 人工)/g)) {
        const v = m[2].split('\n').slice(0, 13).map(yen);
        if (v[0] + v[1] + v[3] + v[4] !== v[5] || v[6] + v[7] + v[8] !== v[9] || v[5] - v[9] !== v[10]) continue;
        const fy = 2018 + Number(m[1].normalize('NFKC')), lines = m[2].split('\n'), e = evidence(input, m[0], start + m.index!);
        p.amounts.push({ kind: 'personnel', fiscalYear: fy, amountYen: v[0], rawValue: lines[0], rawUnit: '円', evidence: e });
        p.amounts.push({ kind: 'fullCost', fiscalYear: fy, amountYen: v[5], rawValue: lines[5], rawUnit: '円', evidence: e });
      }
    }
    p.warnings.push('対象事業一覧の事業名・担当部署を採用（評価票の事業名表記と異なる場合あり）。金額は行政コスト計算書の人件費と費用合計a（受益者負担等を差し引く前）で、各小計の検算が通る年度列のみ。行政運営評価委員会のコメント評価・成果指標は構造化していません。');
    out.push(p);
  }
  return out;
}

// ---- 09216 下野市: 令和7年度 事務事業評価シート（単票） ----
function extractShimotsuke(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '9febc5b93b8d4814454abd94') return [];
  const t = input.text, name = 'スマートＩＣ整備事業', head = '令和7年度\n\n事務事業評価シート';
  const deptRaw = 'スマートＩＣ整備事業\n\n都市建設部\n整備課';
  if (!t.startsWith(head) || !t.includes(deptRaw)) return [];
  const p = project(input, name, name, 2025, head, 0);
  p.projectCode = null; p.department = '都市建設部 整備課'; p.evidence.push(evidence(input, deptRaw));
  const unit = '◎事業費\n（単位：千円）';
  for (const [fy, label] of [[2023, '令和5年度'], [2024, '令和6年度']] as const) {
    const m = t.match(new RegExp(`${label}\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n`));
    if (!m || yen(m[4]) + yen(m[5]) + yen(m[6]) !== yen(m[2]) || !t.includes(unit)) continue;
    const e = evidence(input, m[0], m.index!);
    p.amounts.push({ kind: 'budget', fiscalYear: fy, amountYen: yen(m[2]) * 1000, rawValue: m[2], rawUnit: '千円', evidence: e });
    p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: yen(m[3]) * 1000, rawValue: m[3], rawUnit: '千円', evidence: e });
  }
  const r = t.match(/４．１次評価\n\n※必要性・有効性・効率性はA・B・Cの3段階評価とし、総合評価は継続・見直し・廃止で評価する。\n\n必要性\n\n([ＡＢＣ])\n\n有効性\n\n([ＡＢＣ])\n\n効率性\n\n([ＡＢＣ])\n/);
  if (r) {
    const e = evidence(input, r[0], r.index!), scale = '必要性・有効性・効率性はA・B・Cの3段階評価';
    p.ratings.push({ kind: 'self', label: '１次評価 必要性', value: r[1], scale, evidence: e }, { kind: 'self', label: '１次評価 有効性', value: r[2], scale, evidence: e }, { kind: 'self', label: '１次評価 効率性', value: r[3], scale, evidence: e });
  }
  p.warnings.push('事業費は予算現額（=国県支出金+地方債・その他+一般財源）の検算が通る令和5・6年度列のみ。予算現額をbudget、決算額をactualとして記録。総合評価・指標は段組み崩れのため構造化していません。');
  return [p];
}

// ---- 13219 狛江市: 令和８年度行政評価結果報告書（令和７年度実施事業） ----
function extractKomae(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== 'bfc7dda6cd0aa4f7803eb703') return [];
  const t = input.text, title = '令和８年度行政評価結果報告書\n（令和７年度実施事業）';
  const scaleRaw = '１．評価基準\n評価\n\n評価基準内容\n\nＡ\n\n進捗している\n\nＢ\n\n現状維持\n\nＣ\n\nあまり進捗していない\n\nＤ\n\n進捗していない';
  if (!t.startsWith(title) || !t.includes(scaleRaw)) return [];
  const scale = 'Ａ進捗している／Ｂ現状維持／Ｃあまり進捗していない／Ｄ進捗していない（基本計画の施策・方向性に照らした4段階）';
  const records: [string, ProjectEvaluation][] = [];
  const make = (name: string, dept: string, raw: string, start: number) => {
    const p = project(input, name, name, 2026, raw, start);
    p.projectCode = null; p.department = dept; p.evaluatedFiscalYear = 2025; p.evidence.push(evidence(input, title, 0));
    p.warnings.push('施策別の評価対象一覧の行（予算科目・事業・所管課・評定）と、事業別ページで列が連続して読める決算額のみ。複数施策に再掲され評定・金額が食い違う事業は除外。抽出テキストが途中で切れているため後半の事業は未収録。');
    return p;
  };
  // 評価対象一覧: 予算科目 / 事業 / 所管課 / 評定 in one contiguous row.
  for (const m of t.matchAll(/(?<=\n\n)(\d+-\d+-\d+|ー|－)\n\n([^\n]+)\n\n([^\n]+)\n\n([ABCD])(?=\n\n)/g)) {
    const start = m.index!, raw = m[0], p = make(m[2], m[3], raw, start);
    p.ratings.push({ kind: 'self', label: '評定', value: m[4], scale, evidence: evidence(input, raw, start) });
    records.push([`${m[2]}\n${m[3]}`, p]);
  }
  // 事業別ページ: 決算額 R７年度 (千円) when the columns print contiguously.
  const ratedKeys = new Set(records.map(([k]) => k));
  for (const m of t.matchAll(/事業\n\n予算科目\n\n(\S+)\n\n所管課\n\n(\S+)\n\n決算額\n\n([^\n]+)\n\nR７年度\n\n\(千円\)\n\n([\d,]+)\n/g)) {
    const key = `${m[3]}\n${m[2]}`;
    if (!ratedKeys.has(key)) continue;
    const p = make(m[3], m[2], m[0], m.index!), e = evidence(input, m[0], m.index!);
    records.push([key + '\namount', p]);
    p.amounts.push({ kind: 'actual', fiscalYear: 2025, amountYen: yen(m[4]) * 1000, rawValue: m[4], rawUnit: '千円', evidence: e });
  }
  const rated = dedupe(records.filter(([k]) => !k.endsWith('\namount')));
  const amounts = new Map<string, ProjectEvaluation | null>();
  for (const [k, p] of records.filter(([k]) => k.endsWith('\namount'))) {
    const key = k.slice(0, -7), old = amounts.get(key);
    if (old === undefined) amounts.set(key, p);
    else if (old && old.amounts[0].amountYen !== p.amounts[0].amountYen) amounts.set(key, null);
  }
  for (const p of rated) {
    const a = amounts.get(`${p.projectName}\n${p.department}`);
    if (a) { p.amounts.push(...a.amounts); p.evidence.push(a.evidence[0]); }
  }
  return rated;
}

// ---- 13214 国分寺市: 事務事業評価票（監査委員事務局・教育委員会） ----
const KOKUBUNJI = new Set(['1dce365ea9f213fb0e0e8fb1', '4495fae7867783362fdeb049']);
function extractKokubunji(input: CachedInput): ProjectEvaluation[] {
  if (!KOKUBUNJI.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(/^事務事業評価票\n/gm)];
  const records: [string, ProjectEvaluation][] = [], subNames = new Map<ProjectEvaluation, { v: string; e: ReturnType<typeof evidence> }>();
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    if (input.truncated && i === heads.length - 1) continue;
    const id = seg.match(/^事務事業評価票\n\n所管課\n\n事業番号\n\n(?:事業目的\n\n)?(\d{7})\n\n([^\n]+)\n\n([^\n]+)\n\n事務事業\n/);
    if (!id || !/^-\d+-$/m.test(seg)) continue;
    const p = project(input, id[1], id[3], null, id[0], start);
    p.projectCode = id[1]; p.department = id[2];
    // 事業費（円）: R5決算 / R6予算 / R6決算 / R7当初 / R8当初 / 増減額, accepted only when every printed ratio and difference reconciles.
    const costStart = seg.indexOf('事業費\n（円）'), kpi = seg.indexOf('事業の重要業績評価指標（ＫＰＩ）');
    if (costStart >= 0 && kpi > costStart) {
      const block = seg.slice(costStart, kpi);
      const nums = [...block.matchAll(/(?<![\d.])(▲ )?(\d{1,3}(?:,\d{3})+|\d+)(?![\d.%])/g)].map(m => ({ raw: m[0], v: (m[1] ? -1 : 1) * yen(m[2]) }));
      const pct = [...block.matchAll(/(\d+(?:\.\d)?)%/g)].map(m => Number(m[1]));
      const ok = (a: number, b: number, r: number) => b > 0 && Math.abs(Math.round(a / b * 1000) / 10 - r) < 0.051;
      const labels = ['令和５年度', '令和６年度', '令和７年度', '令和８年度'].every(l => block.includes(l)) || seg.slice(costStart - 30, kpi).includes('令和５年度');
      if (nums.length === 6 && pct.length === 3 && labels) {
        const [r5, b6, a6, b7, b8, diff] = nums;
        if (ok(a6.v, b6.v, pct[0]) && ok(b7.v, b6.v, pct[1]) && b8.v - b7.v === diff.v && ok(b8.v, b7.v, pct[2])) {
          const e = evidence(input, block, start + costStart);
          p.amounts.push({ kind: 'actual', fiscalYear: 2023, amountYen: r5.v, rawValue: r5.raw, rawUnit: '円', evidence: e },
            { kind: 'budget', fiscalYear: 2024, amountYen: b6.v, rawValue: b6.raw, rawUnit: '円', evidence: e },
            { kind: 'actual', fiscalYear: 2024, amountYen: a6.v, rawValue: a6.raw, rawUnit: '円', evidence: e },
            { kind: 'budget', fiscalYear: 2025, amountYen: b7.v, rawValue: b7.raw, rawUnit: '円', evidence: e },
            { kind: 'budget', fiscalYear: 2026, amountYen: b8.v, rawValue: b8.raw, rawUnit: '円', evidence: e });
        }
      }
    }
    for (const [label, re] of [
      ['今後の進め方（成果と課題）', /今後の進め方（成果と課題）\n\n([^\n]{2,8})\n/],
      ['事業目的に対する有効性', /事業目的に対する\n有効性\n\n([^\n]{1,4})\n/],
      ['事業実施方法の妥当性', /事業実施方法の\n妥当性\n\n([^\n]{1,4})\n/],
      ['次年度の実施方針と予算計上の考え方', /次年度の実施方針と予算計上の考え方\n\n([^\n]{2,8})\n/],
    ] as const) {
      const m = seg.match(re);
      if (m) p.ratings.push({ kind: 'self', label, value: m[1], scale: null, evidence: evidence(input, m[0], start + m.index!) });
    }
    p.warnings.push('評価年度の表記が票にないため評価年度・対象年度は未設定。事業費は各年度列の執行率・前年度比・増減額の検算が全て通る票のみ記録（令和7・8年度は当初予算額）。KPIは列崩れのため構造化していません。');
    // 細事業 label: an unwrapped name ending in 事務事業 printed on exactly one side of the label.
    const before = seg.match(/\n([^\n]*事務事業)\n\n細事業\n/), after = seg.match(/\n細事業\n\n([^\n]*事務事業)\n/);
    const sub = before && !after ? { m: before, v: before[1] } : after && !before ? { m: after, v: after[1] } : null;
    if (sub && sub.v !== '事務事業') subNames.set(p, { v: sub.v, e: evidence(input, sub.m[0], start + sub.m.index!) });
    records.push([id[1], p]);
  }
  // Several 細事業 share one 事務事業 name; disambiguate them by 細事業 or drop when it is not readable.
  const result = dedupe(records), groups = new Map<string, ProjectEvaluation[]>();
  for (const p of result) groups.set(`${p.projectName}\n${p.department}`, [...(groups.get(`${p.projectName}\n${p.department}`) ?? []), p]);
  const out: ProjectEvaluation[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) { out.push(group[0]); continue; }
    const named = group.filter(p => subNames.has(p)).map(p => { const s = subNames.get(p)!; p.projectName = `${p.projectName}（${s.v}）`; p.evidence.push(s.e); return p; });
    out.push(...named.filter(p => named.filter(q => q.projectName === p.projectName).length === 1));
  }
  return out;
}

// ---- 08217 取手市: 令和７年度分 重点事業マネジメントシート（教育委員会・消防・議会・会計・監査・農業委員会） ----
const TORIDE = new Set(['0d61fb5ee6489f8e313c810f', '151d2cb41306ca40bd74f785', '211052f7bcc9c0af0ab40ea6', '2dc0e6e340ab2b7b9b9a448f', 'e80308a141df2fdbc35a288d', 'f7434b033c354eaf5987d4a8']);
// Names already structured from the 2025 一覧 (00juenjigyouhyoukakekkagaiyou_r8.pdf); excluded as identity collisions.
const TORIDE_EXISTING = new Set(['消防団運営事業', '消防施設・設備等維持管理事業', '住宅防火推進事業', '防火対象物及び危険物施設への防火指導事業', '消防隊員・救急隊員の育成事業（救急救命士養成）', '消防車両整備事業', '消防水利整備事業',
  '円滑かつ効率的な議会活動の支援', '市民にわかりやすい議会情報の発信', '市民の議会及び市政に対する関心・理解・参加を促す取組', '新しい議会のビジョン・形づくりの支援', '財務会計システム電子決裁導入事業', '支出伝票作成事務の適正化', '公金取扱いの管理徹底', '物品出納記録の徹底',
  '定期監査', '決算審査', '財政援助団体等に関する監査', '農地の権利移動及び転用許認可事務事業', '遊休農地の利用状況確認及び利用意向調査事業', '農業経営基盤強化促進事業',
  '小中学校体育館・中学校武道場空調設備設置事業', '教育委員会運営・点検評価事業', '小中学校施設管理・整備事業', '児童生徒の安全対策事業', '学校のICT環境整備', '小学校遊具更新事業', '学校給食管理事業', '児童生徒・教職員健康管理事業', 'いじめ防止対策推進事業（いじめ・不登校対策）', '人権教育事業', '学力向上推進事業', '特色ある新しい学校教育推進事業（小規模特認校）', 'コミュニティ・スクール事業', '市民大学事業', '文化財・郷土資料の保存・継承と活用', '公民館活動推進事業', '放課後子どもクラブ運営事業', '中学校部活動地域移行事業', 'スポーツ振興事業', 'スポーツ施設管理・整備事業', '読書活動推進事業（子どもの読書活動）', '読書活動推進事業（図書資料・読書環境整備）']);
function extractToride(input: CachedInput): ProjectEvaluation[] {
  if (!TORIDE.has(input.sourceId)) return [];
  const t = input.text, heads = [...t.matchAll(/^令和７年度分 重点事業マネジメントシート\n重点事業名\n\n([^\n]+)\n/gm)];
  const records: [string, ProjectEvaluation][] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length), name = heads[i][1];
    if ((input.truncated && i === heads.length - 1) || TORIDE_EXISTING.has(name)) continue;
    const dept = seg.match(/\n担当課\n\n([^\n]+)\n\n事業目的・概要\n/);
    if (!dept) continue;
    const p = project(input, `${dept[1]}:${name}`, name, null, heads[i][0], start);
    p.projectCode = null; p.department = dept[1]; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, dept[0], start + dept.index!));
    // 人件費計（Ｂ）and トータルコスト（Ａ＋Ｂ） rows print as label + R6/R7/R8 values; R8 is 見込 and omitted.
    const cost = seg.match(/事業費\(単位:千円\)\n\nR6\(実績\)\n\nR7\(実績\)\n\nR8\(見込\)\n/);
    const rows = seg.match(/人件費計（Ｂ）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\nトータルコスト（Ａ＋Ｂ）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/);
    if (cost && rows) {
      const e = evidence(input, rows[0], start + rows.index!);
      p.evidence.push(evidence(input, cost[0], start + cost.index!));
      p.amounts.push({ kind: 'personnel', fiscalYear: 2024, amountYen: yen(rows[1]) * 1000, rawValue: rows[1], rawUnit: '千円', evidence: e },
        { kind: 'personnel', fiscalYear: 2025, amountYen: yen(rows[2]) * 1000, rawValue: rows[2], rawUnit: '千円', evidence: e },
        { kind: 'fullCost', fiscalYear: 2024, amountYen: yen(rows[4]) * 1000, rawValue: rows[4], rawUnit: '千円', evidence: e },
        { kind: 'fullCost', fiscalYear: 2025, amountYen: yen(rows[5]) * 1000, rawValue: rows[5], rawUnit: '千円', evidence: e });
    }
    // Single outcome indicator whose name sits on its own line directly under 成果指標 or directly before its unit row.
    const ind = seg.match(/成果指標\n([^\n]+)\n事業スケジュール\(当初\)\n[\s\S]*?単位\n\nR6\n（実績）\n\nR7\n（実績）\n\nR8\n（目標）\n\nR9\n（目標）\n\n([^\n\d]{1,6})\n\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n/)
      ?? seg.match(/成果指標\n\n単位\n\nR6\n（実績）\n\nR7\n（実績）\n\nR8\n（目標）\n\nR9\n（目標）\n\n([^\n]+)\n\n([^\n\d]{1,6})\n\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n\n事業スケジュール/);
    if (ind && (seg.match(/R9\n（目標）/g) ?? []).length === 1) {
      const e = evidence(input, ind[0], start + ind.index!);
      p.indicators.push({ name: ind[1], fiscalYear: 2024, target: null, actual: ind[3], unit: ind[2], evidence: e },
        { name: ind[1], fiscalYear: 2025, target: null, actual: ind[4], unit: ind[2], evidence: e },
        { name: ind[1], fiscalYear: 2026, target: ind[5], actual: null, unit: ind[2], evidence: e },
        { name: ind[1], fiscalYear: 2027, target: ind[6], actual: null, unit: ind[2], evidence: e });
    }
    const prog = seg.match(/進捗度\n\n([ABCD])\n（([^）]+)）/);
    if (prog) p.ratings.push({ kind: 'self', label: '進捗度', value: prog[1], scale: null, evidence: evidence(input, prog[0], start + prog.index!) });
    const dir = seg.match(/今後の方向性\n\n([^\n]{1,10})\n/);
    if (dir) p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir[1], scale: null, evidence: evidence(input, dir[0], start + dir.index!) });
    p.warnings.push('令和７年度分シートの対象年度を2025とし、評価実施年度は未設定。金額は人件費計（Ｂ）とトータルコスト（Ａ＋Ｂ）の令和6・7年度実績のみ（事業費内訳・令和8年度見込は列崩れ・見込のため除外）。構造化済み一覧と同名の事業は衝突回避のため除外。');
    records.push([`${dept[1]}\n${name}`, p]);
  }
  return dedupe(records);
}

export const entries: Record<string, Entry> = {
  ...hokkaido,
  ...mixed,
  '13225': { extract: extractInagi, scope: '令和７年度 地方公会計制度を活用した事務事業評価（令和６年度事務事業分）の11事業について、事業名・担当部署と、検算が通る年度別の人件費・費用合計（行政コスト計算書）を構造化。委員会コメント・成果指標は対象外。' },
  '09216': { extract: extractShimotsuke, scope: '令和7年度事務事業評価シート（スマートＩＣ整備事業の単票）から、担当部課・検算が通る予算現額と決算額・１次評価（必要性・有効性・効率性）を構造化。評価一覧ページ・指標は対象外。' },
  '13219': { extract: extractKomae, scope: '令和８年度行政評価結果報告書（令和７年度実施事業）の施策別評価対象一覧から、事業名・所管課・評定（A〜D）と、事業別ページで読める令和7年度決算額を構造化。基本計画推進委員会の提言書（施策の外部評価）は対象外。' },
  '13214': { extract: extractKokubunji, scope: '事務事業評価票（監査委員事務局・教育委員会分）の事業番号・事務事業名・所管課と、検算が通る事業費（決算・予算）、今後の進め方等の区分を構造化。KPI・評価一覧ページは対象外。' },
  '08217': { extract: extractToride, scope: '令和７年度分 重点事業マネジメントシート（教育委員会・消防・議会・会計・監査・農業委員会）のうち、構造化済み一覧にない事業の担当課・人件費・トータルコスト・単一成果指標・進捗度・方向性を構造化。一覧と同名の事業は対象外。' },
};
