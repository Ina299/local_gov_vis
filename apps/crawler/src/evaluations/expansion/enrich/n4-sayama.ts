import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 狭山市 令和２年度行政評価 事務事業評価表（r2_gyoseihyoka.files/r2-*.pdf、1票1事業）
// 公開済みレコードは第一次評価結果一覧（r2hyoka.pdf）から事業名・評価だけを取ったもの。同じ事業の評価表から金額・指標を補う。
// 評価表の表題は「令和元年度」（対象年度）だけなので、評価年度は実施結果ページ（r2_gyoseihyoka.html）の表題
// 「令和2年度行政評価（事務事業評価）実施結果」と、そのページの施策別一覧に「事業名(所管課)」が載っていることで確定する。
const PAGE = 'eed8ae779a779f2edfcca64f';
const PAGE_TITLE = '令和2年度行政評価（事務事業評価）実施結果';
const SHEETS = new Set([
  '01435e31d3b32e61a0471f61', '033ba9f420acd9ddd9e2413b', '04a2430b6245e918a95a3d93', '06439639617e0d644a804e6a', '09d08d9c7f3e6698758bafca',
  '0b7975a24c76c96030a42c4c', '0c50aeb47cfaf9e65f963738', '0ef2fa9cb0e7d497270f4d80', '20cecd5056792870e59f1861', '24332a9daf014c5a2320b8bc',
  '29d02649cf7dad25632e84d7', '2ca07343021ae55899d92429', '3034c03734865313a252779a', '3deb115f1e91d31250175a49', '44fe03c5455800e00ab39c0e',
  '4b968112626718e24a26314e', '4ee42b68f5436586b3847bc2', '501af98cd388e719b2ed3116', '53d2e6226983cb0434d028a9', '56b2ad3334c4051bc3a79c6d',
  '58d11a1c8ab0f8977fd80e1e', '5b06afde5eca4dcfd83168be', '5d4f324323a1b413637c557c', '5ff41cc2fbf3965093055d48', '60014bbbc6a0e31fbb47a6bb',
  '6403418d7c0ee76f79157db7', '686d75d50777f085fc4eb739', '7d02bb8bd4f3780786f873c5', '7e3440438e9f28b5b0a8edc5', '8110f15ca1c6d1e9ae482d54',
  '83dc6fd762c92ccb186a1a37', '877e83b0d9f6feb2546196d3', '88bc989c3509c10f1aef53e7', '89bd68eee0982b2ddc5f1860', '908d61a213f69d673f8cec13',
  '942d0765992f27d3916e1397', 'a3d04c14ec7b04cbf37ccef8', 'a565e33af22301396ed21574', 'a98a509aedb15f8333a7c714', 'abdaf42ba93948fd30afc7b2',
  'afcbfd976e71ae6030126452', 'b575c4c08190bf96607c4f03', 'b6719dda5ba30a220e5d04b4', 'c0921b5be22a158268fdb3d9', 'c34b6c310c57dff2357adf8f',
  'c3b603317f9ce533061528fe', 'c5992c4ad77007cab2a90cb5', 'd208b0ab9f800d15bd53a5a3', 'd2d112c0c3f88b88eaa78a81', 'd3456c5d6682774a78cb8463',
  'd5bbd4b3fb662411cd200a5a', 'dacad08124fde201753c65d9', 'dd70df82447746cfec66ac15', 'ddf599ad5e1818644ce89d50', 'e020ff848e0c8a610ae66f87',
  'e59e3bfabe51fd0de07131c9', 'e856c7d5c9d9c2b3a7cf9d2a', 'eba6039dce1258297f11882b', 'ebc96f8b67f074eea157fa9c', 'f3371c761ba4769b7a7e5f9b',
  'f4b8ceeaf1ac8c36fe8681fb', 'fa1438824fbcb01b579ba7ea', 'fb4094a4e23e8b91a05f295c', 'fc3058b0965015378b33e633', 'fd3939fcf63628cd384b57c4',
]);
const HEAD = /事務事業評価表\n\n令和元年度\n(\d{6})\n\n事務\n事業\n区分\n\n所属 (\S+) (\S+)\n\n([^\n]+)\n\n事業区分\n/g;
const FORM = /^(直営|一部委託|全部委託|委託|補助|指定管理|負担|その他)/;
const yen = (s: string) => Number(s.replaceAll(',', ''));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '11215' || !SHEETS.has(input.sourceId) || input.truncated) return [];
  const page = inputs.find(i => i.sourceId === PAGE);
  if (!page || page.truncated || !page.text.startsWith(PAGE_TITLE)) return [];
  const text = input.text, heads = [...text.matchAll(HEAD)];
  // 見出しの並びが崩れた票があると票の切り分けを誤るため、その資料は丸ごと対象外。
  if (!heads.length || heads.length !== text.split('事務事業評価表').length - 1) return [];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, end = k + 1 < heads.length ? heads[k + 1].index! : text.length, block = text.slice(start, end);
    const at = (raw: string, from = 0) => { const i = block.indexOf(raw, from); return evidence(input, raw, start + i); };
    const name = h[4].trim(), sec = h[3];
    // 実施結果ページの一覧で、評価表の施策番号の見出し配下に「事業名(所管課)」が一つだけ載っていること。
    const policies = [...block.matchAll(/\n施策 (\d+)(?: [^\n]*)?\n/g)];
    if (policies.length !== 1) return;
    const policy = policies[0];
    const sect = page.text.match(new RegExp(`\\n施策${policy[1]}\\n[^\\n]+\\n(?:(?!施策\\d)[^\\n]*\\n)*?評価表ダウンロード`));
    if (!sect) return;
    const listed = [...sect[0].matchAll(new RegExp(`\\n${esc(name)}\\(${esc(sec)}[)）]\\n`, 'g'))];
    if (listed.length !== 1) return;
    const p = project(input, `補強:${h[1]}`, name, 2020, h[0].slice(0, -'\n\n事業区分\n'.length), start);
    p.department = `${h[2]} ${sec}`; p.evaluatedFiscalYear = 2019;
    p.evidence.push(evidence(page, PAGE_TITLE, 0));
    p.evidence.push(evidence(page, listed[0][0].slice(1, -1), sect.index! + listed[0].index! + 1));
    p.evidence.push(evidence(input, policy[0].slice(1, -1), start + policy.index! + 1));

    // 金額: 予算額・決算額（令和元年度）と、予定値・確定値の 直接事業費＋人件費＝総額 が両方とも検算できる場合の確定値の人件費・総額。
    const budget = block.match(/事務事業費予算額\n\n([\d,]+) 円\n/), actual = block.match(/事務事業費決算額\n\n([\d,]+) 円\n/);
    const cost = block.match(/予定値\n\n確定値\n\n直接事業費\n\n([\d,]*) ?円\n\n直接事業費\n\n([\d,]*) ?円\n\n人件費\n\n([\d,]+) 円\n\n人件費\n\n([\d,]+) 円\n\n総額\n\n([\d,]+) 円\n\n総額\n\n([\d,]+) 円/);
    if (budget) p.amounts.push({ kind: 'budget', fiscalYear: 2019, amountYen: yen(budget[1]), rawValue: budget[1], rawUnit: '円', evidence: at(budget[0].trimEnd()) });
    if (actual) p.amounts.push({ kind: 'actual', fiscalYear: 2019, amountYen: yen(actual[1]), rawValue: actual[1], rawUnit: '円', evidence: at(actual[0].trimEnd()) });
    if (cost) {
      const [, dPlan, dFix, pPlan, pFix, tPlan, tFix] = cost;
      const okPlan = (dPlan ? yen(dPlan) : 0) + yen(pPlan) === yen(tPlan) && (dPlan ? dPlan === budget?.[1] : !budget);
      const okFix = (dFix ? yen(dFix) : 0) + yen(pFix) === yen(tFix) && (dFix ? dFix === actual?.[1] : !actual);
      if (okPlan && okFix) {
        const ev = at(cost[0]);
        p.amounts.push({ kind: 'personnel', fiscalYear: 2019, amountYen: yen(pFix), rawValue: pFix, rawUnit: '円', evidence: ev });
        p.amounts.push({ kind: 'fullCost', fiscalYear: 2019, amountYen: yen(tFix), rawValue: tFix, rawUnit: '円', evidence: ev });
      }
    }

    // 指標: 実施形態の行の直後の成果指標1行と、その直後に単独で続く活動指標１（活動指標２がない票のみ）。値は単一の数値＋単位。
    const lines = block.split('\n'), first = lines.findIndex(l => l.startsWith('令和元年度実績'));
    const val = (l: string) => l.match(/^令和元年度実績：\s*([0-9０-９][0-9０-９,，.．]*)\s*([^\s0-9０-９、，,（(]{1,6})$/);
    if (first >= 2 && FORM.test(lines[first - 2]) && lines[first - 2].length <= 30 && !/活動指標/.test(lines[first - 1])) {
      const v = val(lines[first]), raw = `${lines[first - 1]}\n${lines[first]}`;
      if (v && lines[first - 1].trim() && lines[first - 1].trim() !== '設定なし')
        p.indicators.push({ name: lines[first - 1].trim(), fiscalYear: 2019, target: null, actual: v[1], unit: v[2], evidence: at(raw) });
      const act = lines[first + 1]?.match(/^[（(]活動指標１[）)](.+)$/), av = lines[first + 2] ? val(lines[first + 2]) : null;
      if (act && av && !block.includes('活動指標２'))
        p.indicators.push({ name: act[1].trim(), fiscalYear: 2019, target: null, actual: av[1], unit: av[2], evidence: at(`${lines[first + 1]}\n${lines[first + 2]}`) });
    }
    if (!p.amounts.length && !p.indicators.length) return;
    p.warnings.push('評価表の表題は「令和元年度」（対象年度）。評価年度は、実施結果ページ「令和2年度行政評価（事務事業評価）実施結果」の評価表一覧に同じ施策番号の下で「事業名(所管課)」が載っていることで令和2年度とした。金額は予算額・決算額（令和元年度）と、直接事業費＋人件費＝総額の検算が予定値・確定値とも一致した場合のみ確定値の人件費・総額（確定値の人件費は原文上「R2 事務分担表による人数」に基づく）。指標は実績値が単一の数値＋単位の行のみ。評価（必要性・効率性・方向性）は一覧の公開済みレコードにあるため収録しない。');
    out.push(p);
  });
  return out;
}

export const sayama = {
  extract,
  scope: '狭山市 令和２年度行政評価の事務事業評価表（個票PDF、対象年度=令和元年度）から予算・決算・人件費・総額と単一値の成果/活動指標。評価年度は実施結果ページの評価表一覧で確定できる事業のみ。公開済みレコードの補強用。',
};
