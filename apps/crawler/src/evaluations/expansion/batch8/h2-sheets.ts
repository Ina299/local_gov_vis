import type { EvaluationAmount, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const NUM = '(?:\\d{1,3}(?:,\\d{3})*|\\d+)';
const isNum = (s: string) => new RegExp(`^${NUM}(?:\\.\\d+)?$`).test(s);
const toNum = (s: string) => Number(s.replaceAll(',', ''));
const ensureNoCode = (p: ProjectEvaluation) => { p.projectCode = null; return p; };

// ---------------------------------------------------------------------------
// 27218 大東市 実施計画事業調書 令和７年度（決算）
// ---------------------------------------------------------------------------
const DAITO_SOURCE = 'c07f7eebe43b6c808e715289';
/**
 * 「３．事業費等」の列（令和５・６・７年度（決算））と値の対応。抽出テキストでは列の並びが崩れている
 * （例: 防災対策事業は令和６年度の列が先に出る）ため、同一バイト（sha256一致）の PDF を pdftotext -layout で
 * 抽出して表頭の位置から確定した値。抽出器は各値が当該シートの事業費等の欄に行として存在し、
 * 列ごとに 事業費計a＋人件費計b＝総事業費 が成立する場合だけ使う。
 * [事業費計a, 人件費計b, 総事業費a+b] × [R5, R6, R7]
 */
const DAITO_VERIFIED: Record<string, [string, string, string][]> = {
  '防災訓練事業': [['188', '11,265', '11,453'], ['142', '11,943', '12,085'], ['311', '13,859', '14,170']],
  '防災対策事業': [['117,100', '10,182', '127,282'], ['110,341', '10,584', '120,925'], ['39,774', '10,993', '50,767']],
  '自主防災組織育成事業': [['1,252', '5,957', '7,209'], ['3,263', '6,195', '9,458'], ['1,464', '6,304', '7,768']],
  '全世代地域市民会議運営事業': [['9,124', '5,798', '14,922'], ['8,929', '6,061', '14,990'], ['9,849', '6,357', '16,206']],
  '市制施行７０周年記念推進事業': [['0', '0', '0'], ['0', '0', '0'], ['22', '893', '915']],
  '総合計画・総合戦略推進事業': [['3,213', '12,770', '15,983'], ['6,177', '13,319', '19,496'], ['11,012', '13,824', '24,836']],
  '大東の魅力づくり事業（秘書広報）': [['2,904', '5,917', '8,821'], ['1,374', '8,778', '10,152'], ['2,180', '13,839', '16,019']],
  '市民相談事業': [['3,790', '10,236', '14,026'], ['3,906', '9,174', '13,080'], ['3,982', '7,414', '11,396']],
  '広報だいとう発行事業': [['31,845', '22,777', '54,622'], ['31,444', '23,767', '55,211'], ['33,019', '17,546', '50,565']],
  '公民連携総合調整事業': [['13,446', '13,977', '27,423'], ['1', '8,370', '8,371'], ['1,980', '9,606', '11,586']],
  '北条まちづくり推進事業（公共）': [['91,733', '6,339', '98,072'], ['91,126', '5,706', '96,832'], ['90,037', '8,482', '98,519']],
  '北条まちづくり推進事業（Ⅱ期）': [['19,398', '21,552', '40,950'], ['21,131', '20,628', '41,759'], ['7,524', '24,553', '32,077']],
  '財産活用推進事業（地方創生）': [['93,553', '8,029', '101,582'], ['4,832', '8,339', '13,171'], ['17,511', '9,375', '26,886']],
  '行政サービスデジタル化推進事業': [['29,586', '35,498', '65,084'], ['28,514', '35,112', '63,626'], ['25,182', '35,712', '60,894']],
  '新庁舎整備推進事業': [['9,690', '21,131', '30,821'], ['2,217', '26,334', '28,551'], ['14,917', '35,712', '50,629']],
  '職員研修事業': [['3,526', '8,452', '11,978'], ['2,966', '8,778', '11,744'], ['2,901', '8,928', '11,829']],
  '議会だより発行事業': [['2,627', '3,381', '6,008'], ['2,705', '3,511', '6,216'], ['2,909', '3,571', '6,480']],
};

function daitoExtract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27218' || input.sourceId !== DAITO_SOURCE) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(/実施計画事業調書\n令和７年度（決算）\n事業名\n\n[^\n]+\n\n([^\n]+)\n/g)];
  const seen = new Set<string>();
  heads.forEach((m, k) => {
    const from = m.index!, to = k + 1 < heads.length ? heads[k + 1].index! : t.length;
    const s = t.slice(from, to), name = m[1];
    if (seen.has(name)) return; seen.add(name);
    const p = ensureNoCode(project(input, name, name, 2025, m[0], from));
    p.evaluatedFiscalYear = 2025;
    const dept = s.match(/所属\n\n([^\n]+)\n/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0], from + dept.index!)); }
    p.warnings.push('評価年度・評価対象年度は表題「実施計画事業調書 令和７年度（決算）」と事業費等の「令和７年度（決算）」列から判断。');
    const verified = DAITO_VERIFIED[name];
    const c0 = s.indexOf('３．事業費等'), c1 = s.indexOf('(2)評価指標');
    let note = '事業費等の表は列（年度）の対応が抽出テキストから確定できないため金額を転記していません。';
    if (verified && c0 >= 0 && c1 > c0) {
      const sec = s.slice(c0, c1), lines = new Set(sec.split('\n'));
      const ok = verified.every(([a, b, tot]) => lines.has(a) && lines.has(b) && lines.has(tot) && toNum(a) + toNum(b) === toNum(tot))
        && sec.includes('令和５年度\n（決算）') && sec.includes('令和６年度\n（決算）') && sec.includes('令和７年度\n（決算）');
      if (ok) {
        const ev = evidence(input, sec, from + c0);
        verified.forEach(([a, b, tot], y) => {
          for (const [kind, v] of [['actual', a], ['personnel', b], ['fullCost', tot]] as const)
            p.amounts.push({ kind, fiscalYear: 2023 + y, amountYen: toNum(v) * 1000, rawValue: v, rawUnit: '千円', evidence: ev });
        });
        note = '金額は「３．事業費等」の事業費計a（actual）・人件費計b（personnel）・総事業費a+b（fullCost）を令和５～７年度（決算）について転記。抽出テキストでは列の並びが崩れているため、同一ファイル（sha256一致）のPDFのレイアウト抽出で表頭と値の列対応を確認し、各値が本文の事業費等欄に存在し a＋b＝総事業費 が成立することを確認したもののみ。根拠には事業費等欄全体を記録。';
      }
    }
    p.warnings.push(note, '評価指標（目標・実績）は指標名と値の行対応が抽出テキストで崩れているため転記していません。関連する施策KPI・自己点検の文章も対象外。');
    out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------------------
// 37206 さぬき市 第2次さぬき市総合計画後期基本計画実施計画／事務事業評価調書（1事業2ページ）
// ---------------------------------------------------------------------------
const SANUKI_SOURCE = 'b3ccbd608e9ff96612884e77';
const SANUKI_HEAD = '第2次さぬき市総合計画後期基本計画実施計画／事務事業評価調書\n';
const SANUKI_ITEMS = ['①事業目的の妥当性', '②行政関与の必要性', '③事業内容の妥当性', '④政策効果の有効性', '⑤事業経費の妥当性', '⑥政策効果の効率性', '⑦受益･費用負担の妥当性', '⑧受益者負担の公平性'];
const SANUKI_SCORE: Record<string, string> = { '◎': '5', '○': '4', '△': '2', '×': '1' };
const SANUKI_DIRECTIONS = new Set(['継続', '拡大', '縮小', '統合', '終了', '廃止', '休止', '完了', '見直し']);
const GROUP = `\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n\\n(${NUM})\\n`;

type Page = { from: number; to: number; text: string; name: string; nameRaw: string; nameAt: number; kind: 'cost' | 'eval' | null };

function sanukiPages(t: string): Page[] {
  const starts = [...t.matchAll(new RegExp(SANUKI_HEAD, 'g'))].map(m => m.index!);
  return starts.map((from, k) => {
    const to = k + 1 < starts.length ? starts[k + 1] : t.length, text = t.slice(from, to);
    const nm = text.match(/\n(?:事業名 )?([^\n]+)\n基本目標\n/);
    const kind = text.includes('当初予算額') && text.includes('決算額') ? 'cost' : text.includes('評価基準') ? 'eval' : null;
    const nameRaw = nm ? nm[0].slice(1, nm[0].length - '\n基本目標\n'.length) : '';
    return { from, to, text, name: nm ? nm[1] : '', nameRaw, nameAt: nm ? from + nm.index! + 1 : -1, kind };
  });
}

function sanukiAmounts(input: CachedInput, page: Page): EvaluationAmount[] | null {
  const s = page.text, plan = [...s.matchAll(/計画額/g)].map(m => m.index!);
  if (plan.length !== 4) return null;
  const out: EvaluationAmount[] = [];
  const check = (g: RegExpMatchArray) => g.slice(1, 5).reduce((x, v) => x + toNum(v), 0) === toNum(g[5]);
  for (let y = 0; y < 3; y++) {
    const segStart = plan[y], seg = s.slice(segStart, plan[y + 1]);
    const budget = [...seg.matchAll(new RegExp('当初予算額' + GROUP, 'g'))], settled = [...seg.matchAll(new RegExp('決算額' + GROUP, 'g'))];
    if (budget.length !== 1 || (y < 2 && settled.length !== 1)) return null;
    const rows: [EvaluationAmount['kind'], RegExpMatchArray][] = [['budget', budget[0]]];
    if (y < 2) rows.push(['actual', settled[0]]);
    for (const [kind, g] of rows) {
      if (!check(g)) return null;
      const raw = g[0].replace(/\n$/, '');
      out.push({ kind, fiscalYear: 2023 + y, amountYen: toNum(g[5]) * 1000, rawValue: g[5], rawUnit: '千円', evidence: evidence(input, raw, page.from + segStart + g.index!) });
    }
  }
  return out;
}

function sanukiRatings(input: CachedInput, page: Page): EvaluationRating[] {
  const s = page.text, ratings: EvaluationRating[] = [], syms: string[] = [];
  const endMark = s.indexOf('必要性\n\n事\n業\nの\n評\n価');
  SANUKI_ITEMS.forEach((item, k) => {
    const a = s.indexOf(item), b = k < 7 ? s.indexOf(SANUKI_ITEMS[k + 1]) : endMark;
    if (a < 0 || b <= a || s.indexOf(item, a + 1) >= 0) return;
    const found = [...s.slice(a, b).matchAll(/\n([◎○△×])\n/g)];
    if (found.length !== 1) return;
    const at = a + found[0].index! + 1;
    syms[k] = found[0][1];
    ratings.push({ kind: 'self', label: item, value: found[0][1], scale: null, evidence: evidence(input, s.slice(a, at + 1), page.from + a) });
  });
  const score = s.match(/\n\n((?:\d\n){7}\d)\n\n(\d+)\n/);
  if (score && syms.filter(Boolean).length === 8) {
    const each = score[1].split('\n');
    if (each.every((v, k) => SANUKI_SCORE[syms[k]] === v) && each.reduce((x, v) => x + Number(v), 0) === Number(score[2]))
      ratings.push({ kind: 'self', label: '総合点', value: score[2], scale: null, evidence: evidence(input, score[0].slice(2, -1), page.from + score.index! + 2) });
  }
  const a = s.indexOf('改善の\n必要性'), b = s.indexOf('評価理由');
  if (a >= 0 && b > a) {
    const lines = [...s.slice(a, b).matchAll(/(?<=\n)[^\n]+(?=\n)/g)];
    const need = lines.filter(m => /^(?:「[^」]+」の観点から改善が必要|なし)$/.test(m[0]));
    const dir = lines.filter(m => SANUKI_DIRECTIONS.has(m[0]));
    if (need.length === 1) ratings.push({ kind: 'self', label: '改善の必要性', value: need[0][0], scale: null, evidence: evidence(input, need[0][0], page.from + a + need[0].index!) });
    if (dir.length === 1) ratings.push({ kind: 'self', label: '今後の方向性', value: dir[0][0], scale: null, evidence: evidence(input, dir[0][0], page.from + a + dir[0].index!) });
  }
  return ratings;
}

function sanukiDept(page: Page): RegExpMatchArray | null {
  const esc = page.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.text.match(new RegExp(`事業名\\n\\n([^\\n]+)\\n\\n担当課\\n\\n${esc}\\n基本目標`)) ?? page.text.match(new RegExp(`\\n([^\\n]+)\\n\\n担当課\\n\\n事業名 ${esc}\\n基本目標`));
}

function sanukiExtract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '37206' || input.sourceId !== SANUKI_SOURCE) return [];
  const pages = sanukiPages(input.text), byName = new Map<string, { p: ProjectEvaluation; sig: string }[]>();
  for (let k = 0; k + 1 < pages.length; k++) {
    const cost = pages[k], ev = pages[k + 1];
    if (cost.kind !== 'cost' || ev.kind !== 'eval' || !cost.name || cost.name !== ev.name) continue;
    k++;
    const p = ensureNoCode(project(input, cost.name, cost.name, null, cost.nameRaw, cost.nameAt));
    p.evidence.push(evidence(input, ev.nameRaw, ev.nameAt));
    const dept = sanukiDept(ev);
    if (dept && dept[1] !== '担当課') { p.department = dept[1]; p.evidence.push(evidence(input, dept[0], ev.from + dept.index!)); }
    const amounts = sanukiAmounts(input, cost);
    if (amounts) p.amounts.push(...amounts);
    p.ratings.push(...sanukiRatings(input, ev));
    p.warnings.push(
      '評価年度・評価対象年度は資料本文に明記がないため空欄。',
      amounts
        ? '金額は事業費欄の R5～R8 の各年度ブロック（計画額・当初予算額・決算額の順に4回並ぶ）の順序から年度を判断し、R5・R6 の当初予算額（budget）・決算額（actual）と R7 の当初予算額（budget）の事業費計を転記。各行で国県支出金＋地方債＋その他＋一般財源＝事業費計が成立するもののみ。年度ブロックの順序は同一ファイル（sha256一致）のPDFのレイアウト抽出で確認。計画額は対象外。'
        : '事業費欄の年度ブロックが抽出テキストで崩れており、金額は転記していません。',
      '評価欄の◎○△×は各評価基準の着眼点の直後にある記号を原文のまま転記（定義は資料に記載なし）。総合点は8項目の点数の並びが記号と一致し合計が総合点に等しい場合のみ。指標データ（計画値・実績値）は指標名と値の対応が抽出テキストで確定できないため対象外。',
    );
    const sig = JSON.stringify([p.department, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value])]);
    const list = byName.get(p.projectName) ?? [];
    list.push({ p, sig }); byName.set(p.projectName, list);
  }
  const out: ProjectEvaluation[] = [];
  // 同名の調書が複数ある場合（公共施設一括LED化事業は款が総務費・教育費の別調書）は、再掲か別事業か本文から確定できないため除外。
  for (const list of byName.values()) if (list.length === 1) out.push(list[0].p);
  return out;
}

// ---------------------------------------------------------------------------
// 22213 掛川市 令和５年度実績に基づく効果検証（行政評価）— 事務事業評価表のみ
// ---------------------------------------------------------------------------
const KAKEGAWA_SOURCE = 'af1853fd779abe867aded6ca';
const KAKEGAWA_NAMES: [string, string?][] = [
  ['小中一貫校整備基本構想策定事業'], ['ふらっと美術館プロジェクト'], ['スポーツ推進計画策定事業'], ['子育て応援チャンネル構築事業'],
  ['保育士宿舎借り上げ支援事業'], ['４市１町連携保育士等キャリアアップ研修事業'], ['待機児童解消対策事業', '（小規模保育事業所入所円滑化・大規模改修事業助成）'],
  ['骨髄移植推進事業'], ['補聴器購入費助成事業'], ['ひきこもり地域支援センター事業'], ['公共施設照明ＬＥＤ化事業'], ['道路・公園照明灯ＬＥＤ化事業'],
  ['公共施設再生可能エネルギー発電設備導入事業'], ['自走式草刈り機活用事業'], ['環境の持続可能性に向けた更なるごみ減量と資源化研究事業'],
  ['雇用・就職応援インターネットシステム構築事業'], ['オーガニックビレッジ推進事業'], ['掛川駅お茶のまちづくり拠点整備事業'], ['PR動画等による認知度UPプロジェクト'],
  ['大坂地区まちづくり事業'], ['ダイバーシティ推進プロジェクト'], ['高校生チャレンジ公募事業'], ['掛川市人事変革プロジェクト(職員採用編)'],
];
const KAKEGAWA_DIRECTIONS = '事業完了／廃止／休止／目的再設定／事業のやり方改善（有効性改善）／事業のやり方改善（効率性改善）／事業のやり方改善（公平性改善）／現状維持（従来通りで特に改革改善をしない）';
/** Check items whose marked option text is unique to the item (the shared 「見直し余地がある」「削減余地なし」 are not attributable). */
const KAKEGAWA_CHECKS: [string, string[], string][] = [
  ['①上位体系との整合性', ['貢献している'], '貢献している／見直し余地がある'],
  ['②行政関与の妥当性', ['妥当である'], '妥当である／見直し余地がある'],
  ['③対象・意図の妥当性', ['適切である'], '適切である／見直し余地がある'],
  ['④成果に対する活動の妥当性', ['達成できた', '活動を見直す余地がある'], '達成できた／活動を見直す余地がある'],
  ['⑤成果の向上余地', ['向上余地が無い', '向上余地がある'], '向上余地が無い／向上余地がある'],
  ['⑨受益機会・費用負担の適正化余地', ['公平・校正である'], '公平・校正である／見直し余地がある'],
];
const SHEET_HEAD = '（令和５年度実績（決算後））';

function kakegawaAmounts(input: CachedInput, s: string, from: number): { amounts: EvaluationAmount[]; years: number } | null {
  const hdr = s.indexOf('４年度\n(実績)\n\n５年度\n(実績)\n\n６年度\n(予算)\n\n７年度\n(予算)\n\n８年度\n(予算)\n\n９年度\n(予算)');
  const i = s.indexOf('人\n千円\n人\n千円\n\n', hdr), j = s.indexOf('トータルコスト\n\n千円\n\n', i);
  if (hdr < 0 || i < 0 || j < 0) return null;
  const blocks = s.slice(i + '人\n千円\n人\n千円\n\n'.length, j).replace(/\n+$/, '').split('\n\n').map(b => b.split('\n'));
  if (!(blocks.length === 5 || blocks.length === 6) || !blocks.every(b => b.length === 10 && b.every(isNum))) return null;
  const totalsStart = j + 'トータルコスト\n\n千円\n\n'.length;
  const tm = s.slice(totalsStart).match(new RegExp(`^(?:${NUM}\\n\\n){${blocks.length - 1}}${NUM}(?=\\n)`));
  if (!tm) return null;
  const totals = tm[0].split('\n\n');
  for (const [k, b] of blocks.entries()) {
    if (b.slice(0, 5).reduce((x, v) => x + toNum(v), 0) !== toNum(b[5])) return null;
    if (toNum(b[5]) + toNum(b[7]) + toNum(b[9]) !== toNum(totals[k])) return null;
  }
  const firstYear = blocks.length === 6 ? 2022 : 2023;
  const ev = evidence(input, s.slice(hdr, totalsStart + tm[0].length), from + hdr);
  const amounts: EvaluationAmount[] = [];
  blocks.forEach((b, k) => {
    const fy = firstYear + k, push = (kind: EvaluationAmount['kind'], v: string) => amounts.push({ kind, fiscalYear: fy, amountYen: toNum(v) * 1000, rawValue: v, rawUnit: '千円', evidence: ev });
    if (fy <= 2023) {
      push('actual', b[5]);
      if (b[9] === '0') push('personnel', b[7]);
      push('fullCost', totals[k]);
    } else if (fy === 2024) push('budget', b[5]);
  });
  return { amounts, years: blocks.length };
}

function kakegawaRatings(input: CachedInput, s: string, from: number): EvaluationRating[] {
  const ratings: EvaluationRating[] = [];
  const c0 = s.indexOf('３．評価（Check）'), c1 = s.indexOf('４．事務事業を取り巻く環境');
  if (c0 >= 0 && c1 > c0) {
    const sec = s.slice(c0, c1);
    for (const [label, options, scale] of KAKEGAWA_CHECKS) {
      const marked = options.flatMap(o => [...sec.matchAll(new RegExp(`■ ${o.replace(/[()（）・]/g, m => '\\' + m)}(?=\\n)`, 'g'))].map(m => ({ o, m })));
      if (marked.length !== 1) continue;
      ratings.push({ kind: 'self', label, value: marked[0].o, scale, evidence: evidence(input, marked[0].m[0], from + c0 + marked[0].m.index!) });
    }
  }
  const d0 = s.indexOf('５．今後の方向性（Action）'), d1 = s.indexOf('上記の方向性を進めるために', d0);
  if (d0 >= 0 && d1 > d0) {
    const marked = [...s.slice(d0, d1).matchAll(/■ ([^\n]+)/g)];
    if (marked.length === 1)
      ratings.push({ kind: 'self', label: '今後の事業の方向性', value: marked[0][1], scale: KAKEGAWA_DIRECTIONS, evidence: evidence(input, marked[0][0], from + d0 + marked[0].index!) });
  }
  return ratings;
}

function kakegawaExtract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22213' || input.sourceId !== KAKEGAWA_SOURCE) return [];
  const t = input.text;
  const starts = [...t.matchAll(/事務事業評価表\n/g)].map(m => m.index!)
    .filter(i => t.slice(i, i + 200).includes(SHEET_HEAD) && !t.slice(Math.max(0, i - 20), i).includes('評価書の見かた'));
  const out: ProjectEvaluation[] = [], seen = new Set<string>();
  starts.forEach((from, k) => {
    let to = k + 1 < starts.length ? starts[k + 1] : t.length;
    const policy = t.indexOf('施策の方向評価表', from);
    if (policy >= 0 && policy < to) to = policy;
    const s = t.slice(from, to);
    if (!s.includes('５．今後の方向性（Action）') || !s.includes('上記の方向性を進めるために')) return; // incomplete (truncated) sheet
    const head = s.slice(0, 900);
    const hits = KAKEGAWA_NAMES.filter(([n]) => head.includes(`\n${n}\n`));
    if (hits.length !== 1) return;
    const [name, suffix] = hits[0];
    const fullName = name + (suffix ?? '');
    if (seen.has(fullName)) return; seen.add(fullName);
    const at = head.indexOf(`\n${name}\n`) + 1;
    const p = ensureNoCode(project(input, fullName, fullName, 2024, name, from + at));
    p.evaluatedFiscalYear = 2023;
    if (suffix) { const sAt = head.indexOf(suffix); if (sAt >= 0) p.evidence.push(evidence(input, suffix, from + sAt)); }
    p.evidence.push(evidence(input, SHEET_HEAD, from + s.indexOf(SHEET_HEAD)));
    const dept = s.match(/所属課\n([^\n]+)\n担当係\n/) ?? s.match(/所属課\n\n([^\n]+)\n\n担当係\n/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0], from + dept.index!)); }
    const am = kakegawaAmounts(input, s, from);
    if (am) p.amounts.push(...am.amounts);
    p.ratings.push(...kakegawaRatings(input, s, from));
    p.warnings.push(
      '評価年度2024は資料の「令和６年度（令和５年度実績）は…効果検証（行政評価）を行った」、評価対象年度2023は評価表の表題「（令和５年度実績（決算後））」による。',
      am
        ? `金額は事業費・人件費表の列ブロック（${am.years}列）を、各列で財源5項目の合計＝事業費計、事業費計＋常勤職員人件費＋会計年度職員人件費＝トータルコストが成立する場合のみ採用。${am.years === 5 ? '値のある列が5列のため４年度欄が空欄で５～９年度に対応すると判断（同一ファイル（sha256一致）のPDFのレイアウト抽出で確認）。' : '６列のため４～９年度に対応。'}令和５年度以前（実績）の事業費計（actual）・トータルコスト（fullCost）、会計年度職員人件費が0の場合のみ常勤職員人件費（personnel）、令和６年度（予算）の事業費計（budget）を転記。７～９年度は対象外。`
        : '事業費・人件費表の列ブロックが抽出テキストで崩れているため金額は転記していません。',
      '評価（Check）は、選択肢の文言が項目固有のもの（①②③④⑤⑨）で■が1つだけ付いている場合のみ原文ラベルで転記。「見直し余地がある」「削減余地なし」など複数項目に共通する選択肢、⑥⑦⑧は対象外。活動指標・成果指標は年度と値の対応が抽出テキストで崩れているため対象外。施策の方向評価表は対象外。',
    );
    if (!dept) p.warnings.push('所属課欄の位置が抽出テキストで崩れており、所管課は転記していません。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '27218': {
    extract: daitoExtract,
    scope: '大東市「実施計画事業調書 令和７年度（決算）」（危機管理室・政策推進部・総務部・議会事務局の17事業）を1事業1件で構造化。事業名・所属、令和５～７年度（決算）の事業費計・人件費計・総事業費（列対応をPDFレイアウトで確認し a＋b＝総事業費 が成立するもの）を収録。評価指標の目標・実績、施策KPI、自己点検の文章、案内ページは対象外。',
  },
  '37206': {
    extract: sanukiExtract,
    scope: 'さぬき市「第2次さぬき市総合計画後期基本計画実施計画／事務事業評価調書」（総務部分、1事業2ページ）を1事業1件で構造化。事業名・担当課、R5・R6の当初予算額と決算額、R7当初予算額の事業費計（財源の合計が一致するもの）、評価基準8項目の◎○△×・総合点・改善の必要性・今後の方向性を収録。計画額、指標データ、案内ページは対象外。評価年度は本文に明記がないため空欄。',
  },
  '22213': {
    extract: kakegawaExtract,
    scope: '掛川市「令和５年度実績に基づく効果検証（行政評価）」のうち事務事業評価表のみを1事業1件で構造化（抽出テキストの範囲内）。事業名・所属課、算術で列対応を確認できた令和５年度以前の事業費計・トータルコスト・人件費と令和６年度予算、項目固有の選択肢に■がある評価と今後の方向性を収録。施策の方向評価表、活動・成果指標、外部評価の文章は対象外。',
  },
};
