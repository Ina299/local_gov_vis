/**
 * 小川町 第５次総合振興計画 事務事業評価シート（様式１、令和3・4・5年度。1資料1事業）から、公開済みの公表ページ一覧の
 * レコードを補強する金額を構造化する。事業コスト表は千円単位で、事業費内訳6行の和＝直接事業費合計、財源内訳5行の和＝合計、
 * 直接事業費合計＝合計 が全列で成り立つ場合に限り、各列の決算額（actual）・予算額（budget）を記録する。人件費・総事業費は
 * 総事業費＝直接事業費合計＋年間人件費 を満たす組が列ごとに一つに定まる場合のみ。
 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, digits } from '../batch8/h3-util';
import type { Entry } from '../batch9/i1-util';

/** 令和3〜5年度の評価シート PDF（公表ページの課別一覧からリンク）。令和7年度の2件は表の並びが異なるため対象外。 */
const SHEETS = new Set(`
  00d7de9a6e45673dba3a7519 01889cadbf3dd807a87b1c07 01b1855273bdb7acb578ca65 01f46b59bb0a2f5b76a19b2c 02952a2fb9728ac7e2d5fb90 02b85a6cbe031c15ca3b3209
  03231349e3d227da81254328 042025dcd6e4418fb62bf1c4 0475544199fcff343ae90837 05d142016d49eb10e771439f 065f1f0fe1da503f0eee4d22 06f7c8b8b4bed4d4201715e7
  0897bea130c2ffdeb76dfef8 08e4c26b4aa21d71310ee688 09042e442c309348485719c9 092f72312bf787c6bfb217ac 0b1b13e6b185a027c5ff17e5 0b898de63b30e06f95bd2a95
  0d24937f9cdd03dc451759ac 0e458393c12933a215fc4dd3 0e88a83c1927cfb7ba105418 0f23f44125b1569b2820b7c9 0f2a0cf0e89e435c27018147 104dda34cfac2722eed69bc7
  1335cf32d5fa75a33339addf 13713cb95f94bebc24dbfbb6 147582528fb36cdfc292ffe9 15b903f599cd8926334d5736 16a041619e0879900a10e235 1946474af1da9e6155566b18
  1c936983b4570aed567ac537 1d0f6d58f05de6286bfd52d7 1d47669d9d8194c8fc9cf12b 1e16bdafcca6e2264f33f6b2 22608e7b7e67639a3c8f3f13 228b4f0e7e3dc53af96077cf
  23cb7c319b09a87a1d9e06d1 23d840cd20ab47bcdceded3e 25724cf505fc23d8ecc31eb0 26a4c28a57a2edff2893446d 27d94aa35972e9fcb547779d 2945f769458943e1e1aba119
  2a5ffdfd8d67ff6b200df7f0 2c2062e5e707d55f314ae389 2cabb816c791d7cc3896810e 2d2a8a1d51fce4d147fe1905 2df29cc1bc8c01c5c2c91f1b 2e3e485b2d4b7a94956e2321
  2e9819f8b19e953b8107be61 2ef132439120bf8e32ecf101 2f43e276e38b939225f0057a 3146f91dcf1083c1405b334f 33c696b6764427d705ace03c 36acd46ed94025f49ceb58d1
  372e19111f1819502acfd565 37b3153c019ecd5ac3c7390c 387f67b2196aeb785d466a94 3a3320f7a169dffb2977bb08 3b552f8016c43c4cf9e96909 3c8ab8e731ec82355fbe6486
  3cd18fbc7fa701ec65fa7940 3f2fe425390cc4beeeb34934 422e718f336962917575052a 46ecd24f94de181b3180b80a 48c71bb2d537b969d904b4ab 4a0eb812e809c15226109ea8
  4a3983f889acfaab0bab2c49 4cde7cd93bc568ca41b82dc2 502be7fb45c28945ca9c2593 5124bc9b05f081a5163619a7 51552af0c1d7d4088063a67e 533238e7d85fd8d63f969fea
  53c95b776a026ba98d0db8ba 53d3ce1071a6df3e838d77d8 544a7fc07d7dd3f67c4046f0 550e0833a79addec52ab0b60 55aa5930732d60afad6714d6 560831b3eca8d43021f47b5d
  5847313b7471c1ec2cf74672 59c347ac59ec5e2a1990aa41 5e01c6abdf5acd027f83fe63 5fb1793484ca5c67f8c01625 6080d763eb16d84b5bc8ccb7 6104c8fb7806d24836b6f51e
  66960eebfc6d85757f0acf6e 669e9bd5d957308375932534 69135ce9e9d446921acd3ba7 6a0859c08117c9823f48b9c7 6b155df1d5cdc2e891a69e3b 6bd375c25340420ae41ea65e
  6c1082b31df7cd37463c7afd 6dce4dcf81891419578b4552 6fab9a64bb2c571d0c4f8d62 6fe127542df448dec1c5718f 701d688cb53bd603756e6b63 7043affd29f0da755ea09431
  7133fa37e4c84bcb9c0d3878 7145a2c11a1713a499dd0eed 717e8d502ffcba088b63bde4 71f7f2ae2238f91434e1b9bb 7200d66ff4636225d4813061 73b46df6c7dad3b8bb50868c
  74ec029a5be4e45abcb3dbfc 7657fd687e5944ab1109d7f3 7adce5d042e4339f8c05aee3 7bb48c411bb78923ba824bd9 7bbd307b88aa30df1358f89f 7c47d2634042834de1a91e10
  7d0d915a2c243edab84b9ea2 7f2ab3d602eeb2d3bfcf6ede 814026f08dbc6333baf2a1df 81995aa41e06bb54dd998a49 8228c37d2d3901e0f85308db 8317e67526c7ebdbdac77359
  8344aa86c2e84e95ec2467de 83ee234df75a96c7ed8e00e4 849117687e002dc20c40ad6d 85a9049767cd4c6b5f094476 85b386e81c9eeab85a26589e 85dd9c8ba2bae64f86f25e44
  87735d5a29654cb903407baa 883626781ea610a6189008f4 895d318335a5a77e95fbb281 8a7fccba6bd301a7cb99af20 8bfa4598c33e0f904a38cc35 8c7d47b745f210fc979b1cc9
  8d633a3b6d8aaa8419de8ada 8dca2ebcfb1cb91bb79fb993 8ea2b3fb59e21725a4e7b5f1 8fd9d8ea1eeafb4d9e75e5cd 91264a9dd14482135b86f574 91f5a65f7230cc8ae4907f7d
  94f34092665ca1215973b84d 94fa958918c589da27da5b80 97dab7cd454b598571a6b494 9862295d7b97f6bf14a0e85b 98cfdf9c45d09b6fb6dc18be 9971a4c1db9a88e66094522d
  99b5e4f6d051c78d802886e1 9a079cb25a87e498247fb044 9ae9824a3b8325097d6bf7b2 9ca126d366459680ea68d30f 9ce348c76debaaa6f4a0ba02 9d242555a1dc37e6e6326931
  a08878b493303641d28d33a1 a1bc9569e3e38dd0b23d1ce8 a25b7ffbcb7a5926cef1033e a2cb843940a850a099a00287 a5e6ca3e68ca702896de8225 a618d52afdf38b2034cd0be8
  a6656119bf4c3913025dd4a6 a712b2b8fdb7bf976919e24c a73f3263a72fc7cc77680875 a84ea0ba33816e5f72828e4d a867920873a371c0dae6eed6 ab8fd29acdfbee06e7369f3f
  ac1b102ec60bd826e5ba15ab acef7e1e9cdc110f4056cab4 b0f0335a6076481d529e659e b18a528a1fecb5e6182c47ad b1a91b50e0c8b1bc5a174f89 b25968aa8e6476ebeb9afe13
  b2983e3159047882a5e18775 b33221347b51c3e642061a8a b34c8fa267292a2af151e749 b4279fcf6e29b488bf8b93db b5b05984ee838a5c349a2abc bb2f6afedb422a62cb11b838
  bb35fb20792f31cb39e435a5 bb9eb242ff4f7648dd618dde bbd5edf980f759ddb2e27692 bc114b8038a739cf328c05ef bcc9cb7275c7052504822817 bcfe1a3103b5db1e02bce899
  bd167f69fc533e152381f2c5 c0aea21c64f5f74811411792 c22e4ce0187ce60d59a59c56 c32482b425ff2b1c5a37bd12 c373f738280b640742c095be c5500d96dd95aabe3e6f8f77
  c66bec7e32f2d56c81c97587 c6c3a0eb221c65cdecc2a831 c847b32004a8fc8cf489509d c91d94af38bd4be9d4c8e62f cbf61882fb2d20517e2c2c77 cc288fb85e2a3f1bc16879d8
  cc9b4ab04ae287f5fb952552 ccff12730b3041ee0968c5bc cdb83bfded2e10705e397301 d2a8afefe5429c00f0bc36d9 d345437d2296ade5706a355f d3603948ac76b666a7ddf0ad
  d61503f7db038fb66ab9fd04 d8f1a2a92dad3b4cfb4e6f0b da1e979b67e0401b555c2efd db0522280efece04ead47df2 dc0a5ff9a19afb76afbcc393 de161b0c523c1cd2c14d2137
  dfde43a738dfc8cfd7be6caf e0923519551d19ee7f7eb71a e21a8720d5f46b1abdd24007 e316c2ccb8864c79cc92e8e7 e4028b03a0821fcefec97436 e5495f54d49177f0854d52be
  e656a6dcdd00e715964c7860 e95661fa73accc0082d8be50 ea0f634062e90c0ceefdef45 ec5be04d862704c94d0be44a ecc494b7f68d30a93ce565e0 ecd20d6e327751b7895652a0
  ecde4f49a4976d7ff03e92f4 ed70cf30d320ed5d446338dc edafaa2afeb11177317188d1 ee162c673b67be6484b2f9cf ee9979b28cdaa8a550f084c9 ef1b0dd02a4b9656f6043cff
  f0810068b969dd8137bf062a f1abf197cec51dc9bf0de749 f1e79c2d55a594984f3fcacb f205cf41a816b21de85dbf42 f356500acb67dd9b16837d0b f457f95925ce783c2c0f6b2a
  f720fce226cfbfd5ace339a6 f7620992d9a7faac13e00a03 f7d8c9add5a447fdc2b22563 fad9b49ca19ab89e5e504753 fb65e6cbfdc263da3030c8dc fb997d89b67b935fac39a78b
  fc11fe61b3be1caa0cc1c111 fc6389a211860a5a3ff9b96d fc7f244a06d47419b4d210f1 fcd9917290182bb0d9548f84 fd6a6f4a3525196d863eaedc ffd9f87393992b7469be1f38
`.trim().split(/\s+/));

const NUM = /^-?\d{1,3}(?:,\d{3})*$/;
const toNum = (s: string) => Number(s.replace(/,/g, ''));
type Token = { raw: string; value: number; at: number };
type Column = { kind: 'actual' | 'budget'; fiscalYear: number };

function columns(head: string): Column[] | null {
  const cols: Column[] = [];
  for (const label of head.trim().split(/ +/)) {
    const m = /^([ＨHＲR])([元\d０-９]+)年度(決算|予算)$/.exec(label);
    if (!m) return null;
    cols.push({ kind: m[3] === '決算' ? 'actual' : 'budget', fiscalYear: (/[ＨH]/.test(m[1]) ? 1988 : 2018) + digits(m[2]) });
  }
  return cols;
}

/** Numeric lines from `from` until `stop` (exclusive), with absolute offsets. */
function tokens(text: string, from: number, stop: number): Token[] {
  const out: Token[] = [];
  let pos = from;
  for (const line of text.slice(from, stop).split('\n')) {
    if (NUM.test(line)) out.push({ raw: line, value: toNum(line), at: pos });
    pos += line.length + 1;
  }
  return out;
}

/**
 * 事業費内訳 e 行・直接事業費合計・財源内訳5行・合計 × k 列を、行順または列順に読む。内訳の和が両合計と一致し、両合計が等しい
 * 読み方のみ使う（事業費内訳の行数は様式により異なるため e = 1〜10 を試し、成り立つ読み方の合計が一致する場合に限る）。
 */
function costTable(nums: Token[], k: number): { totals: Token[]; end: number } | null {
  const found: { totals: Token[]; end: number }[] = [];
  for (let e = 1; e <= 10; e++) {
    const rowsN = e + 7;
    if (nums.length < rowsN * k) break;
    const layouts = [(r: number, c: number) => nums[r * k + c], (r: number, c: number) => nums[c * rowsN + r]];
    for (const cell of layouts) {
      const ok = Array.from({ length: k }, (_, c) => c).every(c => {
        const v = (r: number) => cell(r, c).value;
        const sum = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => v(from + i)).reduce((s, x) => s + x, 0);
        return sum(0, e) === v(e) && sum(e + 1, e + 6) === v(e + 6) && v(e) === v(e + 6);
      });
      if (ok) found.push({ totals: Array.from({ length: k }, (_, c) => cell(e, c)), end: nums[rowsN * k - 1].at });
    }
  }
  if (!found.length || found.some(f => f.end !== found[0].end || f.totals.some((t, c) => t.at !== found[0].totals[c].at))) return null;
  return found[0];
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11343' || !SHEETS.has(input.sourceId)) return [];
  const text = input.text;
  const years = [...text.matchAll(/(?:^|\n)令和\n\n([345])\n\n/g)];
  const heading = /４ 指標の検証（活動指標・成果指標）\n([^\n]+)\n指標名\n/.exec(text), budgetName = /\n④予算事業名 ([^\n]+)\n/.exec(text);
  // A heading may carry a bracketed note (（旧：…）, （総合戦略該当）); the sheet's own 予算事業名 is used when it is exactly the heading without that note.
  const name = heading && budgetName && heading[1].startsWith(budgetName[1]) && /^[（(][^（()）]*[）)]$/.test(heading[1].slice(budgetName[1].length))
    ? budgetName : heading ?? budgetName;
  const head = /\n((?:[ＨHＲR][元\d０-９]+年度(?:決算|予算) ?)+)\n/.exec(text);
  if (years.length !== 1 || !name || !head || !text.includes('第５次総合振興計画事務事業評価シート（様式１）')) return [];
  const year = 2018 + Number(years[0][1]);
  const cols = columns(head[1]);
  // The last column is the budget of the sheet's own year (令和N年度 sheet → RN年度予算).
  if (!cols || cols.at(-1)!.kind !== 'budget' || cols.at(-1)!.fiscalYear !== year || cols.slice(0, -1).some(c => c.kind !== 'actual')) return [];
  const yearAt = years[0].index! + (years[0][0].startsWith('\n') ? 1 : 0), headAt = head.index! + 1;
  const nameAt = name.index! + name[0].indexOf(name[1], name[0].indexOf('\n'));
  const p = project(input, `sheet:${input.sourceId}`, name[1].trim(), year, text.slice(yearAt, yearAt + years[0][0].trim().length), yearAt);
  p.evidence.push(evidence(input, '第５次総合振興計画事務事業評価シート（様式１）'), evidence(input, name[1], nameAt), evidence(input, head[1], headAt));
  p.warnings = [BASE_WARNING, '評価年度は様式見出しの「令和N年度」。evaluatedFiscalYear は資料に明記がないため null。'];
  const end = text.indexOf('４ 指標の検証', headAt);
  const nums = tokens(text, headAt + head[1].length, end < 0 ? text.length : end);
  const table = costTable(nums, cols.length);
  // Without a verified cost table the sheet has nothing to add to the published record.
  if (!table) return [];
  const span = (a: Token, b: Token) => text.slice(Math.min(a.at, b.at), Math.max(a.at + a.raw.length, b.at + b.raw.length));
  const amt = (kind: EvaluationAmount['kind'], fiscalYear: number, t: Token, raw: string, at: number): EvaluationAmount =>
    ({ kind, fiscalYear, amountYen: t.value * 1000, rawValue: t.raw, rawUnit: '千円', evidence: evidence(input, raw, at) });
  const totals = table.totals;
  cols.forEach((c, i) => p.amounts.push(amt(c.kind, c.fiscalYear, totals[i], span(totals[0], totals.at(-1)!), Math.min(totals[0].at, totals.at(-1)!.at))));
  // 人件費・総事業費: integer pairs after the table with 総事業費 − 年間人件費 = 直接事業費合計, unique per column and not shared between columns.
  const rest = nums.filter(t => t.at > table.end);
  const pairs = totals.map(d => d.value === 0 ? [] : rest.flatMap((pp, i) => rest.slice(i + 1).filter(tt => pp.value > 0 && tt.value === d.value + pp.value).map(tt => [pp, tt])));
  const flat = pairs.flat(2).map(t => t.at);
  if (pairs.every(c => c.length <= 1) && new Set(flat).size === flat.length) {
    cols.forEach((c, i) => {
      const pair = pairs[i][0];
      if (!pair) return;
      const raw = span(pair[0], pair[1]), at = Math.min(pair[0].at, pair[1].at);
      p.amounts.push(amt('personnel', c.fiscalYear, pair[0], raw, at), amt('fullCost', c.fiscalYear, pair[1], raw, at));
    });
  }
  p.warnings.push('金額は事業コスト表の直接事業費合計（千円。決算年度は actual、当年度予算は budget）。事業費内訳・財源内訳の和が合計と一致する列配置の場合のみ記録。人件費（年間人件費）・総事業費は、総事業費＝直接事業費合計＋年間人件費 を満たす数値の組が列ごとに一つに定まる場合のみ記録。');
  return [p];
}

export const ogawaEntry: Entry = {
  extract,
  scope: '小川町 第５次総合振興計画 事務事業評価シート（様式１、令和3・4・5年度）から事業名・評価年度と、事業コスト表の直接事業費合計（決算・予算、千円）および列が確定する人件費・総事業費を構造化（公開済みレコードの補強用）。指標表・項目別評価・方向性の判断は対象外。',
};
