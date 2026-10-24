import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, nfkc, num, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

// 第5回取得（2026-10-24）分のうち、地方創生臨時交付金の実施状況・効果検証表、企業版ふるさと納税の評価検証シート、
// 農山漁村振興交付金の評価シートの交付対象事業（個別事業）単位の記録。

/** 「R4.4」「R3.4.1」形式の日付の会計年度（4月始まり）。 */
function fiscalOf(d: string): number | null {
  const m = /^R(\d+)\.(\d+)(?:\.\d+)?$/.exec(d);
  if (!m) return null;
  const y = 2018 + Number(m[1]), mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? (mo >= 4 ? y : y - 1) : null;
}
/** 始期・終期が同じ会計年度に収まる場合だけその年度。 */
function sameFiscal(from: string, to: string): number | null {
  const a = fiscalOf(from), b = fiscalOf(to);
  return a !== null && a === b ? a : null;
}
/** 事業名（改行・列の混入を除いて整えた名前）の文字が原文の中に順に現れること。 */
function subsequence(name: string, raw: string): boolean {
  const n = nfkc(name), r = nfkc(raw);
  let j = 0;
  for (const ch of r) if (ch === n[j]) j++;
  return j === n.length;
}
/** 本文中で from 以降に raw が最初に現れる位置（無ければ例外）。 */
function after(input: CachedInput, raw: string, from: number): number {
  const i = input.text.indexOf(raw, from);
  if (i < 0) throw new Error(`fragment not found: ${raw.slice(0, 30)}`);
  return i;
}
/** 行頭の日付（「R6.2」の後が改行または空白）を from 以降で探す。 */
function dateAfter(input: CachedInput, d: string, from: number): number {
  const re = new RegExp(`(?<=\\n)${d.replace(/\./g, '\\.')}(?=[\\n ])`, 'g');
  re.lastIndex = from;
  const m = re.exec(input.text);
  if (!m) throw new Error(`date not found: ${d}`);
  return m.index;
}

/* ---------- 15586 粟島浦村 新型コロナ交付金 実施状況および効果検証結果（令和2〜5年度） ---------- */

const AWASHIMA: Record<string, string> = {
  'ff49c273c08580e97fd634b7': '【令和２年度】新型コロナウイルス感染症対応地方創生臨時交付金 実施状況および効果検証結果',
  '150e002cc4486ade76b36d78': '【令和３年度】新型コロナウイルス感染症対応地方創生臨時交付金 実施状況および効果検証結果',
  'b2d2b7ce6b6cb6f0ceeffb1e': '【令和４年度】新型コロナウイルス感染症対応地方創生臨時交付金 実施状況および効果検証結果',
  'fd04f1d3ccc7928d20dfd37c': '【令和５年度】新型コロナウイルス感染症対応地方創生臨時交付金 実施状況および効果検証結果',
};
const AWA_DEPT = /^[^\s\d,]+(?:課|室|委員会)$/;

function awashimaura(input: CachedInput): ProjectEvaluation[] {
  const title = AWASHIMA[input.sourceId];
  if (!title || !input.text.startsWith(title)) return [];
  const t = input.text;
  // 行見出し「No 事業名」（1行に収まるもの）と、事業開始・完了・総事業費以下の数値の並び。
  const heads = [...t.matchAll(/(?<=\n)(\d{1,2}) ([^\n\d/-][^\n]*)\n/g)]
    .map(m => ({ no: Number(m[1]), name: m[2].trim(), start: m.index!, raw: m[0].slice(0, -1) }))
    .filter(h => h.name.length >= 4 && /(事業|給付金|補助金|交付金)/.test(h.name));
  const blocks = [...t.matchAll(/(?<=\n)(R\d\.\d{1,2}(?:\.\d{1,2})?)\n\n(R\d\.\d{1,2}(?:\.\d{1,2})?)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)(?=\n)/g)]
    .map(m => ({ start: m.index!, raw: m[0], from: m[1], to: m[2], total: m[3], parts: [m[4], m[5], m[6], m[7]] }))
    .filter(b => num(b.total) === b.parts.reduce((s, x) => s + num(x), 0)); // 総事業費＝国庫＋その他＋交付金＋一般財源 の検算
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const p = project(input, `${h.no}:${h.name}`, h.name, null, h.raw, h.start);
    p.projectCode = null;
    p.evidence.push(evidence(input, title, 0));
    const deptLine = /^\n\n([^\n]+)\n/.exec(t.slice(h.start + h.raw.length));
    if (deptLine && AWA_DEPT.test(deptLine[1])) { p.department = deptLine[1]; p.evidence.push(evidence(input, deptLine[1], h.start + h.raw.length + 2)); }
    // 数値の並びは、その行見出しと次の行見出しの間にちょうど1つあり、前後の見出しの番号が連番の場合だけ対応づける。
    // 第1行だけは数値の並びが見出しより前に出る資料があるため、表の先頭から第2見出しまでに1つだけある場合に対応づける。
    const next = heads[i + 1], prev = heads[i - 1];
    const hi = next?.start ?? t.length, lo = i === 0 ? 0 : h.start;
    const own = blocks.filter(b => b.start > lo && b.start < hi);
    const consecutive = (!next || next.no === h.no + 1) && (!prev || prev.no === h.no - 1) && (i > 0 || h.no === 1);
    let note = '事業開始・完了年月日と総事業費の欄は列の並びが崩れており、この行との対応が確定しないため未収録。評価対象年度も未設定。';
    if (consecutive && own.length === 1) {
      const b = own[0], fy = sameFiscal(b.from, b.to);
      p.evidence.push(evidence(input, b.raw, b.start));
      if (fy !== null) {
        p.evaluatedFiscalYear = fy;
        p.amounts.push(amount(input, 'actual', fy, b.total, '円', b.raw, b.start));
        note = `事業開始（${b.from}）・事業完了（${b.to}）が同じ会計年度に収まるため、その年度を評価対象年度とし、総事業費（円）を実績として収録（総事業費＝国庫補助額＋その他財源＋交付金充当額＋一般財源の検算一致）。`;
      } else note = `事業期間（${b.from}〜${b.to}）が会計年度をまたぐため、評価対象年度・総事業費は未設定。`;
    }
    p.warnings.push(`粟島浦村 ${title}の交付対象事業の行。事業名は1行に収まる見出しのみ。表題の年度は交付金の年度で、評価実施年度の明示はないため評価年度は未設定。`,
      `${note}成果および効果は文章のため未構造化。`);
    out.push(p);
  });
  return out;
}

/* ---------- 38386 久万高原町 臨時交付金 実施事業一覧、評価表（令和5年度コロナ・令和5年度物価高騰・令和6年度物価高騰） ---------- */

type KRow = { no: string; raw: string; name: string; dates: [string, string] };
/** dateColumns: 始期が行の順にすべて並んだ後に終期が並ぶページ（それ以外は行ごとに始期・終期の順）。 */
type KPage = { rows: KRow[]; totals: string | null; dateColumns?: true };
const KUMA: Record<string, { title: string; grand: string | null; pages: KPage[]; noAmount?: string }> = {
  '4e9bb621674975e54fbc11f0': {
    title: '令和５年度 新型コロナウイルス感染症対応地方創生臨時交付金実施事業一覧、評価表', grand: '102,353,331',
    pages: [
      { totals: '49,830,000\n\n1,805,393\n\n38,561,938', dateColumns: true, rows: [
        { no: '1', raw: '非課税世帯等臨時特別支\n援事業（令和五年度愛媛\n県久万高原町電力・ガ\nス・食料品等価格高騰重\n点支援給付金）【低所得\n者世帯給付金】', name: '非課税世帯等臨時特別支援事業（令和五年度愛媛県久万高原町電力・ガス・食料品等価格高騰重点支援給付金）【低所得者世帯給付金】', dates: ['R5.6', 'R6.2'] },
        { no: '2', raw: '非課税世帯等臨時特別支\n援事業（令和五年度愛媛\n県久万高原町電力・ガス・\n食料品等価格高騰重点支\n援給付金）（事務費）', name: '非課税世帯等臨時特別支援事業（令和五年度愛媛県久万高原町電力・ガス・食料品等価格高騰重点支援給付金）（事務費）', dates: ['R5.6', 'R6.2'] },
        { no: '8', raw: '久万高原町物価高騰対応\n等消費活性化支援事業\n（令和５年度）（商品券発行\n等事業分）', name: '久万高原町物価高騰対応等消費活性化支援事業（令和５年度）（商品券発行等事業分）', dates: ['R5.6', 'R6.2'] },
      ] },
      { totals: '11,803,000\n\n353,000', rows: [
        { no: '9', raw: '原油高騰対策事業者経営\n支援事業', name: '原油高騰対策事業者経営支援事業', dates: ['R5.12', 'R6.3'] },
        { no: '10', raw: '原油高騰対策公共交通事\n業者経営支援事業', name: '原油高騰対策公共交通事業者経営支援事業', dates: ['R5.12', 'R6.3'] },
      ] },
    ],
  },
  'ca2916fe637fbe68c9f8d596': {
    title: '令和５年度 物価高騰対応重点支援地方創生臨時交付金実施事業一覧、評価表', grand: '184,167,941',
    pages: [
      { totals: '116,796,927\n\n24,338,305\n\n7,704,393\n\n1,633,000\n\n0', rows: [
        { no: '1', raw: '非課税世帯等臨時特別支援事業（令\n和五年度愛媛県久万高原町電力・ガ\nス・食料品等価格高騰重点支援給付\n金）【低所得者世帯給付金（第２\n弾）】', name: '非課税世帯等臨時特別支援事業（令和五年度愛媛県久万高原町電力・ガス・食料品等価格高騰重点支援給付金）【低所得者世帯給付金（第２弾）】', dates: ['R6.1', 'R6.3'] },
        { no: '2', raw: '物価高騰対応重点支援地方創生臨時\n一体支援 交付金事業【令和五年度均等割のみ\n課税給付】', name: '物価高騰対応重点支援地方創生臨時交付金事業【令和五年度均等割のみ課税給付】', dates: ['R6.2', 'R6.3'] },
        { no: '3', raw: '物価高騰対応重点支援地方創生臨時\n一体支援 交付金事業【低所得子育て世帯加算\n給付】', name: '物価高騰対応重点支援地方創生臨時交付金事業【低所得子育て世帯加算給付】', dates: ['R6.3', 'R6.3'] },
        { no: '10', raw: '子育て世帯物価高騰対策支援事業', name: '子育て世帯物価高騰対策支援事業', dates: ['R6.2', 'R6.3'] },
        { no: '11', raw: 'こども園に対する物価高騰対策支援事\n業', name: 'こども園に対する物価高騰対策支援事業', dates: ['R6.2', 'R6.3'] },
      ] },
      { totals: '27,847,986\n\n0\n\n3,850,720\n\n593,250\n\n443,480', rows: [
        { no: '12', raw: 'プレミアム商品券発行事業', name: 'プレミアム商品券発行事業', dates: ['R6.2', 'R6.10'] },
        { no: '13', raw: '障がい者施設に対する物価高騰対策\n支援事業', name: '障がい者施設に対する物価高騰対策支援事業', dates: ['R6.2', 'R6.3'] },
        { no: '14', raw: '介護サービス事業所等に対する物価\n高騰対策支援事業', name: '介護サービス事業所等に対する物価高騰対策支援事業', dates: ['R6.2', 'R6.3'] },
        { no: '15', raw: '養護老人ホームに対する物価高騰対\n策支援事業', name: '養護老人ホームに対する物価高騰対策支援事業', dates: ['R6.2', 'R6.3'] },
        { no: '16', raw: '病院施設に対する物価高騰対策支援\n事業', name: '病院施設に対する物価高騰対策支援事業', dates: ['R6.2', 'R6.3'] },
      ] },
      { totals: '959,880', rows: [
        { no: '17', raw: '老人保健施設に対する物価高騰対策\n支援事業', name: '老人保健施設に対する物価高騰対策支援事業', dates: ['R6.2', 'R6.3'] },
      ] },
    ],
  },
  'ae53e6c15ac89e66b58dd514': {
    title: '令和６年度 物価高騰対応重点支援地方創生臨時交付金実施事業一覧、評価表', grand: null,
    noAmount: '総事業費の欄は行ごとに他の列と混在して並ぶため（また No.8 は令和7年度へ繰り越した事業費を含む旨の注記があるため）金額は未収録。',
    pages: [
      { totals: null, rows: [
        { no: '2', raw: '一体支援\n・令和６年度新たな低所得者支援給付\n金事業\n・令和６年度定額減税補足給付金（調\n整給付金）事業', name: '一体支援・令和６年度新たな低所得者支援給付金事業・令和６年度定額減税補足給付金（調整給付金）事業', dates: ['R6.2', 'R7.1'] },
        { no: '8', raw: '住民税非課税世帯物価高騰支援給付\n金事業', name: '住民税非課税世帯物価高騰支援給付金事業', dates: ['R7.2', 'R7.3'] },
        { no: '12', raw: '久万高原町介護サービス事業所等物\n価高騰対策支援金交付事業', name: '久万高原町介護サービス事業所等物価高騰対策支援金交付事業', dates: ['R7.2', 'R7.5'] },
      ] },
    ],
  },
};

function kumakogen(input: CachedInput): ProjectEvaluation[] {
  const spec = KUMA[input.sourceId];
  if (!spec || !input.text.startsWith(spec.title)) return [];
  const t = input.text;
  const pageStarts: number[] = [];
  for (let i = t.indexOf(spec.title); i >= 0; i = t.indexOf(spec.title, i + 1)) pageStarts.push(i);
  if (pageStarts.length !== spec.pages.length) return [];
  const out: ProjectEvaluation[] = [];
  let sum = 0;
  spec.pages.forEach((page, pi) => {
    const pStart = pageStarts[pi], pEnd = pageStarts[pi + 1] ?? t.length;
    let cur = pStart;
    const found = page.rows.map(r => { const at = after(input, r.raw, cur); cur = at + r.raw.length; return at; });
    // 総事業費（A）の列: 事業名の後に行の順で連続して並ぶ値。
    let totals: { raw: string; start: number }[] = [];
    if (page.totals) {
      const at = after(input, page.totals, cur);
      let off = at;
      totals = page.totals.split('\n\n').map(raw => { const s = t.indexOf(raw, off); off = s + raw.length; return { raw, start: s }; });
      if (totals.length !== page.rows.length) throw new Error('row/total count mismatch');
      cur = at + page.totals.length;
      sum += totals.reduce((s, x) => s + num(x.raw), 0);
    }
    // 事業始期・終期の列: 行の順に並ぶ（総事業費の列が連続しないページでは各行の事業名の後）。
    if (!page.totals) cur = found[0];
    let dates: number[][];
    if (page.dateColumns) {
      const starts = page.rows.map(r => { const a = dateAfter(input, r.dates[0], cur); cur = a + r.dates[0].length; return a; });
      dates = page.rows.map((r, i) => { const b = dateAfter(input, r.dates[1], cur); cur = b + r.dates[1].length; return [starts[i], b]; });
    } else dates = page.rows.map(r => { const a = dateAfter(input, r.dates[0], cur); const b = dateAfter(input, r.dates[1], a + r.dates[0].length); cur = b + r.dates[1].length; return [a, b]; });
    if (cur > pEnd) throw new Error('fragments run past the page');
    page.rows.forEach((r, i) => {
      if (!subsequence(r.name, r.raw)) throw new Error(`name not in raw: ${r.name}`);
      const p = project(input, `${r.no}:${r.name}`, r.name, null, r.raw, found[i]);
      p.projectCode = null;
      p.evidence.push(evidence(input, spec.title, pStart), evidence(input, r.dates[0], dates[i][0]), evidence(input, r.dates[1], dates[i][1]));
      const fy = sameFiscal(r.dates[0], r.dates[1]);
      p.evaluatedFiscalYear = fy;
      let note: string;
      if (spec.noAmount) note = spec.noAmount;
      else if (fy === null) note = `事業期間（${r.dates[0]}〜${r.dates[1]}）が会計年度をまたぐ（繰越）ため、評価対象年度・総事業費は未設定。`;
      else if (num(totals[i].raw) === 0) note = '総事業費が「0」（効果欄に事業実施に至らなかった旨の記載）のため金額は未収録。';
      else {
        p.amounts.push(amount(input, 'actual', fy, totals[i].raw, '円', totals[i].raw, totals[i].start));
        note = '総事業費（A）（円）は、事業始期・終期が同じ会計年度に収まるため、その年度の実績として収録。表の総事業費の合計が冒頭の合計額と一致することを確認。';
      }
      p.warnings.push(`久万高原町 ${spec.title}の交付対象事業の行（No.${r.no}）。事業名はPDFの改行を除き、枠（区分）の列の文字を除いて収録。評価対象年度は事業始期・終期が同じ会計年度に収まる場合のみ設定し、評価実施年度は明示がないため未設定。`,
        `${note}交付金充当経費・事業の概要・効果・成果目標は未構造化。`);
      out.push(p);
    });
  });
  if (spec.grand && sum !== num(spec.grand)) throw new Error('grand total mismatch');
  if (spec.grand) after(input, spec.grand, 0);
  return out;
}

/* ---------- 35305 周防大島町 物価高騰対応臨時交付金に係る検証（令和5年度・令和6年度） ---------- */

/** until: 事業名が概要の列と行単位で混在する場合の事業名末尾の文字列（根拠はそこまで）。 */
type SRow = { raw: string; until?: string; name: string; dept: string | null };
const SUO: Record<string, { title: string; rows: SRow[] }> = {
  '3f7795880bd4f1cdd31c250d': { title: '令和５年度\n\n物価高騰対応重点支援地方創生臨時交付金に係る検証', rows: [
    { raw: '低所得世帯物価高騰\n重点支援事業【住民\n1 税非課税世帯給付\n金】【物価高騰対策給\n付金】', name: '低所得世帯物価高騰重点支援事業【住民税非課税世帯給付金】【物価高騰対策給付金】', dept: '福祉課' },
    { raw: '低所得世帯物価高騰\n重点支援事業【住民\n税非課税世帯（家計\n7\n急変世帯分）給付金】\n【物価高騰対策給付\n金】', name: '低所得世帯物価高騰重点支援事業【住民税非課税世帯（家計急変世帯分）給付金】【物価高騰対策給付金】', dept: '福祉課' },
    { raw: '低所得世帯物価高騰\n重点支援事業【住民\n9 税非課税世帯（家計\n急変世帯分）給付金】\n事務費分', name: '低所得世帯物価高騰重点支援事業【住民税非課税世帯（家計急変世帯分）給付金】事務費分', dept: '福祉課' },
    { raw: '10 自治会活動支援事業', name: '自治会活動支援事業', dept: '政策企画課' },
    { raw: '水道事業特別会計繰\n11 出金（水道使用料金\n減免事業）', name: '水道事業特別会計繰出金（水道使用料金減免事業）', dept: '水道課' },
    { raw: '下水道事業特別会計\n12 繰出金（エネルギー価\n格高騰対策）', name: '下水道事業特別会計繰出金（エネルギー価格高騰対策）', dept: '下水道課' },
    { raw: '病院事業特別会計繰\n', until: '\n高騰対策）', name: '病院事業特別会計繰出金（エネルギー価格高騰対策）', dept: '病院事業局' },
  ] },
  '930d96bc7274af16eaeab35f': { title: '令和6年度\n\n物価高騰対応重点支援地方創生臨時交付金に係る検証', rows: [
    { raw: '給付金・定額減税\n一体支援事業（物 福祉課\n価高騰対策給付\n税務課\n金）', name: '給付金・定額減税一体支援事業（物価高騰対策給付金）', dept: null },
    { raw: '病院事業特別会計\n繰出金（エネル\n13\n病院事業局\nギー価格等高騰対\n策）', name: '病院事業特別会計繰出金（エネルギー価格等高騰対策）', dept: '病院事業局' },
  ] },
};
SUO['d2bf8a0cbbbae0917299ae8c'] = SUO['930d96bc7274af16eaeab35f'];

function suoOshima(input: CachedInput): ProjectEvaluation[] {
  const spec = SUO[input.sourceId];
  if (!spec || !input.text.startsWith(spec.title)) return [];
  const out: ProjectEvaluation[] = [];
  let cur = spec.title.length;
  // 担当課の列は事業名の列の後に行の順で並ぶ（令和5年度は福祉課×3・水道課・下水道課が独立した行、政策企画課・病院事業局は概要の行頭に混在）。
  const deptAt = new Map<SRow, number>();
  const names = spec.rows.map(r => { const at = after(input, r.raw, cur); cur = at + r.raw.length; return at; });
  let dcur = names[0];
  for (const r of spec.rows) {
    if (!r.dept) continue;
    const inRaw = r.raw.indexOf(r.dept);
    const at = inRaw >= 0 ? names[spec.rows.indexOf(r)] + inRaw : after(input, r.dept, dcur);
    deptAt.set(r, at);
    if (inRaw < 0) dcur = at + r.dept.length;
  }
  spec.rows.forEach((r, i) => {
    let raw = r.raw, start = names[i];
    // 令和5年度 No.13 の事業名は概要の列と同じ行に混在して続くため、事業名末尾「高騰対策）」までを根拠とする。
    if (r.until) { const end = after(input, r.until, start) + r.until.length; raw = input.text.slice(start, end); }
    else raw = raw.replace(/\n$/, '');
    if (!subsequence(r.name, raw)) throw new Error(`name not in raw: ${r.name}`);
    const p = project(input, r.name, r.name, null, raw, start);
    p.projectCode = null;
    p.evidence.push(evidence(input, spec.title, 0));
    if (r.dept) { p.department = r.dept; p.evidence.push(evidence(input, r.dept, deptAt.get(r)!)); }
    p.warnings.push(`周防大島町 ${spec.title.replace('\n\n', ' ')}の交付対象事業の行。事業名はPDFの改行と混入した実施計画No.・担当課・概要の文字を除いて収録。`,
      `表題の年度は交付金の年度で、事業ごとの実施期間の欄がないため評価年度・評価対象年度は未設定。総事業費・交付金充当経費は列の並びが行と1対1に確定しない資料があるため未収録。${r.dept ? '' : '担当課は福祉課・税務課の2課が事業名の列に混在して記載されるため未設定。'}取組状況・事業の効果・今後の方向性は文章のため未構造化。`);
    out.push(p);
  });
  return out;
}

/* ---------- 46304 十島村 企業版ふるさと納税 対象事業 評価検証シート（令和4・5年度） ---------- */

function toshima(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const title = /^令和([４５])年度 地方創生応援税制（企業版ふるさと納税）対象事業 評価検証シート/.exec(t);
  if (!title || !['cb54b923b37607e24d62a74f', 'e318d0b804634a9ea09eaf24'].includes(input.sourceId)) return [];
  const era = '０１２３４５'.indexOf(title[1]), fy = 2018 + era;
  const ref = new RegExp(`参考：令和${title[1]}年度実施事業`).exec(t);
  const nm = /対象事業名 ([^\n]+)\n/.exec(t);
  if (!ref || !nm) return [];
  const name = nm[1].trim();
  const p = project(input, name, name, null, nm[0].slice(0, -1), nm.index);
  p.projectCode = null; p.evaluatedFiscalYear = fy;
  p.evidence.push(evidence(input, title[0], 0), evidence(input, ref[0], ref.index));
  const kpi = /移住者数（本事業が起因）[\s\S]*?\n\n(\d+名（[^）]*）)\n\n(３世帯[６９]名(?:（R7\.1月末現在）)?)\n/.exec(t);
  if (kpi) p.indicators.push({ name: '移住者数（本事業が起因）', fiscalYear: null, target: kpi[1].replace(/\n/g, ''), actual: kpi[2], unit: null, evidence: evidence(input, kpi[0].slice(0, -1), kpi.index) });
  const st = /\n\n(地方創生に相当程\n度効果があった。)\n/.exec(t);
  if (st) p.ratings.push({ kind: 'self', label: '達成状況', value: st[1].replace(/\n/g, ''), scale: null, evidence: evidence(input, st[1], st.index + 2) });
  p.warnings.push(`十島村 令和${era}年度 企業版ふるさと納税 対象事業 評価検証シート。シートの「参考：令和${era}年度実施事業」を評価対象年度とし、評価実施年度は本文が途中で切れているため未設定。`,
    'KPIの目標値・実績値は原文どおり（改行のみ除去）。実績値の時点は原文の括弧書き（ある場合）による。実績値の内訳（島別）は未構造化。KPIの年度は明示がないため未設定。',
    '事業費（円）は寄附金額と同額で予算・決算の区別と年度が明示されないため未収録。効果検証委員会での評価（委員の人数別の評価）・意見・今後の方針は列が混在するため未構造化。');
  return [p];
}

/* ---------- 01398 喜茂別町 農山漁村振興交付金（山村活性化対策）評価シート・評価結果（令和元〜3年度） ---------- */

const KIMO_SHEETS: Record<string, string> = {
  '4addcbae1448f51b78a70136': '令和元年度',
  'ed6d6db61a69b98e5b739dca': '令和２年度',
  '681b930a86f50f9a6eaea594': '令和３年度',
};
const KIMO_NAME = '農山漁村振興交付金（山村活性化対策）';

function kimobetsu(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const era = KIMO_SHEETS[input.sourceId];
  if (!era) return [];
  const t = input.text;
  const head = `${KIMO_NAME} 評価シート`;
  const period = new RegExp(`事業実施期間（${era}）`).exec(t);
  if (!t.includes(head) || !period) return [];
  const fy = era === '令和元年度' ? 2019 : 2018 + '０１２３'.indexOf(era[2]);
  const p = project(input, KIMO_NAME, KIMO_NAME, null, head, t.indexOf(head));
  p.projectCode = null; p.evaluatedFiscalYear = fy;
  p.evidence.push(evidence(input, period[0], period.index));
  // 事業実施期間（年月日）が同じ会計年度内のときだけ、事業費（うち国費）を実績として収録。
  const cost = /３．事業費（うち国費）\n\n([0-9０-９,，]+)円（([0-9０-９,，]+)円）/.exec(t);
  const dates = /\n\n((令和(?:元|[0-9０-９]+)年)([0-9０-９]+)月[0-9０-９]+日～(令和(?:元|[0-9０-９]+)年)([0-9０-９]+)月[0-9０-９]+日)\n/.exec(t);
  const yr = (s: string) => 2018 + (s.includes('元') ? 1 : Number(nfkc(s).replace(/\D/g, '')));
  const fis = (y: string, m: string) => { const mo = Number(nfkc(m)); return mo >= 4 ? yr(y) : yr(y) - 1; };
  if (cost && dates && fis(dates[2], dates[3]) === fy && fis(dates[4], dates[5]) === fy) {
    p.evidence.push(evidence(input, dates[1], dates.index + 2));
    p.amounts.push(amount(input, 'actual', fy, cost[1], '円', cost[0], cost.index));
  }
  // 同じ年度の「事業実施主体 評価結果」（別紙１）の評価区分。
  const result = inputs.find(i => i.text.includes(`${era} ${KIMO_NAME}\n事業実施主体 評価結果`));
  const rm = result && /評 価\n\n([ABCＡＢＣ])\n/.exec(result.text);
  const scaleRaw = '（注２） 「評価」の区分： Ａ・・優良 Ｂ・・良好 Ｃ・・低調';
  if (result && rm && result.text.includes(scaleRaw)) {
    p.ratings.push({ kind: 'self', label: '評価（事業実施主体 評価結果）', value: rm[1], scale: 'Ａ・・優良 Ｂ・・良好 Ｃ・・低調', evidence: evidence(result, rm[0].slice(0, -1), rm.index) });
    p.evidence.push(evidence(result, `${era} ${KIMO_NAME}\n事業実施主体 評価結果`));
  }
  p.warnings.push(`喜茂別町 ${KIMO_NAME} 評価シート（任意評価様式第１号、${era}の事業実施期間）。評価対象年度はシートの「事業実施期間（${era}）」。評価実施年度は明示がないため未設定。事業名は交付金名（取組振興山村名：喜茂別町）。`,
    '事業費（うち国費）は、事業実施期間の始期・終期が同じ会計年度に収まる場合のみ、その年度の実績として収録。評価区分は同じ年度の「事業実施主体 評価結果」（別紙１）の値を原文の区分（Ａ・・優良 Ｂ・・良好 Ｃ・・低調）のまま収録（評価シート側の○印は抽出テキストで失われているため不使用）。評価理由・助言のコメントは未構造化。');
  return [p];
}

/** 同じ資料群の再掲は値の一致を確認して統合し、同名で年度不明などにより同一事業か確定できない記録はすべて除外する。 */
const one = (f: (i: CachedInput) => ProjectEvaluation[]) => (input: CachedInput, inputs: CachedInput[]) =>
  municipalityRecords(input, inputs, f, p => `${p.projectName}|${p.evaluatedFiscalYear}`);

export const dEntries: Record<string, Entry> = {
  '15586': { extract: one(awashimaura), scope: '粟島浦村 新型コロナウイルス感染症対応地方創生臨時交付金 実施状況および効果検証結果（令和2〜5年度）の交付対象事業の行（1行に収まる事業名・担当課、事業期間が単一年度で検算の合う行の総事業費）。列が崩れた行の金額、成果の文章、事前評価チェックシート・社会資本総合整備計画事後評価・計画書・令和7年度実施計画は対象外。' },
  '38386': { extract: one(kumakogen), scope: '久万高原町 臨時交付金 実施事業一覧、評価表（令和5年度コロナ・令和5年度物価高騰・令和6年度物価高騰）の交付対象事業名・事業始期/終期と、単一年度の事業の総事業費。令和2〜4年度の一覧（列が崩れて事業名と他列が混在）、公表及び効果検証の総評文書、交付金充当経費・効果の文章は対象外。' },
  '35305': { extract: one(suoOshima), scope: '周防大島町 物価高騰対応重点支援地方創生臨時交付金に係る検証（令和5年度・令和6年度）の交付対象事業名と担当課。総事業費・交付金充当経費（列と行の対応が確定しない）、取組状況・効果・今後の方向性の文章は対象外。' },
  '46304': { extract: toshima, scope: '十島村 企業版ふるさと納税 対象事業 評価検証シート（令和4・5年度実施事業）の事業名・評価対象年度・KPI（移住者数）の目標値/実績値・達成状況。事業費・寄附金額、効果検証委員会の評価と意見、今後の方針は対象外。' },
  '01398': { extract: kimobetsu, scope: '喜茂別町 農山漁村振興交付金（山村活性化対策）評価シート（令和元〜3年度）の事業実施年度・事業費（うち国費）と、同じ年度の事業実施主体 評価結果の評価区分（A/B/C）。評価理由・第三者意見の文章は対象外。' },
};
export const entries = dEntries;
