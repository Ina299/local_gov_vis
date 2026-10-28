import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 武蔵村山市 令和６年度事務事業評価調書・補助金等評価調書（分野別PDF）
// 公開済みレコードは同じ調書から事業名・所管・年度だけを取ったもの。ここでは事業経費表の決算・予算と総コストを補う。
// 行政評価報告書（全調書の合冊、r6houkokusho_3.pdf）は再掲のため対象外。
const SOURCES = new Set([
  '805ba7e8277f09b779470d23', 'c0e3ec2c533595c03fa240fa', 'c5edd2c5e0bf1c6ca75756f2', '4889c2a87bdbef7811445ccb', '4dc860bdaa5d4a0569ed6a08',
  'aa8439b703f3aa6de50be9ae', 'cb0d2ce9ed1a36c744472a86', '47854fd281f711f9b0a50686', 'a4f621dd89551772f46655ee', '1cb6a28c6021dda493f8cd7f',
  'ee682c1b1f60d8bef58eb6cd', 'b24025c20029d47d96b468f2', 'ba1fec51185f1ea40b9431e7', '9a8769314aafbd06aa2c9b71', '981c1350aa52b43d564802d7',
  'a835f7d15d4e9270811e135e', '47dd608e4f7addbf7087c763',
]);
// 照合用の令和７年度調書（分野別PDF）。令和5年度決算は両年度の調書に載るため、列の対応付けの検証に使う。
const NEXT = new Set([
  '041b389bbf4cba07c08fc01a', '1037028c6cd1070c1030684a', '17141dfd11c5a33b1433b771', '3b959eb91487e297841d65a7', '40ead4b635855b2552920d44',
  '58ce020ee453df44b8ea2a50', '787c2c76eecb61e2c9683bf5', '7ec0fd183c0b0c70ec2c1082', '91ccf3553fc847361de2980b', '92e527bfdda8607476dd7631',
  '9c8ad2a7cb26137f61feedc7', '9e3e9c3873c7bca643cf4ca3', 'bcb63fd8f8de52e1316ce9bb', 'c33868a91a7f2ca448113b88', 'c3510e371e228c58680ad2c7',
  'cd8adfa3ac55db578085f803', 'd0605ba11c0bbc0d7335b8cf', 'e7986d825507bec1e0dba72b',
]);
const NEXT_HEAD = /(?:^|\n)(事務事業名|補助金等名) ([^\n]+)\n施策名称/g;
const NEXT_YEARS = '\n令和5年度決算 令和6年度決算 令和7年度予算\n\n';
const HEAD = /\n(事務事業名|補助金等名) ([^\n]+)\n(?:施策名称[^\n]*\n)?所管部署\n([^\n]*)\n([^\n]*)\n/g;
const YEARS = '\n令和4年度決算 令和5年度決算 令和6年度予算\n\n';
// 事業費(交付金額), 一般財源, 国都支出金, その他, 職員人件費, 所要人員, 会計年度任用職員人件費, 所要人員, 合計 の9行（1列分）。
const BLOCK = /^(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(\d+\.\d+)\n(-?[\d,]+)\n(\d+\.\d+)\n(-?[\d,]+)\n/;
const num = (s: string) => Number(s.replace(/,/g, ''));

/** 見出し直後に連続し、事業費＝財源内訳の合計・合計＝事業費＋人件費（2区分）で検算できる列ブロック（左から最大3列）。 */
function columns(sheet: string, years: string): { y: number; cols: RegExpMatchArray[] } | null {
  const y = sheet.indexOf(years);
  if (y < 0 || sheet.indexOf(years, y + 1) >= 0) return null;
  const cols: RegExpMatchArray[] = [];
  let at = y + years.length;
  while (cols.length < 3) {
    const m = sheet.slice(at).match(BLOCK);
    if (!m) break;
    const v = m.slice(1).map(num);
    if (v[0] !== v[1] + v[2] + v[3] || v[8] !== v[0] + v[4] + v[6]) break;
    cols.push(Object.assign(m, { index: at }));
    at += m[0].length;
    if (sheet.startsWith('\n', at)) at += 1; else break;
  }
  return { y, cols };
}

/** 令和７年度調書の事業名（補助金等名）ごとの令和5年度決算（左端列の事業費・交付金額）。 */
let nextCache: { inputs: CachedInput[]; values: Map<string, Set<string>> } | null = null;
function nextYear(inputs: CachedInput[]): Map<string, Set<string>> {
  if (nextCache?.inputs === inputs) return nextCache.values;
  const values = new Map<string, Set<string>>();
  for (const i of inputs) {
    if (!NEXT.has(i.sourceId)) continue;
    const heads = [...i.text.matchAll(NEXT_HEAD)];
    heads.forEach((h, k) => {
      const c = columns(i.text.slice(h.index!, heads[k + 1]?.index ?? i.text.length), NEXT_YEARS);
      if (!c?.cols.length) return;
      const key = `${h[1]}\n${h[2].trim()}`;
      values.set(key, new Set([...(values.get(key) ?? []), c.cols[0][1]]));
    });
  }
  nextCache = { inputs, values };
  return values;
}

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13223' || !SOURCES.has(input.sourceId) || input.truncated) return [];
  const t = input.text;
  if (!t.startsWith('武蔵村山市')) return [];
  const heads = [...t.matchAll(HEAD)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const subsidy = h[1] === '補助金等名';
    const from = h.index!, to = heads[k + 1]?.index ?? t.length, sheet = t.slice(from, to);
    const title = subsidy ? '令和６年度補助金等評価調書' : '令和６年度事務事業評価調書';
    const before = t.slice(Math.max(0, from - 200), from).lastIndexOf(title);
    const titleAt = before >= 0 ? Math.max(0, from - 200) + before : sheet.includes(title) ? from + sheet.indexOf(title) : -1;
    if (titleAt < 0) return;
    const name = h[2].trim(), nameRaw = `${h[1]} ${h[2]}`;
    const p = project(input, `補強:${title}:${name}`, name, 2024, nameRaw, from + 1);
    p.projectCode = null;
    p.evidence.push(evidence(input, title, titleAt));
    // 所管は公開済みレコードと同じ書き方（「〇〇部 〇〇課」）にし、同名事業の取り違えを防ぐ。
    const dep = /^(\S+) 部$/.exec(h[3]), sec = /^(\S+) 課$/.exec(h[4]);
    const depRaw = h[0].slice(h[0].indexOf('所管部署'), -1);
    if (dep) p.department = sec ? `${dep[1]}部 ${sec[1]}課` : `${dep[1]}部`;
    else if (/^\S+(事務局|委員会)$/.test(h[3])) p.department = h[3];
    if (p.department) p.evidence.push(evidence(input, sec ? depRaw : depRaw.split('\n').slice(0, 2).join('\n'), from + h[0].indexOf('所管部署')));
    const fy = sheet.indexOf('令和5年度の実績');
    if (!subsidy && fy >= 0) { p.evaluatedFiscalYear = 2023; p.evidence.push(evidence(input, '令和5年度の実績', from + fy)); }

    // 事業経費: 見出し直後に連続する列ブロックを左から令和4年度決算・令和5年度決算・令和6年度予算に対応付け、各列が
    // 事業費＝財源内訳の合計、合計＝事業費＋人件費（2区分）で検算できる場合だけ収録。見出しが調書内に一つだけの票に限る。
    const c = columns(sheet, YEARS);
    if (!c || c.cols.length < 2) return;
    const { y, cols } = c;
    // 同じ事業の令和７年度調書に令和5年度決算の列が取れる場合は、その値と一致しなければ列の対応を誤っているとみなす。
    const next = nextYear(inputs).get(`${h[1]}\n${name}`);
    if (next && (next.size !== 1 || !next.has(cols[1][1]))) return;
    // 補助金等評価調書は列順が崩れる票があるため、「交付団体等の令和５年度の市補助金の使途」の交付金額と令和5年度決算列の一致を条件にする。
    let use: { raw: string; at: number } | null = null;
    if (subsidy) {
      const u = sheet.match(/交付団体等の令和５年度の市補助金の使途\n交付金額（千円）\n(-?[\d,]+)\n/);
      if (!u || u[1] !== cols[1][1]) return;
      use = { raw: u[0].slice(0, -1), at: from + u.index! };
    }
    const ev = evidence(input, sheet.slice(y + 1, cols[cols.length - 1].index! + cols[cols.length - 1][0].length), from + y + 1);
    const add = (kind: EvaluationAmount['kind'], fiscalYear: number, rawValue: string) =>
      p.amounts.push({ kind, fiscalYear, amountYen: num(rawValue) * 1000, rawValue, rawUnit: '千円', evidence: ev });
    add('actual', 2022, cols[0][1]); add('fullCost', 2022, cols[0][9]);
    add('actual', 2023, cols[1][1]); add('fullCost', 2023, cols[1][9]);
    if (cols[2]) add('budget', 2024, cols[2][1]);
    if (use) p.evidence.push(evidence(input, use.raw, use.at));
    const label = subsidy ? '交付金額（千円）' : '事業費（千円）';
    p.warnings.push(`令和６年度${subsidy ? '補助金等' : '事務事業'}評価調書の事業経費表から、「令和4年度決算 令和5年度決算 令和6年度予算」見出し直後に連続する列ブロックを左から順に対応付け、${label}＝財源内訳合計、合計＝${label}＋人件費（職員・会計年度任用職員）が一致した列のみ収録。${subsidy ? '列順は「交付団体等の令和５年度の市補助金の使途」の交付金額と令和5年度決算列の一致で確認。' : ''}同じ事業の令和７年度調書で令和5年度決算の列が取れる場合は、その値との一致も条件とした。令和6年度予算の列が離れた位置に抽出されている票は令和6年度を未収録。人件費は2区分のため単独では未収録。評価指標表・今後の方向性は列対応が抽出テキストで失われているため未収録。`);
    out.push(p);
  });
  return out;
}

export const musashimurayama = {
  extract,
  scope: '武蔵村山市 令和６年度事務事業評価調書・補助金等評価調書（分野別PDF）の事業経費表（令和4・5年度決算と総コスト、令和6年度予算。検算一致列のみ）。公開済みレコードの補強用。合冊の行政評価報告書は対象外。',
};
