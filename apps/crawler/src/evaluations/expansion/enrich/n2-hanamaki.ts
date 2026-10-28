import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 花巻市「令和6年度 事業説明資料【事後評価】」
// 公開済みレコード（同じ取得分の「事務事業評価シート」から作成。評価区分のみで金額なし）と同じ事業の補強用。
// 事業説明資料の財源内訳表（単位:千円）から、当該年度（令和6年度）と前年度（令和5年度）の決算額を取る。
// 段組みで表の位置が一定しないため、次のどちらかで検算できたものだけ採用する。
//  (a) 見出し付きの「前年度 決算額」「当該年度 決算額」「決算額 前年比」がそろい、当該年度 − 前年度 ＝ 前年比。
//  (b) 国費・県費・地方債・その他・一般財源の5行（各行: 前年度・当該年度・前年比）が行ごとに差が合い、
//      列の合計が前年比の見出し値と合い、合計値が同じシート内に印字されている。見出しのある方はその値と一致すること。
// 「次年度 現計予算額」は値の列が確認できないため対象外。評価区分・指標は評価シート側にあり、ここでは扱わない。

const SOURCES = new Set(['01ba4287a860', '09567818c865', '0c3b8615acc9', '0d13aeefdf5d', '0d55a223d0e5', '0e3c9e27eddb', '0f1c4a58734e', '0f4d4c07d2e0',
  '11e6932f8fdd', '121cac86db23', '1727f5f9f765', '1b387ec8d229', '1ccde9da3d33', '1e8532b3f8bb', '23fbccfbfdd0', '2826eb515a96', '46bbda395a2e', '4813b79a6b36',
  '4d720379970e', '50cdd30d566b', '52215dcd76c5', '54fc4ab3abaf', '5be95613b006', '5bf3e789a8bd', '5f1d71a2b402', '5fd802e8288f', '6917dc8092cf', '6993f115aad9',
  '712f4f1ae372', '7189a57546e3', '76f0fc33fa5c', '7743778e1c8e', '79bb23fa6c18', '7aa1db8c8cbd', '7cb08e190381', '7e7b015233a4', '85ec0b973c1d', '860f3d33e176',
  '87c9e34b66f9', '90325571a79f', '9102a76526b0', '979bce644853', '9ae2c221616e', '9c02c5bf1059', 'a595d44a0f1f', 'aee52ecf426e', 'af11d02d6e79', 'b62631b7e1f1',
  'c10cb66d5077', 'c499f65a641d', 'c939ccc2051b', 'cb2dbcaaacb6', 'd205f2706f51', 'd215d2f471e5', 'd38a8bae0a74', 'd620db7248e9', 'dd96c520fe16', 'e0848819c663',
  'e0b26962e5cd', 'e248dc10cc3a', 'eb37ee04160a', 'ed34d2e740d5', 'f29ba5ed41d3', 'f50da68a056a', 'f80ae0cc8fc6', 'fd020e8883e9']);
const HEAD = '令和6年度\n事業説明資料\n\n【事後評価】\n';
const FUNDS = ['国費', '県費', '地方債', 'その他', '一般財源'];
const NUM = String.raw`(-?(?:\d{1,3}(?:,\d{3})+|\d+))`;
const num = (s: string) => Number(s.replace(/,/g, ''));
const fmt = (n: number) => n.toLocaleString('en-US');

function sheet(input: CachedInput, at: number, sh: string): ProjectEvaluation | null {
  if (!sh.includes('\n担当部署\n')) return null;
  const code = /^令和6年度\n事業説明資料\n\n【事後評価】\n\n会計\n\n款\n\n項\n\n目\n\n事業コード\n\n\d\d\n\n\d\d\n\n\d\d\n\n\d\d\n\n([0-9A-Z]{6})\n/.exec(sh);
  const foot = /\n([^\n]+?)(?: |\n\n)事業説明資料\s*$/.exec(sh);
  if (!code || !foot) return null;
  const name = foot[1].trim();
  if (!name || !sh.slice(0, foot.index).includes(`\n${name}\n`)) return null;

  const label = (re: RegExp) => { const m = re.exec(sh); return m && sh.indexOf(m[0], m.index + 1) < 0 ? { v: num(m[1]), raw: m[0].trimEnd(), at: m.index } : null; };
  const cur = label(new RegExp(String.raw`当該年度\n決算額\n${NUM}\n`)), prev = label(new RegExp(String.raw`前年度\n決算額\n${NUM}\n`));
  const diff = label(new RegExp(String.raw`前年比\n${NUM}\n`));
  if (!diff) return null;
  let r6: { v: number; raw: string; at: number } | null = null, r5: { v: number; raw: string; at: number } | null = null;
  if (cur && prev && cur.v - prev.v === diff.v) { r6 = cur; r5 = prev; }
  else {
    // 各行は「見出し・前年度・当該年度・前年比」。s・e は見出しから最後の値までの位置。
    const row = (re: RegExp, skip = 0) => {
      const m = re.exec(sh); if (!m) return null;
      const raw = m[0].slice(1, -1);
      return { s: m.index + 1, e: m.index + 1 + raw.length, v: m.slice(1 + skip, 4 + skip).map(num) };
    };
    const triple = String.raw`\n\n${NUM}\n\n${NUM}\n\n${NUM}\n`;
    const rows = FUNDS.map(l => row(new RegExp(String.raw`\n${l}${triple}`)));
    // 一般財源の見出しが離れて印字される段組みでは、その他の行の直後に続く3値を一般財源の行とする（行・列の検算は同じ）。
    rows[4] ??= row(new RegExp(String.raw`\nその他${triple}\n${NUM}\n\n${NUM}\n\n${NUM}\n`), 3);
    if (rows.some(r => !r) || FUNDS.some(l => sh.split(`\n${l}\n`).length !== 2)) return null;
    const ok = rows as { s: number; e: number; v: number[] }[];
    if (!ok.every(r => r.v[2] === r.v[1] - r.v[0])) return null;
    const p = ok.reduce((a, r) => a + r.v[0], 0), c = ok.reduce((a, r) => a + r.v[1], 0);
    if (c - p !== diff.v || (cur && cur.v !== c) || (prev && prev.v !== p)) return null;
    if (!sh.includes(`\n${fmt(c)}\n`) || !sh.includes(`\n${fmt(p)}\n`)) return null;
    const s = Math.min(...ok.map(r => r.s)), e = Math.max(...ok.map(r => r.e));
    const table = { raw: sh.slice(s, e), at: s };
    r6 = cur ?? { v: c, ...table }; r5 = prev ?? { v: p, ...table };
  }
  const p = project(input, code[1], name, null, code[0], at);
  p.evaluatedFiscalYear = 2024;
  p.evidence.push(evidence(input, foot[0].trim(), at + foot.index + foot[0].indexOf(foot[0].trim())));
  const amount = (fy: number, x: { v: number; raw: string; at: number }): EvaluationAmount =>
    ({ kind: 'actual', fiscalYear: fy, amountYen: x.v * 1000, rawValue: fmt(x.v), rawUnit: '千円', evidence: evidence(input, x.raw, at + x.at) });
  p.amounts.push(amount(2024, r6), amount(2023, r5));
  p.evidence.push(evidence(input, diff.raw, at + diff.at));
  p.warnings.push('事業説明資料の財源内訳表（単位:千円）の決算額。当該年度＝令和6年度、前年度＝令和5年度。前年比・財源別内訳との一致で検算済み。次年度現計予算額は列が確定しないため対象外。');
  return p;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03205' || input.format !== 'pdf' || input.truncated || !SOURCES.has(input.sourceId.slice(0, 12))) return [];
  if (!input.text.startsWith(HEAD)) return [];
  const starts = [...input.text.matchAll(/令和6年度\n事業説明資料\n\n【事後評価】\n/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const p = sheet(input, s, input.text.slice(s, starts[i + 1] ?? input.text.length));
    if (p) out.push(p);
  });
  // 同じ資料内で同じ事業コードの財源表が2つ以上あれば判別できないため全部捨てる。
  return out.filter(p => out.filter(o => o.projectCode === p.projectCode).length === 1);
}

export const entry = { extract, scope: '花巻市 令和6年度 事業説明資料【事後評価】の財源内訳表（決算額、令和5・6年度）。公開済みの事務事業評価シート由来レコードの補強用。' };
