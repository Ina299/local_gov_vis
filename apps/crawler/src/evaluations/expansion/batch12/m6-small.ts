/**
 * Batch-12 (m6) extractors for small new acquisitions: 地方創生臨時交付金の効果検証一覧（41441 太良町・43531 苓北町・
 * 03441 住田町・01632 士幌町）、26207 城陽市 公共事業評価調書、41204 多久市 教育委員会 点検・評価報告書.
 */
import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const GRANT_NOTE = '事務事業評価ではなく地方創生臨時交付金を充当した事業の実施状況・効果検証の一覧。';
const num = (s: string) => Number(s.normalize('NFKC').replace(/,/g, ''));
const once = (t: string, s: string) => t.indexOf(s) >= 0 && t.indexOf(s) === t.lastIndexOf(s);

/** A grant project pinned by an exact (possibly interleaved) source span; `dept` is set only when printed inside that span. */
interface Pin { raw: string; name: string; dept?: string; total?: string; breakdown?: string }
interface GrantDoc { code: string; sourceId: string; title: string; fiscalYear: number; pins: Pin[]; note: string; costHeader?: string }

function grantRecords(input: CachedInput, doc: GrantDoc): ProjectEvaluation[] {
  const t = input.text;
  if (input.municipalityCode !== doc.code || input.sourceId !== doc.sourceId || !t.startsWith(doc.title)) return [];
  const out: ProjectEvaluation[] = [];
  for (const pin of doc.pins) {
    if (!once(t, pin.raw) || (pin.dept && !pin.raw.includes(pin.dept))) continue;
    const p = project(input, pin.name, pin.name, null, pin.raw);
    p.projectCode = null;
    p.department = pin.dept ?? null;
    p.evaluatedFiscalYear = doc.fiscalYear;
    p.evidence.push(evidence(input, doc.title, 0));
    p.warnings.push(`${input.municipalityName} ${doc.title}の1行。${GRANT_NOTE}評価対象年度は表題の年度。評価年度は本文に明示がないため未設定。`);
    p.warnings.push(doc.note);
    if (pin.dept) p.warnings.push(`担当課は事業名と同じ行に印字された「${pin.dept}」。`);
    else p.warnings.push('担当課欄は抽出テキストで事業名の行から離れて出力され、行の対応が確定しないため未設定。');
    if (doc.costHeader && pin.total && pin.breakdown && once(t, pin.breakdown)) {
      // 総事業費（実績額） is taken only when the 経費内訳 items printed for this project add up to it.
      const parts = [...pin.breakdown.matchAll(/([\d,]+)\n?円/g)].map(m => num(m[1]));
      const line = `\n${pin.total}\n`;
      const raw = once(t, line) ? line : parts.length === 1 && pin.breakdown.includes(pin.total) ? pin.breakdown : null;
      if (raw && parts.reduce((a, b) => a + b, 0) === num(pin.total)) {
        const at = raw === line ? t.indexOf(line) : t.indexOf(pin.breakdown);
        const amount: EvaluationAmount = { kind: 'actual', fiscalYear: doc.fiscalYear, amountYen: num(pin.total), rawValue: pin.total, rawUnit: '円', evidence: evidence(input, raw, at) };
        p.amounts.push(amount);
        p.evidence.push(evidence(input, pin.breakdown, t.indexOf(pin.breakdown)), evidence(input, doc.costHeader, t.indexOf(doc.costHeader)));
        p.warnings.push(`金額は「総事業費（実績額）」列（単位：円）の${pin.total}円。表の列は抽出テキストで事業名と離れて出力されるため、同じ事業の「経費内訳」欄の内訳額の合計と一致することを確認して対応づけた。国庫補助額・交付金充当額・一般財源の列は対応が確定しないため未収録。`);
      }
    }
    if (!p.amounts.length) p.warnings.push('総事業費・交付金充当額などの金額は、列の対応または金額の種別（予算・実績）が本文で確定しないため未収録。');
    out.push(p);
  }
  // A name printed for two rows of one table cannot be told apart: drop every copy.
  const names = out.map(p => p.projectName);
  return out.filter(p => names.filter(n => n === p.projectName).length === 1);
}

const TARA_NOTE = '事業名は表の「事業名」列の折り返しを連結（抽出テキストでは「事業の概要」列・所管課と同じ行に混在して出力される）。「効果・検証」「課題等」の文章は列が交互に出力されるため未収録。';
const TARA_COST = '総事業費\n（実績額）';
const GRANT_DOCS: GrantDoc[] = [
  {
    code: '41441', sourceId: '527492baac8a3f71d8b00547', fiscalYear: 2025, costHeader: TARA_COST, note: TARA_NOTE,
    title: '令和７年度 物価高騰対応重点支援地方創生臨時交付金を活用した事業の実施状況及び効果検証',
    pins: [
      { raw: '電力・ガス・食料品等\n係る事務費（給付システム改修、通知書発送\n単独 価格高騰重点支援給 町民福祉課 等）\n付金（5次分）', name: '電力・ガス・食料品等価格高騰重点支援給付金（5次分）', dept: '町民福祉課',
        total: '30,963,485', breakdown: '・低所得世帯への給付金 28,680,000円\n・給付システム改修 1,808,400円\n・その他事務費 475,085円' },
      { raw: '電力・ガス・食料品等\n事業執行に係る事務費（給付システム改修、\n価格高騰重点支援給\n子育て支援課 通知書発送等）\n単独\n付金（こども加算2次\n③令和6年度住民税均等割非課税世帯\n分）', name: '電力・ガス・食料品等価格高騰重点支援給付金（こども加算2次分）', dept: '子育て支援課',
        total: '3,392,738', breakdown: '・低所得者の子育て世帯への給付金\n1,740,000円\n・給付システム改修 1,643,400円\n・その他事務費 9,338円' },
      { raw: '定額減税補足給付金\n（不足額給付）\n\n税務課', name: '定額減税補足給付金（不足額給付）', dept: '税務課',
        total: '39,652,544', breakdown: '・定額減税を補足する給付金 37,680,000\n円\n・給付システム改修 1,670,900円\n・その他事務費 301,644円' },
      { raw: '物価高騰対策地域共\n単独\n商工観光課 ③全町民\n通商品券配布事業', name: '物価高騰対策地域共通商品券配布事業', dept: '商工観光課',
        total: '48,849,914', breakdown: '・商品券換金業務委託料 46,087,120円\n・商品券及びチラシ印刷 811,800円\n・商品券郵送料 1,486,418円\n・その他事務費 464,576円' },
      { raw: '物価高騰対応行政区\n単独\n企画政策課 ③55行政区\n運営支援事業', name: '物価高騰対応行政区運営支援事業', dept: '企画政策課',
        total: '5,794,000', breakdown: '・行政区への補助金 5,794,000円' },
      { raw: '物価高騰対応小中学\n②小中学校の給食費の物価高騰分の減免\n単独 校学校給食費支援事 学校教育課 に係る費用（学校給食センター運営協議会\n業', name: '物価高騰対応小中学校学校給食費支援事業', dept: '学校教育課',
        total: '1,991,000', breakdown: '・学校給食センター運営協議会への補助\n金 1,991,000円（食材費高騰による増額\n分）' },
    ],
  },
  {
    code: '41441', sourceId: 'd065766a41c214710a12d84e', fiscalYear: 2024, costHeader: TARA_COST,
    note: `${TARA_NOTE}同名の「電力・ガス・食料品等価格高騰重点支援給付金（こども加算分）」が2行あり区別できないため2件とも除外。`,
    title: '令和６年度 物価高騰対応重点支援地方創生臨時交付金を活用した事業の実施状況及び効果検証',
    pins: [
      { raw: '物価高騰対策地域共\n企画商工課\n通商品券配布事業', name: '物価高騰対策地域共通商品券配布事業', dept: '企画商工課',
        total: '41,523,265', breakdown: '・商品券換金業務委託料 39,340,641円\n・商品券及びチラシ印刷 700,810円\n・商品券郵送料 1,459,177円\n・その他事務費 22,637円' },
      { raw: '電力・ガス・食料品等\n単独 価格高騰重点支援給 町民福祉課\n付金（2次分）', name: '電力・ガス・食料品等価格高騰重点支援給付金（2次分）', dept: '町民福祉課',
        total: '71,425,622', breakdown: '・低所得世帯への給付金 69,580,000円\n・給付システム改修 1,386,000円\n・その他事務費 459,622円' },
      { raw: '電力・ガス・食料品等\n単独 価格高騰重点支援給 町民福祉課\n付金（3次分）', name: '電力・ガス・食料品等価格高騰重点支援給付金（3次分）', dept: '町民福祉課',
        total: '25,654,384', breakdown: '・低所得世帯への給付金 24,500,000円\n・給付システム改修 1,062,600円\n・その他事務費 91,784円' },
      { raw: '電力・ガス・食料品等\n単独 価格高騰重点支援給 町民福祉課\n付金（4次分）', name: '電力・ガス・食料品等価格高騰重点支援給付金（4次分）', dept: '町民福祉課',
        total: '16,952,383', breakdown: '・低所得世帯への給付金 15,900,000円\n・給付システム改修 950,400円\n・その他事務費 101,983円' },
      { raw: '定額減税補足給付金\n税務課\n（調整給付）', name: '定額減税補足給付金（調整給付）', dept: '税務課',
        total: '71,535,212', breakdown: '・定額減税を補足する給付金 69,450,000\n円\n・給付システム改修 1,702,800円\n・その他事務費 382,412円' },
    ],
  },
  {
    code: '43531', sourceId: '5c72da5b4c80792760f50627', fiscalYear: 2023,
    title: '令和５年度\n\n物価高騰対策に伴う苓北町支援策の実施状況',
    note: '事業名は「No.」欄の事業名と、その下の括弧書き（対象世帯の区分）を連結。総事業費・財源内訳は金額の種別（予算・実績）が本文で明示されないため未収録。「成果及び評価」の文章は列が交互に出力されるため未収録。',
    pins: [
      { raw: 'No.1\n\n物価高騰対策支援給付金事業\n\n内容\n\n（住民税非課税世帯）\n福祉保健課', name: '物価高騰対策支援給付金事業（住民税非課税世帯）', dept: '福祉保健課' },
      { raw: '物価高騰対策支援給付金事業\n\n内容\n\n（住民税均等割のみ課税世帯）', name: '物価高騰対策支援給付金事業（住民税均等割のみ課税世帯）' },
      { raw: '物価高騰対策支援給付金事業\n\n内容\n\n（子育て世帯）', name: '物価高騰対策支援給付金事業（子育て世帯）' },
      { raw: 'No.10\n\n畜産業資材高騰対策事業', name: '畜産業資材高騰対策事業' },
      { raw: 'No.11\n\n貝類等養殖漁業支援事業\n\n内容\n\n財源内訳（単位：円）\n\n農林水産課', name: '貝類等養殖漁業支援事業', dept: '農林水産課' },
      { raw: '\n水道下水道利用者支援事業\n', name: '水道下水道利用者支援事業' },
    ],
  },
  {
    code: '43531', sourceId: '9113c043fb454190a73a0fce', fiscalYear: 2024,
    title: '令和６年度\n\n物価高騰対策に伴う苓北町支援策の実施状況',
    note: '事業名は「No.」欄の事業名と、その下の括弧書き（対象世帯の区分）を連結。令和５年度事業計画分の再掲を含む（表のとおり令和６年度の資料の1行として収録）。総事業費・財源内訳は金額の種別（予算・実績）が本文で明示されないため未収録。「成果及び評価」の文章は列が交互に出力されるため未収録。',
    pins: [
      { raw: 'No.1\n\n物価高騰対策支援給付金事業\n\n内容\n\n（住民税非課税世帯）', name: '物価高騰対策支援給付金事業（住民税非課税世帯）' },
      { raw: 'No.2-1\n\n物価高騰対策支援給付金事業\n\n内容\n\n（住民税均等割のみ課税世帯）', name: '物価高騰対策支援給付金事業（住民税均等割のみ課税世帯）' },
      { raw: '物価高騰対策支援給付金事業\n\n内容\n\n（新たな非課税等、子ども加算）\n\n税務住民課', name: '物価高騰対策支援給付金事業（新たな非課税等、子ども加算）', dept: '税務住民課' },
      { raw: 'No.2-3\n\n内容\n\n定額減税補足給付事業\n\n税務住民課', name: '定額減税補足給付事業', dept: '税務住民課' },
      { raw: 'No.7\n\n内容\n\n物価高騰対策支援給付金事業\n\n福祉保健課', name: '物価高騰対策支援給付金事業', dept: '福祉保健課' },
      { raw: '公共交通応援事業\n\n内容\n\n財源内訳（単位：円）\n\n企画政策課', name: '公共交通応援事業', dept: '企画政策課' },
      { raw: '農業省力化生産資材導入支援事業\n農林水産課', name: '農業省力化生産資材導入支援事業', dept: '農林水産課' },
      { raw: '\n農産物輸送費補助事業\n', name: '農産物輸送費補助事業' },
      { raw: '\n家畜輸送費補助事業\n', name: '家畜輸送費補助事業' },
      { raw: '\n漁業燃油価格高騰対策事業\n', name: '漁業燃油価格高騰対策事業' },
      { raw: '\n運送事業者原油価格高騰対策事業\n', name: '運送事業者原油価格高騰対策事業' },
    ],
  },
  {
    code: '01632', sourceId: '3ab856c2824525e65d40f1ce', fiscalYear: 2020,
    title: '令和２年度\n\nNo.\n\n新型コロナウイルス感染症対応地方創生臨時交付金',
    note: '士幌町 令和２年度 新型コロナウイルス感染症対応地方創生臨時交付金「事業実施状況と効果検証」。事業名は「事業名」欄で番号の直後に印字された折り返しを連結（番号が事業名の途中に出力される行は未収録）。担当課・総事業費・交付金充当額は列の並びがページにより崩れ行の対応が確定しないため未収録。',
    pins: [
      { raw: '\n\n1\n\n感染症予防対策事\n業\n\n', name: '感染症予防対策事業' },
      { raw: '\n\n2\n\nスクールバス増車\n事業\n\n', name: 'スクールバス増車事業' },
      { raw: '\n\n3\n\n学校休業に伴う児\n童生徒への通信事\n業\n\n', name: '学校休業に伴う児童生徒への通信事業' },
      { raw: '\n\n4\n\n公共施設等手洗い\n場自動水栓化事業\n\n', name: '公共施設等手洗い場自動水栓化事業' },
      { raw: '\n\n5\n\n商品券発行助成事\n業\n\n', name: '商品券発行助成事業' },
      { raw: '\n\n6\n\n事業・雇用継続支\n援金給付事業\n\n', name: '事業・雇用継続支援金給付事業' },
      { raw: '\n\n7\n\n観光拠点施設雇用\n継続支援金給付事\n業\n\n', name: '観光拠点施設雇用継続支援金給付事業' },
      { raw: '\n\n8\n\n申請業務代行費用\n助成事業\n\n', name: '申請業務代行費用助成事業' },
      { raw: '\n\n9\n\n手作りマスク配布\n事業\n\n', name: '手作りマスク配布事業' },
      { raw: '\n\n17\n\nこどもの育ち応援\n特別給付金事業\n\n', name: 'こどもの育ち応援特別給付金事業' },
      { raw: '\n\n18\n\n福祉避難所トイレ\n改修工事\n\n', name: '福祉避難所トイレ改修工事' },
    ],
  },
];

// ---------------------------------------------------------------- 03441 住田町（令和６年度地方創生臨時交付金 充当事業一覧）
const SUMITA = { id: '29dea04ff0e349bdebb91a11', title: '令和６年度地方創生臨時交付金 充当事業一覧' };
function sumita(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.municipalityCode !== '03441' || input.sourceId !== SUMITA.id || !t.startsWith(SUMITA.title)) return [];
  const rows = [...t.matchAll(/\n([1-9]) ([^\n]+)\n\n/g)];
  const out: ProjectEvaluation[] = [];
  rows.forEach((m, k) => {
    if (Number(m[1]) !== k + 1) return;
    const start = m.index! + 1, end = rows[k + 1]?.index ?? t.indexOf('\n合計', start);
    if (end < 0) return;
    // The last row runs into the 合計 figures; trailing number-only lines are not part of the row.
    const lines = t.slice(start, end).trimEnd().split('\n');
    while (lines.length && /^[\d,]*$/.test(lines[lines.length - 1])) lines.pop();
    const chunk = lines.join('\n'), dept = lines[lines.length - 1] ?? '';
    const name = m[2].trim();
    const p = project(input, name, name, null, m[0].slice(1).trimEnd(), start);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, SUMITA.title, 0));
    if (/^[^\s\d]+(?:課|委員会)$/.test(dept)) {
      p.department = dept;
      p.evidence.push(evidence(input, chunk.trimEnd(), start));
    }
    p.warnings.push(`住田町 ${SUMITA.title}の1行。${GRANT_NOTE}評価対象年度は表題の年度。評価年度は本文に明示がないため未設定。`);
    p.warnings.push('担当課は同じ行の「担当課」欄。総事業費・交付金充当経費は、金額の種別（予算・実績）が本文で明示されず、一部の行で列の並びが崩れているため未収録。「実施成果・効果」の文章は未収録。');
    out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------- 26207 城陽市（令和６年度 公共事業評価調書・再評価）
const JOYO = { id: '22fd199df8e4ee4252272c8f', title: '令和６年度\n\n公共事業評価調書\n\n【再評価（令和４年度事業評価）】' };
const JOYO_NAME = '事業名\n\n（都）東部丘陵線\n\n事業所管轄\n１\n\n地域連携道路事業（街路）\n\n新名神推進課';
const JOYO_RESULT = '総合評価として本計画で事業を継続する必要がある。';
function joyo(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.municipalityCode !== '26207' || input.sourceId !== JOYO.id || !t.startsWith(JOYO.title) || !once(t, JOYO_RESULT)) return [];
  const at = t.indexOf(JOYO_NAME);
  if (at < 0) return [];
  const name = '（都）東部丘陵線 地域連携道路事業（街路）';
  const p = project(input, name, name, 2024, JOYO_NAME, at);
  p.projectCode = null;
  p.department = '新名神推進課';
  p.evidence.push(evidence(input, JOYO.title, 0));
  const r = evidence(input, JOYO_RESULT, t.indexOf(JOYO_RESULT));
  p.ratings.push({ kind: 'self', label: '総合評価（案）', value: '本計画で事業を継続する必要がある', scale: null, evidence: r });
  p.evidence.push(r);
  p.warnings.push('城陽市 令和６年度 公共事業評価調書（再評価）の対象事業1件。評価年度は表紙の「令和６年度」。表紙の「令和４年度事業評価」の意味（評価対象年度か前回評価か）は本文で確定しないため評価対象年度は未設定。');
  p.warnings.push('事業名・事業所管轄は「費用便益分析結果総括表（事業全体）」の欄。総合評価は「８ 総合評価（案）」の結びの文（案の段階の記載）。費用便益分析の事業費・便益は億円単位の現在価値・単純合計で、年度別の予算・決算ではないため未収録。');
  return [p];
}

// ---------------------------------------------------------------- 41204 多久市（教育委員会 点検・評価報告書 令和６年度事業分）
const TAKU = { id: 'c309f4e6817f5a01af15b247', title: '令和 7 年度\n\n教育に関する事務の管理及び\n執行の状況の点検及び評価等報告書\n（令和６年度事業分）' };
const TAKU_SHEET = '●Plan 事務事業の概要\n';
const TAKU_DIRECTIONS = '新規|縮小|現状のまま継続|見直しの上継続|拡大･拡充|廃止|休止|完了';
function taku(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.municipalityCode !== '41204' || input.sourceId !== TAKU.id || !t.startsWith(TAKU.title)) return [];
  const starts = [...t.matchAll(new RegExp(TAKU_SHEET, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length);
    const nm = sheet.match(/^●Plan 事務事業の概要\n事務事業名 ([^\n]+)/);
    if (!nm) return;
    const name = nm[1].trim();
    const p = project(input, name, name, 2025, nm[0], s);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, TAKU.title, 0));
    const ev = (m: RegExpMatchArray) => evidence(input, m[0], s + m.index!);
    // 担当課名 is printed next to the label, or as a unique 課/係 pair elsewhere on the sheet.
    const direct = sheet.match(/担当課名\n([^\s\n]+課)\n/);
    const pairs = [...sheet.matchAll(/\n([^\s\n]+課)\n([^\s\n]+係)\n/g)];
    const dm = direct ?? (pairs.length === 1 ? pairs[0] : null);
    if (dm) { p.department = dm[1]; p.evidence.push(ev(dm)); }
    // 事業費 (千円) per 決算 year: first value of each year column, kept only when it equals 一般財源＋国県支出金＋その他.
    const N = '([\\d,]+)';
    const a = sheet.match(new RegExp(`令和５年度決算\\n${N}\\n${N}\\n${N}\\n${N}\\n\\n令和６年度決算\\n${N}\\n${N}\\n${N}\\n${N}\\n`))
      ?? sheet.match(new RegExp(`令和５年度決算\\n\\n令和６年度決算\\n\\n令和７年度目標\\n\\n千円\\n千円\\n千円\\n千円\\n\\n${N}\\n${N}\\n${N}\\n${N}\\n\\n${N}\\n${N}\\n${N}\\n${N}\\n`));
    if (a && /事業費\n(?:コスト\n)?一般財源\n国県支出金\nその他\n/.test(sheet.slice(Math.max(0, a.index! - 200), a.index!))) {
      [[2023, 1], [2024, 5]].forEach(([fy, g]) => {
        const v = a.slice(g, g + 4).map(num);
        if (v[0] !== v[1] + v[2] + v[3]) return;
        p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: v[0] * 1000, rawValue: a[g], rawUnit: '千円', evidence: ev(a) });
      });
    }
    const dir = [...sheet.matchAll(new RegExp(`■ (${TAKU_DIRECTIONS})`, 'g'))];
    if (dir.length === 1) {
      const e = evidence(input, dir[0][0], s + dir[0].index!);
      p.ratings.push({ kind: 'self', label: '事務事業の今後の方向性', value: dir[0][1], scale: TAKU_DIRECTIONS.replace(/\|/g, '／'), evidence: e });
    }
    p.warnings.push('多久市教育委員会 令和７年度 点検・評価報告書（令和６年度事業分）の事務事業評価シート1枚。評価年度は表紙の「令和 7 年度」、評価対象年度は「令和６年度事業分」。');
    p.warnings.push(p.amounts.length
      ? '金額は「コスト」表の事業費（千円、令和５・６年度決算）。一般財源・国県支出金・その他の合計と一致する年度のみ収録（令和７年度目標・予算は未収録）。'
      : '「コスト」表は抽出テキストで列の並びが崩れ年度と値の対応が確定しないため金額は未収録。');
    p.warnings.push('一次評価（a/b/c）・二次評価・総合評価（A/B/C）は判定理由の文章と交互に出力され評価項目との対応が確定しないため未収録。今後の方向性は■印の選択肢のみ。実績表の指標は列の対応が確定しないため未収録。');
    out.push(p);
  });
  return out;
}

const grant = (code: string) => (input: CachedInput) => GRANT_DOCS.filter(d => d.code === code).flatMap(d => grantRecords(input, d));

export const entries: Record<string, Entry> = {
  '41441': {
    extract: grant('41441'),
    scope: '令和６・７年度 物価高騰対応重点支援地方創生臨時交付金を活用した事業の実施状況及び効果検証の事業行（事業名・所管課・経費内訳の合計と一致する総事業費（実績額））。交付金の効果検証で事務事業評価ではない。同名2行の事業、交付金充当額等の財源内訳、効果・課題の文章は対象外。',
  },
  '43531': {
    extract: grant('43531'),
    scope: '令和５・６年度 物価高騰対策に伴う苓北町支援策の実施状況（臨時交付金事業）の事業名と、事業名と同じ位置に印字された担当課のみ。交付金の効果検証で事務事業評価ではない。総事業費・財源内訳（予算・実績の別が不明）、成果及び評価の文章は対象外。',
  },
  '01632': {
    extract: grant('01632'),
    scope: '令和２年度 新型コロナウイルス感染症対応地方創生臨時交付金「事業実施状況と効果検証」で番号の直後に事業名が印字された事業の名称のみ。交付金の効果検証で事務事業評価ではない。担当課・金額（列対応が崩れる）、令和４〜７年度の同種資料（事業名が他列と混在）、令和８年度実施計画は対象外。',
  },
  '03441': {
    extract: input => sumita(input),
    scope: '令和６年度地方創生臨時交付金 充当事業一覧の事業名と担当課。交付金充当事業の一覧で事務事業評価ではない。総事業費・交付金充当経費（予算・実績の別が不明、一部列崩れ）と実施成果の文章は対象外。',
  },
  '26207': {
    extract: input => joyo(input),
    scope: '令和６年度 公共事業評価調書（再評価）の対象事業1件（東部丘陵線 地域連携道路事業）の事業名・事業所管轄・総合評価（案）の結論。費用便益分析の億円単位の数値、事業の概要・進捗の記述は対象外。',
  },
  '41204': {
    extract: input => taku(input),
    scope: '令和７年度 教育委員会点検・評価報告書（令和６年度事業分）の事務事業評価シートごとの事務事業名・担当課・事業費（令和５・６年度決算、財源内訳と合計が一致するもの）・今後の方向性（■印）。教育委員会の活動評価、一次・二次・総合評価の記号、実績指標は対象外。',
  },
};
