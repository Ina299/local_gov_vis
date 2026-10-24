import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, nfkc, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

const debug = (msg: string) => { if (process.env.M4A_DEBUG) console.error(`[m4-small-a] ${msg}`); };
/** Offset of a raw string that occurs exactly once in the text, else -1. */
function unique(t: string, raw: string): number {
  const i = t.indexOf(raw);
  return i >= 0 && t.indexOf(raw, i + 1) < 0 ? i : -1;
}
const key = (p: ProjectEvaluation) => `${nfkc(p.projectName)}|${p.department ?? ''}|${p.evaluatedFiscalYear}`;
const COMMON = '原表の段組みが抽出テキストで崩れているため、事業名は分断された行を原文の順に連結して表記（evidenceは分断されたままの原文）。';

// ---------------------------------------------------------------- 一覧表（行ごとに原文の部分文字列を固定して構造化）
type Ind = { raw: string; name: string; target: string | null; actual: string | null; unit: string | null };
type Row = { name: string; ev: string[]; dept?: string; amount?: { raw: string; value: string }; inds?: Ind[]; warn?: string };
type DocSpec = { sourceId: string; header: string; year: number; unit?: '円' | '千円'; unitRaw?: string; rows: Row[]; warnings: string[]; amountKind?: string };

function fromSpec(input: CachedInput, spec: DocSpec): ProjectEvaluation[] {
  if (input.sourceId !== spec.sourceId) return [];
  const t = input.text, head = unique(t, spec.header);
  if (head < 0) { debug(`${spec.sourceId}: header missing`); return []; }
  const unitAt = spec.unitRaw ? unique(t, spec.unitRaw) : -1;
  const out: ProjectEvaluation[] = [];
  for (const row of spec.rows) {
    const at = row.ev.map(r => unique(t, r));
    if (at.some(i => i < 0)) { debug(`${spec.sourceId}: ${row.name}: evidence not unique/missing ${row.ev[at.findIndex(i => i < 0)]!.slice(0, 40)}`); continue; }
    const p = project(input, row.name, row.name, null, row.ev[0]!, at[0]);
    p.evaluatedFiscalYear = spec.year;
    row.ev.slice(1).forEach((r, k) => p.evidence.push(evidence(input, r, at[k + 1])));
    p.evidence.push(evidence(input, spec.header, head));
    if (row.dept) {
      if (!row.ev.some(r => r.includes(row.dept!)) && !row.inds?.some(i => i.raw.includes(row.dept!))) { debug(`${row.name}: dept not in evidence`); continue; }
      p.department = row.dept;
    }
    if (row.amount) {
      // The value is the only occurrence in the raw text, or the raw text starts with it (総事業費・交付金が同額の行).
      const a = unique(t, row.amount.raw), v = row.amount.raw.indexOf(row.amount.value);
      if (a < 0 || v < 0 || (v > 0 && row.amount.raw.indexOf(row.amount.value, v + 1) >= 0) || !spec.unit) { debug(`${row.name}: amount raw`); continue; }
      p.amounts.push(amount(input, 'actual', spec.year, row.amount.value, spec.unit, row.amount.raw, a));
      if (unitAt >= 0) p.evidence.push(evidence(input, spec.unitRaw!, unitAt));
      if (spec.amountKind) p.warnings.push(spec.amountKind);
    }
    for (const ind of row.inds ?? []) {
      const i = unique(t, ind.raw);
      if (i < 0 || (ind.target && !ind.raw.includes(ind.target)) || (ind.actual && !ind.raw.includes(ind.actual))) { debug(`${row.name}: indicator ${ind.raw.slice(0, 30)}`); continue; }
      p.indicators.push({ name: ind.name, fiscalYear: spec.year, target: ind.target, actual: ind.actual, unit: ind.unit, evidence: evidence(input, ind.raw, i) });
    }
    p.warnings.push(...spec.warnings);
    if (row.warn) p.warnings.push(row.warn);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 江府町（物価高騰対応重点支援地方創生臨時交付金事業 実施状況/評価 令和5・6年度）
const KOFU_WARN = '物価高騰対応重点支援地方創生臨時交付金事業の実施状況/評価一覧。年度は表題の年度（交付金の年度）を評価対象年度とした。' + COMMON + '事業評価欄（文章）は事業概要欄と行が混在するため未収録。';
const KOFU: DocSpec[] = [
  { sourceId: '5eba37d26db61e87d777d155', header: '令和5年度\n\n物価高騰対応重点支援地方創生臨時交付金事業\n\n実施状況/評価', year: 2023, unit: '千円', unitRaw: '単位：千円',
    amountKind: '金額は「決算額」列（単位：千円）。決算額の合計は表題部の決算額39,608,000円と一致することを確認。', warnings: [KOFU_WARN], rows: [
      { name: '江府町住民税非課税世帯臨時給付金事業', ev: ['江府町住民税非課税 税非課税世帯に対する経済\n1 世帯臨時給付金事業'], amount: { raw: '16,537\n\n千円', value: '16,537' } },
      { name: '江府町住民税均等割非課税世帯臨時給付金事業', ev: ['江府町住民税均等割\n税均等割りのみ課税世帯に\n2 非課税世帯臨時給付 対する経済支援を行い、支\n金事業'], amount: { raw: '8,730\n\n千円', value: '8,730' } },
      { name: '江府町住民税均等割非課税世帯臨時給付金事業（子育て世帯支援分）', ev: ['江府町住民税均等割\n税均等割りのみ課税世帯\n非課税世帯臨時給付\n3 金事業（子育て世帯 （うち、子育て世帯）に対\nする経済支援を行い、支援\n支援分）'], amount: { raw: '1,500\n\n千円', value: '1,500' } },
      { name: '江府町定額減税事業（事務費）', ev: ['江府町定額減税事業\n\n5 (事務費）', '物価高が続く中で課税者へ\nの支援を行うことで、課税\n期限内に全ての支給対象者\n者の方々の生活を維持す\nに対し、給付を行った。\nる。（給付事業に係る事務\n費）'],
        amount: { raw: '1,609\n\n千円', value: '1,609' }, warn: '事業名（No.5）は表の末尾に分かれて出力されている。決算額1,609千円は「給付事業に係る事務費」の行の値で、事業名との対応は表の残余（他の4事業は事業名と同じ位置に出力）による。' },
      { name: '給油等助成券発行補助事業', ev: ['給油等助成券発行補 する経済支援事業として、 期限内に全ての支給対象者\n10 助事業'], amount: { raw: '11,232\n\n千円', value: '11,232' } },
    ] },
  { sourceId: 'fa9055ebf9e164a5c53d7224', header: '令和６年度\n\n物価高騰対応重点支援地方創生臨時交付金事業\n\n実施状況/評価', year: 2024, unit: '円', unitRaw: '単位：円',
    amountKind: '金額は「決算額」列（単位：円）。', warnings: [KOFU_WARN], rows: [
      { name: '江府町住民税非課税世帯臨時給付金事業', ev: ['江府町住民税非課税 税非課税世帯に対する経済\n1 世帯臨時給付金事業'], amount: { raw: '\n5,572,000\n', value: '5,572,000' } },
      { name: '江府町住民税均等割非課税世帯臨時給付金事業', ev: ['江府町住民税均等割\n税均等割りのみ課税世帯に\n2 非課税世帯臨時給付 対する経済支援を行い、支\n金事業'], amount: { raw: '\n30,677,998\n', value: '30,677,998' } },
      { name: '江府町R6低所得世帯支援・定額減税不足額給付事業', ev: ['江府町R6低所得世帯 税非課税世帯及び定額減税\n3 支援・定額減税不足 に不足額があった町民に対\n額給付事業'], amount: { raw: '\n11,278,356\n', value: '11,278,356' } },
      { name: '江府町物価高騰対策交付金給付事業', ev: ['江府町物価高騰対策 いる町民に対する経済支援\n11 交付金給付事業'], amount: { raw: '\n20,036,704\n', value: '20,036,704' } },
      { name: '畜産経営緊急救済事業費補助金', ev: ['畜産経営緊急救済事\n\n12 業費補助金', '県内畜産農家の経営を圧迫 業した対象業者は、0であっ\nしていることから、町内和 た。\n牛・酪農農家の飼料代高騰\n部分の一部を助成する\n\n1,404,700'],
        amount: { raw: '部分の一部を助成する\n\n1,404,700', value: '1,404,700' }, warn: '事業名（No.12）は表の末尾に分かれて出力されている。決算額1,404,700円は飼料代高騰の助成（畜産農家）を内容とする行の値。' },
    ] },
];

// ---------------------------------------------------------------- 根羽村（物価高騰対応重点支援地方創生臨時交付事業 使途・効果等一覧 令和5・6年度事業実績）
const NEBA_PRICE_WARN = '物価高騰対応重点支援地方創生臨時交付事業 使途・効果等一覧の「令和N年度事業実績」の行。総事業費＝臨時交付金＋その他の一致を確認。' + COMMON;
const NEBA_PRICE = (year: number, rows: Row[]): DocSpec => ({ sourceId: '89a397cd4836a92d9b4c487d', header: `令和${year - 2018}年度事業実績`, year, unit: '円', rows,
  amountKind: '金額は「総事業費」列（令和N年度事業実績の表、円表記の数値）。単位の表示は表にないが、補助金額（7万円等）と件数から円と判断。', warnings: [NEBA_PRICE_WARN] });
const NEBA_PRICE_SPECS: DocSpec[] = [
  NEBA_PRICE(2023, [
    { name: '根羽村物価高騰対応重点支援臨時交付金', ev: ['\n根羽村物価高騰対応重点支援臨時交付金\n'], amount: { raw: '7,322,920\n\n7,322,000\n\n920', value: '7,322,920' } },
    { name: '住民税所得割非課税世帯物価高騰対応重点支援交付金', ev: ['住民税所得割非課税世帯物価高騰対応重点\n支援交付金'], amount: { raw: '2,807,140\n\n2,807,140\n\n0', value: '2,807,140' } },
    { name: '物価高騰対応重点支援こども加算交付金', ev: ['物価高騰対応重点支援こども加算交付金'], amount: { raw: '701,020\n\n701,020\n\n0', value: '701,020' } },
    { name: '根羽村農林水産業事業者物価高騰対策支援事業', ev: ['根羽村農林水産業事業者物価高騰対策支援\n事業'], amount: { raw: '2,200,000\n\n2,200,000\n\n0', value: '2,200,000' } },
    { name: '根羽村中小企業等エネルギー高騰対策支援事業', ev: ['根羽村中小企業等エネルギー高騰対策支援事 物価・電気料高騰の影響を受ける村内中小企業、公民館や防犯灯を維持管理する自治会を支援するため、\n業'],
      amount: { raw: '5,450,000\n\n5,450,000\n\n0', value: '5,450,000' }, warn: '総事業費5,450,000円は事業名の直前に出力されている（表の行の高さの違いによる出力順の入れ替わり）。前の4事業はそれぞれ事業名・概要の後に値が出力されており、残る値として対応づけた。' },
  ]),
  NEBA_PRICE(2024, [
    { name: '根羽村物価高騰対応定額減税・臨時給付金事業', ev: ['根羽村物価高騰対応定額減税・臨時給付金事\n物価高騰の影響で特に影響を受ける低所得世帯への支援と定額減税の補足により広く多くの\nする子供加算（50千円/人）を交付。\n業'], amount: { raw: '11,238,940\n\n9,207,000\n\n2,031,940', value: '11,238,940' } },
    { name: '根羽村物価高騰対応臨時給付金（令和6年度低所得世帯支援枠及び不足額給付）事業', ev: ['根羽村物価高騰対応臨時給付金（令和6年度\n低所得世帯支援枠及び不足額給付）事業'], amount: { raw: '2,973,200\n\n2,973,200\n\n0', value: '2,973,200' } },
    { name: '根羽村物価高騰対策臨時生活支援事業', ev: ['根羽村物価高騰対策臨時生活支援事業'], amount: { raw: '9,819,100\n\n9,287,000\n\n532,100', value: '9,819,100' } },
  ]),
];
/** 令和5年度の表は「令和6年度事業実績」の見出しより前だけ、令和6年度の表はその後だけを使う。 */
function nebaPrice(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '89a397cd4836a92d9b4c487d' || !input.text.startsWith('物価高騰対応重点支援地方創生臨時交付事業使途・効果等一覧')) return [];
  const split = input.text.indexOf('令和6年度事業実績');
  if (split < 0) return [];
  return NEBA_PRICE_SPECS.flatMap(spec => fromSpec(input, spec).filter(p => {
    const at = Number(p.evidence[0]!.cell!.match(/chars:(\d+)/)![1]);
    return spec.year === 2023 ? at < split : at > split;
  }));
}

// ---------------------------------------------------------------- 根羽村（電源立地地域対策交付金事業評価報告書 令和2〜4年度）
const NEBA_DENGEN: Record<string, string> = { '60054db8adf17aef870fb413': '保育所運営事業', 'ebf406eac2828c3041e1d72d': '保育所運営事業', '4261fe72a8cf1a6f315f32a5': '根羽村保育所運営事業' };
const eraYear = (raw: string, reiwa: boolean) => {
  const s = nfkc(raw).replace(/^令和/, '').replace(/年度$/, '');
  if (s === '元') return 2019;
  const n = Number(s);
  return reiwa || n < 20 ? 2018 + n : 1988 + n;
};
function nebaDengen(input: CachedInput): ProjectEvaluation[] {
  const name = NEBA_DENGEN[input.sourceId];
  if (input.municipalityCode !== '20410' || !name) return [];
  const t = input.text, title = /令和(\S)年度電源立地地域対策交付金事業評価報告書/.exec(t), sheet = /Ⅱ．事業評価個表（令和(\S)年度）/.exec(t);
  if (!title || !sheet || nfkc(title[1]!) !== nfkc(sheet[1]!)) return [];
  const fy = 2018 + Number(nfkc(sheet[1]!)), raw = `${name}（保育所職員3名の人件費）`, at = unique(t, `\n${raw}`);
  if (at < 0) return [];
  const p = project(input, name, name, null, raw, at + 1);
  p.evaluatedFiscalYear = fy;
  p.evidence.push(evidence(input, title[0], title.index), evidence(input, sheet[0], sheet.index));
  const dept = /\n総務課\n+総務課\n/.exec(t);
  if (dept) { p.department = '総務課'; p.evidence.push(evidence(input, dept[0].slice(1, -1), dept.index + 1)); }
  const ind = /成果実績\n+％\n+(\d+)\n+目標値\n+％\n+(\d+)\n/.exec(t), indName = /受入率/.test(t.slice(sheet.index));
  if (ind && indName) p.indicators.push({ name: '受入率（受入数÷希望数×100）', fiscalYear: fy, target: ind[2]!, actual: ind[1]!, unit: '％', evidence: evidence(input, ind[0].slice(0, -1), ind.index) });
  // 個表「交付金事業の総事業費等」: 3か年の見出しの後に 総事業費・交付金充当額・うち経済産業省分 の3か年値が並ぶ。
  const y = '((?:令和)?(?:\\d+|元)年度)', v = '([\\d,]+)';
  const cost = new RegExp(`\\n${y}\\n+${y}\\n+${y}\\n+${v}\\n+${v}\\n+${v}\\n+${v}\\n+${v}\\n+${v}\\n`).exec(t.slice(t.indexOf('交付金事業の総事業費等')));
  if (cost && t.includes('（単位：円）')) {
    const base = t.indexOf('交付金事業の総事業費等') + cost.index + 1, raw0 = cost[0].slice(1, -1);
    const years = [cost[1]!, cost[2]!, cost[3]!].map(r => eraYear(r, r.startsWith('令和') || /^(元|\d)年度$/.test(nfkc(r))));
    if (years[2] === fy && years[1] === fy - 1 && years[0] === fy - 2) {
      // 当該年度の値は報告書作成時点（年度途中）のため収録しない。前年度・前々年度の総事業費のみ実績として収録。
      for (const k of [0, 1]) p.amounts.push({ kind: 'actual', fiscalYear: years[k]!, amountYen: Number(cost[4 + k]!.replace(/,/g, '')), rawValue: cost[4 + k]!, rawUnit: '円', evidence: evidence(input, raw0, base) });
      p.evidence.push(evidence(input, '（単位：円）'));
      p.warnings.push('金額は事業評価個表「交付金事業の総事業費等」の総事業費（3か年の並び）のうち前年度・前々年度分を実績として収録（単位：円は総括表の表示）。当該年度分は報告書の日付が年度途中のため未収録。');
    }
  }
  p.warnings.push('電源立地地域対策交付金事業評価報告書（様式第11）の事業評価個表。成果指標は個表の成果実績・目標値（評価年度＝当該年度）。評価年度（行政評価の年度）は未設定。活動指標（保育士雇用数）は未収録。');
  return [p];
}

// ---------------------------------------------------------------- 伊平屋村（沖縄離島活性化推進事業費補助金検証シート 令和4年度（繰越））
const IHEYA_IND: Record<string, Ind[]> = {
  'e1ef468edc20c0747dacff41': [{ raw: '基準値673ｔに対し令和6年度の水揚げは715tとなり、目標の3％を上回る6.3％増', name: '水揚量の増加（基準値比の増加率）', target: '3％', actual: '6.3％', unit: '％' }],
  'ea690bf227c6224ab8d2568e': [{ raw: '入域観光客数の目標値を21,000人以上と設定したが、目標を上回る22,569人の入域観光客数となった', name: '入域観光客数', target: '21,000人以上', actual: '22,569人', unit: '人' }],
  '4d9a29ad0623259192cc7978': [],
};
function iheya(input: CachedInput): ProjectEvaluation[] {
  const inds = IHEYA_IND[input.sourceId];
  if (input.municipalityCode !== '47359' || !inds) return [];
  const t = input.text, title = /令和[4４]年度（(?:事故)?繰越）沖縄離島活性化推進事業費補助金検証シート/.exec(t);
  const head = /\n事業名\n+([^\n]+)\n+担当部課名\n+([^\n]+)\n/.exec(t);
  if (!title || !head) return [];
  const p = project(input, head[1]!, head[1]!, null, head[0].slice(1, -1), head.index + 1);
  p.department = head[2]!;
  p.evaluatedFiscalYear = 2022;
  p.evidence.push(evidence(input, title[0], title.index));
  for (const ind of inds) {
    const i = unique(t, ind.raw);
    if (i >= 0) p.indicators.push({ name: ind.name, fiscalYear: 2024, target: ind.target, actual: ind.actual, unit: ind.unit, evidence: evidence(input, ind.raw, i) });
  }
  p.warnings.push('沖縄離島活性化推進事業費補助金検証シート（令和4年度予算の繰越事業）。評価対象年度は表題の令和4年度（予算年度）とした。成果目標は後年度目標値（令和6年度）に対する進捗状況説明の記述から収録。予算・執行額の表は年度列が抽出テキストで分離しており、資金の流れの総事業費は複数年度にまたがるため金額は未収録。');
  return [p];
}

// ---------------------------------------------------------------- 筑西市（令和７年度 行政評価 外部評価結果）
const CHIKUSEI_LIST = '6fc4cc021cac396ca993dfc8', CHIKUSEI_RESULT = '04b2bf54da7b3f2694c14cdf';
const CHIKUSEI_SCALE = '【進捗状況】\n１．順調である\n２．概ね順調である\n３．順調でない\n【来年度の方向性】\n１．拡 充\n２．見直し\n３．現行どおり\n４．縮 小\n５．休止・廃止・終了';
/** 既存の構造化レコード（評価年度なし）と同名のため新規側を除外する事業。 */
const CHIKUSEI_EXISTING = new Set(['玉戸・一本松線整備事業', '移住定住促進事業', '小中一貫教育推進事業', '地域産品活性化戦略事業'].map(nfkc));
function chikusei(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '08227' || input.sourceId !== CHIKUSEI_RESULT || !input.text.startsWith('令和７年度筑西市行政評価に係る外部評価結果')) return [];
  const t = input.text, list = inputs.find(i => i.sourceId === CHIKUSEI_LIST), out: ProjectEvaluation[] = [];
  const listHead = '令和６年度実施事業 外部評価対象事務事業';
  const re = /■ 評価対象事業([0-9０-９])\n([^\n]+)\n[\s\S]*?\n順調である\n\n([0-9]+)\n\n概ね順調である\n\n([0-9]+)\n\n順調でない\n\n([0-9]+)\n\n拡充\n\n([0-9]+)\n\n見直し\n\n([0-9]+)\n\n現行どおり\n\n([0-9]+)\n\n縮小\n\n([0-9]+)\n\n休止・廃止・終了\n\n([0-9]+)\n/g;
  const labels = ['進捗状況：順調である', '進捗状況：概ね順調である', '進捗状況：順調でない', '来年度の方向性：拡充', '来年度の方向性：見直し', '来年度の方向性：現行どおり', '来年度の方向性：縮小', '来年度の方向性：休止・廃止・終了'];
  const scaleAt = unique(t, CHIKUSEI_SCALE);
  for (const m of t.matchAll(re)) {
    const name = m[2]!;
    if (CHIKUSEI_EXISTING.has(nfkc(name))) continue;
    const nameRaw = `■ 評価対象事業${m[1]}\n${name}`;
    const p = project(input, name, name, 2025, nameRaw, m.index);
    p.evidence.push(evidence(input, '令和７年度筑西市行政評価に係る外部評価結果', 0));
    const block = m[0].slice(m[0].indexOf('\n順調である\n'), -1), blockAt = m.index! + m[0].indexOf('\n順調である\n');
    labels.forEach((label, k) => p.ratings.push({ kind: 'external', label: `外部評価（評価した委員数） ${label}`, value: m[3 + k]!, scale: scaleAt >= 0 ? CHIKUSEI_SCALE : null, evidence: evidence(input, block.slice(1), blockAt + 1) }));
    if (list && list.text.startsWith(listHead)) {
      const row = new RegExp(`\\n${nfkc(m[1]!)}\\n\\n${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\\n([^\\n]+)\\n`).exec(list.text);
      if (row) {
        p.department = row[1]!;
        p.evaluatedFiscalYear = 2024;
        p.evidence.push(evidence(list, row[0].slice(1, -1), row.index + 1), evidence(list, listHead, 0));
      }
    }
    p.warnings.push('令和７年度筑西市行政評価の外部評価結果。各評価区分の値は区分ごとに評価した外部評価委員の人数（原文の数値のまま）。担当課・評価対象年度は「令和６年度実施事業 外部評価対象事務事業」一覧による。委員コメントは未収録。');
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 菰野町（物価高騰対応重点支援地方創生臨時交付金を活用した事業 令和5・6年度）
const KOMONO_WARN = '物価高騰対応重点支援地方創生臨時交付金を活用した事業の一覧。' + COMMON + '総事業費・交付金充当額（千円）は実績額か計画額かの表示がないため未収録。成果指標は「事業の効果」欄の（成果指標：…、実績/目標値）を、効果の内容（対象施設・対象者）と事業概要の対応および表の行順で事業に対応づけたもの。';
const KOMONO: DocSpec[] = [
  { sourceId: '41a98d44fe336822ddd7ffd1', header: '令和5年度 物価高騰対応重点支援地方創生臨時交付金を活用した事業', year: 2023, warnings: [KOMONO_WARN], rows: [
    { name: '学校給食補助事業', ev: ['学校給食補助事業', '町学校給食協会へ補助金を交付し、食材費等高騰分相当\n額の補填する。'], inds: [{ raw: '給食費の増額を防ぐことで、物価高騰等による影響を受\n5,542 けた保護者への経済的支援を図ることができた。\n（成果指標：対象学校数、 実績5校/目標値5校）', name: '対象学校数', target: '5', actual: '5', unit: '校' }] },
  ] },
  { sourceId: '3b3e5ad61cb53da6b88812da', header: '令和６年度 物価高騰対応重点支援地方創生臨時交付金を活用した事業', year: 2024, warnings: [KOMONO_WARN], rows: [
    { name: '証明書コンビニ交付促進事業', ev: ['証明書コンビニ交付促進\n事業'], inds: [{ raw: '種証明書のコンビニ交付サービスにおける証明書発行手\n住民課\n1,681 数料を減免し、負担軽減を図ることができた。\n税務課\n（成果指標：コンビニ発行枚数、\n実績13,466通/目標値14,500通）', name: 'コンビニ発行枚数', target: '14,500', actual: '13,466', unit: '通' }] },
    { name: '子育て支援センター等紙おむつ支給事業', ev: ['子育て支援センター等紙\nおむつ支給事業'], inds: [{ raw: 'むつを現物支給することで、経済的な支援を行うことが\n1,791 できた。\n（成果指標：現物支給した児童数、\n支給実績669人/目標数870人）', name: '現物支給した児童数', target: '870', actual: '669', unit: '人' }] },
    { name: '保育所等おむつサブスクリプション利用料無償化事業', ev: ['保育所等おむつサブスク\nリプション利用料無償化\n事業'], inds: [{ raw: '（成果指標：サブスクリプションを利用した児童数、\n利用実績151人/目標値146人）', name: 'サブスクリプションを利用した児童数', target: '146', actual: '151', unit: '人' }] },
    { name: '学校給食補助事業', ev: ['学校給食補助事業', '食材費等高騰分相当額の補填を行い、学校給食費の増額\nを防ぐ。'], inds: [{ raw: '給食費の増額を防ぐことで、物価高騰等による影響を受\n19,000 けた保護者への経済的支援を図ることができた。\n（成果指標：対象学校数、 実績7校/目標値7校）', name: '対象学校数', target: '7', actual: '7', unit: '校' }] },
    { name: '物価高騰対策水道料金負担軽減支援事業', dept: '上下水道課', ev: ['物価高騰対策水道料金負 町水道事業へ補助金を交付することで、基本料金を減免\n担軽減支援事業'], inds: [{ raw: '上下水道課\n（成果目標：減免対象世帯数、\n実績15,455世帯/目標値15,400世帯）', name: '減免対象世帯数', target: '15,400', actual: '15,455', unit: '世帯' }] },
    { name: '高齢者施設等物価高騰対策支援事業', ev: ['高齢者施設等物価高騰対 介護保険サービスを提供する施設等に対して、食材費、光\n策支援事業'], inds: [{ raw: 'い介護サービス事業所の安定的な運営につなげることが\n0\nできた。\n（成果指標：補助対象施設数、\n実績37施設/目標値47施設）', name: '補助対象施設数', target: '47', actual: '37', unit: '施設' }] },
    { name: '医療機関等物価高騰対策支援事業', ev: ['医療機関等物価高騰対策 医療機関等に対して、食材費、光熱費及びガソリン代の一\n支援事業'], inds: [{ raw: '整できない医療機関や薬局等の安定的な運営につなげる 健康福祉課\n0\nことができた。\n（成果指標：補助対象施設数、\n実績57施設/目標値67施設）', name: '補助対象施設数', target: '67', actual: '57', unit: '施設' }] },
    { name: '障害福祉サービス事業所等物価高騰対策支援事業', ev: ['障害福祉サービス事業所 障害福祉サービス事業所等に対して、食材費、光熱費及び\n等物価高騰対策支援事業'], inds: [{ raw: '食材費、電気料金やガス料金等が高騰する中、障害福祉\nサービス等報酬が定められている等の理由から利用料金\n等を調整できない障害福祉サービス事業所の安定的な運\n0\n営につなげることができた。\n（成果指標：補助対象施設数、\n実績26施設/目標値28施設）', name: '補助対象施設数', target: '28', actual: '26', unit: '施設' }] },
    { name: '保育所等エネルギー価格高騰支援事業', ev: ['保育所等エネルギー価格\n高騰支援事業'], inds: [{ raw: '光熱費の価格高騰の影響を受けた私立保育所の安定的\nな運営につなげることができた。\n（成果指標：補助対象施設数、\n実績3施設/目標値3施設）', name: '補助対象施設数', target: '3', actual: '3', unit: '施設' }] },
    { name: '障害児通所支援事業所等物価高騰対策支援事業', ev: ['障害児通所支援事業所等 障害児福祉サービス事業所等に対して、食材費、光熱費及\n物価高騰対策支援事業'], inds: [{ raw: '電気料金やガス料金が高騰する中、障害福祉サービス等 子ども家庭課\n報酬が定められている等の理由から利用料金等を調整で\nきない障害福祉サービス事業所の安定的な運営につなげ\n0\nることができた。\n（成果指標：補助対象施設数、\n実績16施設/目標値16施設）', name: '補助対象施設数', target: '16', actual: '16', unit: '施設' }],
      warn: '障害福祉サービス事業所等の2事業は効果の記述が類似するため、成果指標は表の行順（障害福祉サービス事業所等→保育所等→障害児通所支援事業所等）で対応づけた。' },
    { name: '放課後児童クラブエネルギー価格高騰支援事業', ev: ['放課後児童クラブエネル\nギー価格高騰支援事業'], inds: [{ raw: '光熱費の価格高騰の影響を受けた学童クラブの安定的な\n運営につなげることができた。\n子ども家庭課\n（成果指標：補助対象施設数、\n実績12施設/目標値12施設）', name: '補助対象施設数', target: '12', actual: '12', unit: '施設' }] },
  ] },
];

// ---------------------------------------------------------------- 三種町（みらい創造プラン等 令和3年度検証事業結果一覧）
const MITANE = 'dc4b4a714ab42f87b3a08c66';
/** 既存の構造化レコード（令和3年度の個別検証シート）と同名、または表記揺れの同一事業のため新規側を除外する事業。 */
const MITANE_EXISTING = new Set(['住宅取得支援補助金交付事業', '住宅取得支援補助事業', '結婚祝金交付事業', '森岳温泉活街性化事業', '森岳温泉活性化事業', '観光ＰＲ事業（特産品ＰＲ事業を含む）', '観光PR（特産品PR事業含）',
  '地域活性化イベント事業', 'スマート農業導入に向けた人材育成', '草地畜産基盤整備事業', 'じゅんさい生産数量助成事業', 'メロン産地育成事業', '有害鳥獣駆除事業', '森岳じゅんさいの里活性化協議会補助事業',
  '地域振興商品券発行事業', '資格取得支援事業', '赤ちゃん誕生祝金支給事業', '自殺対策事業', '配食サービス事業', '生きがい活動支援通所事業', '高齢者世帯等除排雪支援事業', '長寿祝金事業',
  '集会所等施設整備費補助事業', '地域防災計画見直し業務', '空き家対策事業', '未利用財産の有効活用', '納税貯蓄組合補助金'].map(nfkc));
const MITANE_SCALE = /《審査会検証事業のうち\n+一次評価結果》\n+（A\)非常に効果的であった\n+（B\)やや効果的であった\n+（C\)相当程度効果があった\n+（D\)効果がほとんどなかった\n+（E\)効果がなかった/;
function mitane(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05348' || input.sourceId !== MITANE) return [];
  const t = input.text, title = '三種町みらい創造プラン等\n令和3年度検証事業結果一覧', scale = MITANE_SCALE.exec(t);
  if (!t.startsWith(title) || !scale) return [];
  const dept = '[^\\s]{1,10}?(?:課|室|委員会|支所|事務局|センター|館)';
  const re = new RegExp(`(?<=\\n)(?:([0-9０-９]{1,3}(?:-[0-9]+)?)(?:\\n+| ))?([^\\n]{2,40})\\n+(${dept})(?: |\\n+)([ＡＢＣＤＥ])(?=\\n)`, 'g');
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(re)) {
    let name = m[2]!;
    if (!m[1]) { const pre = /^(?:[★■]\S* )+(\d{1,3}(?:-\d+)?) (.+)$/.exec(name); if (!pre) continue; name = pre[2]!; }
    if (/^[（(①-⑳■★◆○●☆◎]/.test(name) && !/^[①-⑳]/.test(name)) continue;
    if (/^[（(■★◆○●☆◎]|検証対象外|^施項目$|^担当課$/.test(name) || /(?:課|委員会|支所)(?: －)?$/.test(name)) continue;
    if (MITANE_EXISTING.has(nfkc(name))) continue;
    const raw = m[0], p = project(input, `${name}#${m[3]}`, name, null, raw, m.index);
    p.projectCode = null;
    p.department = m[3]!;
    p.evaluatedFiscalYear = 2021;
    p.evidence.push(evidence(input, title, 0));
    p.ratings.push({ kind: 'self', label: '一次評価結果（令和3年度）', value: m[4]!, scale: scale[0], evidence: evidence(input, raw, m.index) });
    p.warnings.push('三種町みらい創造プラン等の令和3年度検証事業結果一覧（実施計画事業・行革項目の一覧）。評価は一覧の「一次評価結果」欄（R3列）の記号を原文のまま収録し、区分の定義は同資料の《審査会検証事業のうち一次評価結果》の判断基準を記載。事業番号は抽出テキストで行とずれる箇所があるため未収録。計画の関連性・審議会検証欄は未収録。');
    out.push(p);
  }
  // 同じ事業名の行が複数ある場合（親事業と枝番の事業など）は別事業か再掲か確定できないため除外する。
  const count = new Map<string, number>();
  for (const p of out) count.set(nfkc(p.projectName), (count.get(nfkc(p.projectName)) ?? 0) + 1);
  return out.filter(p => count.get(nfkc(p.projectName)) === 1);
}

// ---------------------------------------------------------------- 東秩父村（物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証 令和5・6年度）
const HIGASHI_WARN = '物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証。年度は表題の年度（交付金の年度）を評価対象年度とした。' + COMMON + '所管課は各事業ブロック冒頭の課名。';
const HIGASHI_AMT = '金額は「総事業費」で、同じ事業の■支出実績の内訳（円）の合計と一致することを確認して実績（円）として収録。事業期間（始期・終期）が表題年度内に収まる事業のみ金額を収録。';
const HIGASHI_NOAMT = '事業期間が表題年度をまたぐ（または翌年度に実施）ため、金額の年度が確定せず未収録。';
const HIGASHI: DocSpec[] = [
  { sourceId: '18591aa81e3b5c0cfee9ae3b', header: '令和５年度 物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証', year: 2023, unit: '円', amountKind: HIGASHI_AMT, warnings: [HIGASHI_WARN], rows: [
    { name: '物価高騰対応臨時給付事業（Ｒ５非課税）【物価高騰対策給付金】', ev: ['物価高騰対応\n臨時給付事業\n1 （Ｒ５非課税）\n【物価高騰対策\n給付金】', '住民福祉課\n\n①物価高が続く中で低所得世帯への支援を行うことで、低所得の\n方々の生活を維持する。\n②低所得世帯への給付金及び事務費\n③給付金額 R５年度分の住民税非課税世帯 280世帯'], dept: '住民福祉課', warn: HIGASHI_NOAMT },
    { name: '物価高騰対応臨時給付事業（Ｒ５均等割）【物価高騰対策給付金】', ev: ['物価高騰対応\n臨時給付事業\n2 （Ｒ５均等割）\n【物価高騰対策\n給付金】', '住民福祉課\n\n①物価高が続く中で低所得世帯への支援を行うことで、低所得の\n方々の生活を維持する。\n②低所得世帯への給付金及び事務費\n③給付金額 R５年度分の住民税均等割のみ課税世帯 82世帯'], dept: '住民福祉課', warn: HIGASHI_NOAMT },
    { name: '物価高騰対応臨時給付事業（こども加算）【物価高騰対策給付金】', ev: ['物価高騰対応\n臨時給付事業\n3 （こども加算）\n【物価高騰対策\n給付金】', '住民福祉課\n\n①物価高が続く中で低所得世帯へこども加算の追加支援'], dept: '住民福祉課', warn: HIGASHI_NOAMT },
    { name: '物価高騰対応臨時給付事業（Ｒ６非課税等）【物価高騰対策給付金】', ev: ['物価高騰対応\n臨時給付事業\n4 （Ｒ６非課税等）\n【物価高騰対策\n給付金】', '住民福祉課\n\n①物価高が続く中で新たに低所得世帯等へとなる世帯'], dept: '住民福祉課', warn: HIGASHI_NOAMT },
    { name: '物価高騰対応臨時給付事業（調整給付）【物価高騰対策給付金】', ev: ['物価高騰対応\n臨時給付事業\n5 （調整給付）【物\n価高騰対策給\n付金】', '企画財政課\n\n①物価高が続く中で定額減税しきれない'], dept: '企画財政課', warn: HIGASHI_NOAMT },
    { name: '子育て世帯応援事業', ev: ['子育て世帯応援\n事業', '住民福祉課\n\n①物価高騰により大きな影響を受けている子育て世帯を支援する'], dept: '住民福祉課', amount: { raw: 'R5.7.4\n\nR6.2.1\n\n5,743,965', value: '5,743,965' } },
    { name: '簡易水道事業操出', ev: ['簡易水道事業\n操出', '建設課\n\n①東秩父村簡易水道事業会計に繰り出し'], dept: '建設課', amount: { raw: 'R5.6.13\n\nR5.12.20\n\n3,727,500', value: '3,727,500' } },
    { name: '合併処理浄化槽設置管理事業操出', ev: ['合併処理浄化\n8 槽設置管理事\n業操出', '建設課\n\n①東秩父村合併処理浄化槽'], dept: '建設課', amount: { raw: 'R5.6.13\n\nR5.8.24\n\n810,728', value: '810,728' } },
    { name: '中小企業等支援事業', ev: ['中小企業等支\n援事業', '産業観光課\n\n①新型コロナウイルス感染症や原油価格'], dept: '産業観光課', amount: { raw: 'R5.6.22\n\nR6.2.1\n\n1,983,630', value: '1,983,630' } },
    { name: '公共交通事業支援事業', ev: ['公共交通事業\n支援事業', '企画財政課\n\n①原油価格・物価高騰により大きな影響を受けている、公共交通'], dept: '企画財政課', amount: { raw: 'R5.8.1\n\nR6.2.15\n\n903,110', value: '903,110' } },
    { name: '地域集会所エネルギー価格高騰対策支援事業', ev: ['地域集会所エネ\n11 ルギー価格高騰\n対策支援事業', '総務課\n\n①物価高騰により、大きな影響を受けている地元管理の集会所等'], dept: '総務課', warn: HIGASHI_NOAMT },
    { name: '地域応援商品券発行事業', ev: ['地域応援商品\n券発行事業', '産業観光課\n\n①物価高騰により大きな影響を受けている事業者及び村民を支\n援するため、住民1人当たり1万円'], dept: '産業観光課', amount: { raw: 'R5.6.15\n\nR6.2.1\n\n4,796,425', value: '4,796,425' } },
  ] },
  { sourceId: '7216512c5eec47ea775a4d8a', header: '令和６年度 物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証', year: 2024, unit: '円', amountKind: HIGASHI_AMT, warnings: [HIGASHI_WARN], rows: [
    { name: '物価高騰対応臨時給付事業', ev: ['の名称\n\n物価高騰対応\n臨時給付事業\n\n物価高騰対応'], amount: { raw: 'R7.3.31\n\n14,579,447\n\n9,825,032', value: '14,579,447' },
      warn: '総事業費14,579,447円と9,825,032円は2事業分が表末尾にまとめて出力されている。支出実績の内訳（支援給付金13,470,000円等／非課税世帯給付金7,380,000円・こども加算給付金360,000円等）の合計と事業内容から、前者を本事業（定額減税を補足する給付等）に対応づけた。所管課は2課の表記が並ぶため未設定。' },
    { name: '物価高騰対応臨時給付事業【Ｒ6低所得世帯等】', ev: ['物価高騰対応\n臨時給付事業\n【Ｒ6低所得世\n帯等】', '住民福祉課\n\n①物価高が続く中で低所得世帯への支援を行うことで、低所得の方々の\n生活を維持する。\n②低所得世帯へ給付金及び事務費'], dept: '住民福祉課', amount: { raw: 'R7.3.31\n\n14,579,447\n\n9,825,032', value: '9,825,032' },
      warn: '総事業費9,825,032円は表末尾にまとめて出力された値のうち、支出実績の内訳（非課税世帯給付金7,380,000円・こども加算給付金360,000円・R7実施計画事業への流用1,676,000円等）の合計と一致するもの。' },
    { name: '(R6臨交）子育て世帯応援事業', ev: ['(R6臨交）子育\n3 て世帯応援事\n業', '住民福祉課\n\n①物価高騰により大きな影響を受けている子育て世帯'], dept: '住民福祉課', warn: HIGASHI_NOAMT },
    { name: '（R6臨交）物価高騰対策農業者支援事業', ev: ['（R6臨交）物価\n4 高騰対策農業\n者支援事業', '産業観光課\n\n①物価高騰により大きな影響を受けている農業所得'], dept: '産業観光課', warn: HIGASHI_NOAMT },
    { name: '（R6臨交）簡易水道事業会計操出', ev: ['（R6臨交）簡易\n5 水道事業会計\n操出', '建設課\n\n①東秩父村簡易水道事業会計'], dept: '建設課', warn: HIGASHI_NOAMT },
    { name: '（R6臨交）合併処理浄化槽設置管理事業会計操出', ev: ['（R6臨交）合併\n処理浄化槽設\n6\n置管理事業会\n計操出', '建設課\n\n①東秩父村合併処理浄化槽'], dept: '建設課', warn: HIGASHI_NOAMT },
  ] },
];

// ---------------------------------------------------------------- 小野市（物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証 令和5・6年度）
const ONO_WARN = '物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証。年度は表題の年度（交付金の年度）を評価対象年度とした。' + COMMON;
const ONO_AMT = '金額は「総事業費【実績額】（円）」。事業期間（始期・終期）が表題年度内に収まる事業のみ金額を収録。';
const ONO_NOAMT = '事業期間が表題年度をまたぐため、金額の年度が確定せず未収録。';
const ONO_SALES = (raw: string, target: string, actual: string): Ind => ({ raw, name: '商品券販売冊数', target, actual, unit: '冊' });
const ONO: DocSpec[] = [
  { sourceId: 'd118ac2be0aa8f634aa0b8e8', header: '令和5年度 物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証', year: 2023, unit: '円', unitRaw: '総事業費 うち交付金\n【実績額】 【実績額】\n（円）', amountKind: ONO_AMT, warnings: [ONO_WARN], rows: [
    { name: '低所得世帯物価高騰緊急支援給付金【物価高騰対策給付金】', dept: '社会福祉課', ev: ['低所得世帯物価\n単 高騰緊急支援給\n1\n社会福祉課\n独 付金【物価高騰\n対策給付金】'], amount: { raw: 'R5.11.28\n\nR6.3.29\n\n294,371,169', value: '294,371,169' } },
    { name: '低所得世帯物価高騰緊急支援給付金（均等割のみ課税世帯分）【物価高騰対策給付金】', dept: '社会福祉課', ev: ['低所得世帯物価\n高騰緊急支援給\n単 付金（均等割の\n2\n社会福祉課\n独 み課税世帯分）\n【物価高騰対策\n給付金】'], warn: ONO_NOAMT },
    { name: '低所得世帯物価高騰緊急支援給付金（子育て世帯分）【物価高騰対策給付金】', dept: '社会福祉課', ev: ['低所得世帯物価\n高騰緊急支援給\n単\n3\n付金（子育て世帯 社会福祉課\n独\n分）【物価高騰対\n策給付金】'], warn: ONO_NOAMT },
  ] },
  { sourceId: '52cea90eeb3dda15264042cd', header: '令和6年度 物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証\n補\n計\n助\n番 画\n・\n号 書\n単\n№\n独\n\n1\n\n2', year: 2024, unit: '円', unitRaw: 'R7.2.13\n\n総事業費 うち交付金\n【実績額】 【実績額】\n（円）', amountKind: ONO_AMT, warnings: [ONO_WARN], rows: [
    { name: '低所得世帯物価高騰緊急支援給付金【物価高騰対策給付金】', dept: '社会福祉課', ev: ['低所得世帯物価\n単 高騰緊急支援給\n1\n社会福祉課\n独 付金【物価高騰\n対策給付金】'], warn: ONO_NOAMT },
    { name: '低所得者支援及び定額減税補足給付金支給事業', dept: '社会福祉課', ev: ['低所得者支援及\n単\nび定額減税補足 社会福祉課\n独\n給付金支給事業'], amount: { raw: '503,718,045\n\n調整給付金支給件数：9,051件', value: '503,718,045' } },
    { name: '低所得世帯物価高騰緊急支援給付金（総合経済対策分）', dept: '社会福祉課', ev: ['低所得世帯物価\n単 高騰緊急支援給\n社会福祉課\n独 付金（総合経済\n対策分）'], warn: ONO_NOAMT },
    { name: '物価高騰緊急支援プレミアム商品券事業', dept: '産業創造課', ev: ['物価高騰緊急支\n単\n援プレミアム商品 産業創造課\n独\n券事業'], amount: { raw: '138,865,455\n\n10,820,000\n\n125,000,000', value: '138,865,455' },
      inds: [ONO_SALES('（成果目標…商品券販売冊\n数：25,000冊/実績…商品券\n販売冊数：24,164冊）', '25,000冊', '24,164冊')] },
    { name: '物価高騰緊急支援プレミアム商品券拡充事業', dept: '産業創造課', ev: ['物価高騰緊急支\n単\n援プレミアム商品 産業創造課\n独\n券拡充事業'], amount: { raw: '138,865,455\n\n10,820,000\n\n125,000,000', value: '10,820,000' },
      inds: [ONO_SALES('（成果目標…商品券販売冊\n数：2,164冊/実績…商品券\n販売冊数：2,164冊）', '2,164冊', '2,164冊')] },
    { name: '物価高騰緊急支援プレミアム商品券拡大事業', dept: '産業創造課', ev: ['物価高騰緊急支\n単\n援プレミアム商品 産業創造課\n独\n券拡大事業'], amount: { raw: '138,865,455\n\n10,820,000\n\n125,000,000', value: '125,000,000' },
      inds: [ONO_SALES('（成果目標…商品券販売冊\n数：25,000冊/実績…商品券\n販売冊数：25,000冊）', '25,000冊', '25,000冊')],
      warn: 'プレミアム商品券3事業の総事業費・成果目標は表の行順（事業№11→12→13）で対応づけ、各事業概要の冊数（25,000冊／2,164冊／25,000冊）・総事業費と整合することを確認。' },
  ] },
];

// ---------------------------------------------------------------- 西原村（物価高騰対応重点支援地方創生臨時交付金活用事業一覧 令和5・6年度）
const NISHI_WARN = '物価高騰対応重点支援地方創生臨時交付金活用事業一覧の事業名・所管。年度は表題の年度（交付金の年度）を評価対象年度とした。事業費（円）は実績額か計画額かの表示がなく、事業期間が年度をまたぐものが多いため未収録。実施状況・効果の文章は行の対応が崩れているため未収録。';
const NISHI: DocSpec[] = [
  { sourceId: '3e72698151ad6ae31f76f3d4', header: '令和5年度 物価高騰対応重点支援地方創生臨時交付金活用事業一覧', year: 2023, warnings: [NISHI_WARN], rows: [
    { name: '低所得者世帯支援給付金（均等割非課税世帯分）【物価高騰対策給付金】', dept: '住民福祉課', ev: ['1\n\n低所得者世帯支援給付金\n（均等割非課税世帯分）\n【物価高騰対策給付金】\n\n住民福祉課'] },
    { name: '低所得者世帯支援給付金（均等割のみ課税世帯分）【物価高騰対策給付金】', dept: '住民福祉課', ev: ['2\n\n低所得者世帯支援給付金\n（均等割のみ課税世帯分）\n【物価高騰対策給付金】\n\n住民福祉課'] },
    { name: '低所得者世帯支援給付金（こども加算分）【物価高騰対策給付金】', dept: '住民福祉課', ev: ['3\n\n低所得者世帯支援給付金\n（こども加算分）\n【物価高騰対策給付金】\n\n住民福祉課'] },
    { name: '西原村暮らし応援商品券事業（第2弾）', dept: '企画商工課', ev: ['4\n\n西原村暮らし応援商品券事業\n（第2弾）\n\n企画商工課'] },
    { name: 'LPガス料金負担軽減支援事業（第2弾）', dept: '企画商工課', ev: ['5\n\nLPガス料金負担軽減支援事業\n（第2弾）\n\n企画商工課'] },
    { name: '西原村子ども習い事応援臨時給付金', dept: '教育委員会', ev: ['6\n\n西原村子ども習い事応援臨時給\n付金\n\n教育委員会'] },
    { name: 'Ｒ６計画低所得者世帯支援給付金（均等割のみ課税世帯分）事業（③新たな非課税となる世帯等への給付）', dept: '住民福祉課', ev: ['Ｒ６計画低所得者世帯支援給付\n金（均等割のみ課税世帯分）事業\n（③新たな非課税となる世帯等へ\nの給付）\n\n住民福祉課'] },
    { name: 'Ｒ６計画低所得者世帯支援給付金（こども加算分）（②こども加算）', dept: '住民福祉課', ev: ['Ｒ６計画低所得者世帯支援給付\n金（こども加算分）（②こども加算）\n\n住民福祉課'] },
    { name: 'Ｒ６計画低所得者世帯支援給付金（②こども加算）事務費', dept: '住民福祉課', ev: ['Ｒ６計画低所得者世帯支援給付\n金（②こども加算）事務費\n\n住民福祉課'] },
  ] },
  { sourceId: 'b7c18fbed7124b4d8728c3a6', header: '令和6年度 物価高騰対応重点支援地方創生臨時交付金活用事業一覧', year: 2024, warnings: [NISHI_WARN], rows: [
    { name: '低所得者世帯支援給付金（均等割非課税世帯分）【物価高騰対策給付金】', dept: '住民福祉課', ev: ['事業概要\n\n低所得者世帯支援給付金\n（均等割非課税世帯分）\n【物価高騰対策給付金】\n\n住民福祉課'] },
    { name: '定額減税補足給付金', dept: '税務課', ev: ['2-1 定額減税補足給付金\n\n税務課'] },
    { name: 'サツマイモ基腐病緊急対策補助金【物価高騰対応交付金】', dept: '産業課', ev: ['サツマイモ基腐病緊急対策補助\n金【物価高騰対応交付金】\n\n産業課'] },
  ] },
];

const specs = (list: DocSpec[]) => (i: CachedInput) => list.flatMap(s => fromSpec(i, s));
const kofu = specs(KOFU), komono = specs(KOMONO), higashi = specs(HIGASHI), ono = specs(ONO), nishi = specs(NISHI);
const neba = (i: CachedInput) => [...nebaPrice(i), ...nebaDengen(i)];
const muni = (one: (i: CachedInput) => ProjectEvaluation[]) => (input: CachedInput, inputs: CachedInput[]) => municipalityRecords(input, inputs, one, key);
let chikuseiInputs: CachedInput[] = [];
const chikuseiOne = (i: CachedInput) => chikusei(i, chikuseiInputs);

export const entries: Record<string, Entry> = {
  '31403': { extract: muni(kofu), scope: '物価高騰対応重点支援地方創生臨時交付金事業の実施状況/評価（令和5・6年度）の各事業について、事業名と決算額（実績）を構造化。事業評価の文章は列崩れのため対象外。年度の記載がない新型コロナ臨時交付金事業評価（令和2〜4年度）は対象外。' },
  '20410': { extract: muni(neba), scope: '電源立地地域対策交付金事業評価報告書（令和2〜4年度、保育所運営事業）の成果指標・前年度までの総事業費と、物価高騰対応重点支援臨時交付事業 使途・効果等一覧（令和5・6年度事業実績）の事業名・総事業費を構造化。高度無線環境整備の再評価・中間評価、地域公共交通の事業評価、コロナ交付金実績一覧、実施計画は対象外。' },
  '47359': { extract: muni(iheya), scope: '沖縄離島活性化推進事業費補助金検証シート（令和4年度繰越事業）の事業名・担当部課・成果目標（令和6年度）を構造化。事業名が抽出テキストで欠けているシート1件と、年度の帰属が確定しない予算・執行額は対象外。' },
  '08227': { extract: (input, inputs) => { chikuseiInputs = inputs; return municipalityRecords(input, inputs, chikuseiOne, key); },
    scope: '令和７年度行政評価の外部評価結果（令和６年度実施事業6件）の評価区分ごとの委員数と、外部評価対象事務事業一覧の担当課を構造化。委員コメント・事業説明資料（スライド）は対象外。' },
  '24341': { extract: muni(komono), scope: '物価高騰対応重点支援地方創生臨時交付金を活用した事業（令和5・6年度）のうち、事業の効果欄に成果指標の実績・目標値がある事業の事業名と指標を構造化。総事業費（実績か計画かの表示なし）、支給実績のみの給付事業、令和7年度一覧・実施計画は対象外。' },
  '05348': { extract: muni(mitane), scope: 'みらい創造プラン等の令和3年度検証事業結果一覧から、実施計画事業・行革項目ごとの事業名・担当課・一次評価結果（R3）を構造化。施策KPI検証結果（令和3〜6年度）と、列の対応が確定しない令和4年度事業検証一覧は対象外。' },
  '11369': { extract: muni(higashi), scope: '物価高騰対応重点支援地方創生臨時交付金 実施状況及び効果検証（令和5・6年度）の各事業の事業名・所管課と、支出実績の合計と一致し年度内に完了した事業の総事業費を構造化。成果目標・実績（指標）は列崩れのため対象外。' },
  '28218': { extract: muni(ono), scope: '物価高騰対応重点支援地方創生臨時交付金の実施状況及び効果検証（令和5・6年度）の事業名・担当部署、年度内に完了した事業の総事業費（実績額）、プレミアム商品券事業の販売冊数（目標・実績）を構造化。事務費のみの行と、令和7・8年度の交付金活用状況（概要）は対象外。' },
  '43432': { extract: muni(nishi), scope: '物価高騰対応重点支援地方創生臨時交付金活用事業一覧（令和5・6年度）の事業名・所管を構造化。事業費（実績か計画かの表示なし）と、行の対応が崩れた令和6年度の2-2〜2-4・7・R7計画分の行は対象外。' },
};
