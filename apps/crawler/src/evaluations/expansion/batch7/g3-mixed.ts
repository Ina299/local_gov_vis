/** Batch-7 extractors (g3): 美里町・上里町・湯河原町・新庄市・鎌ケ谷市. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const ids = (s: string) => new Set(s.split(' '));
const num = (s: string) => Number(s.normalize('NFKC').replaceAll(',', ''));
const digits = (s: string) => Number(s.normalize('NFKC'));
const BASE = '保存済み抽出テキストから部分構造化。PDF原本との再照合は未実施。表の空欄・列位置を推測して補完していません。';

// ---- 11381 美里町: 平成19・20年度 事務事業評価表（1事業1ファイル） ----
const MISATO = ids('0ebe41f926b1541450cba0b4 23f476800debce59fda5f690 2766022ad08becd165d42421 2b2e7bbc780d806d58665f68 2c8fe9d5ce598fe1e8f1ee6f 2cc5487a886ba13cfcdda277 2dfaa9bc7d6ce88118aa64d3 31080f95a6bf4c3b8116f556 3a35384f7118e7ce54dafeac 3da014c1cb61b64a0362d985 494bce4802442862d24a29cb 50e90c90eec36c29521cee5d 57354e6a500582bb9c265ee5 602af226da4dab9432744f89 62c0d6bc7c397a1a50160146 6a06b79b9cca12e5caa5b5cc 6bcea9d2f06150b18cb5978c 7a09fb94a8064f9ab008e32b 82791e54db31956228f13933 863cb5457f3665b4d48911d5 8c905b5d618a5d0fd5d5b092 9f165c1721ec063704829480 9f531c72c7d86ad18f6ead54 a08eecf993875098bebff6f2 a18bab44c2d2c2d45bbc843e a2be1027d4329a48b1e839f0 a34b8d8644daa32e7e081f67 ab9afb0c402d662ca2671a1f afa7c6b444a8a3cc0a43c06f b390737535ce80ba911307c8 b5201f42af01b8b7993134f6 b6b9de03019c1b435da7e5a5 b92b3b67d347297eb35931bb c2f9f5c5aa5c8df4e404699b c5e151494d3b0e13c17b2990 c94dffdb9185137055104b4c d3a80b31d911bbb5ede11302 d45094285ce46c828ab24ad4 dc527825e3756ce080d3e41e ddaab74cd3ce208bdb332315 e1a02bce5da212212ebbe689 f13e3206f30adc156580c1e5 faca77adf8fcb82d49f513a7 fb845ee29290bd0f8d1fd801');
const N = '([\\d,]+)';
// Full 5-row cost table; the general-revenue row may print before or after its label.
const MISATO_COST = new RegExp(`事業費 （千円）\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n受益者負担\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n国・県支出金\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\nその他特定財源\\n\\n${N}\\n\\n${N}\\n\\n${N}\\n\\n(?:一般財源\\n\\n${N}\\n\\n${N}\\n\\n${N}|${N}\\n\\n${N}\\n\\n${N}\\n\\n一般財源)`);
function extractMisato(input: CachedInput): ProjectEvaluation[] {
  if (!MISATO.has(input.sourceId)) return [];
  const t = input.text;
  const head = t.match(/^平成([０-９\d]+)年度 事務事業評価表\n事務事業名\n\n(.+)\n\nコード\n\n(H\d+-[A-Z]-\d+)\n\n主管課局\n\n(.+)\n\n担当名\n\n(.+)\n/);
  if (!head) return [];
  const year = 1988 + digits(head[1]);
  const p = project(input, head[3], head[2], year, head[0], 0);
  p.department = head[4];
  const purpose = t.match(/内容と目的\n\n([^\n]+(?:\n[^\n]+)*)\n\n現状と結果/);
  if (purpose) { p.purpose = purpose[1]; p.evidence.push(evidence(input, purpose[0], purpose.index!)); }
  const sec = t.indexOf('２．経費（決算額）'), end = t.indexOf('３．１次評価');
  if (sec >= 0 && end > sec) {
    const section = t.slice(sec, end), m = section.match(MISATO_COST);
    const years = [...section.matchAll(/平成([０-９\d]+)年度/g)].map(y => 1988 + digits(y[1])).sort((a, b) => a - b);
    const uniq = [...new Set(years)];
    if (m && !/見込|予算/.test(section) && uniq.length === 3 && uniq[2] - uniq[0] === 2 && uniq[2] === year - 1) {
      const v = m.slice(1).filter(x => x !== undefined).map(num);
      const ok = [0, 1, 2].every(i => v[i] === v[3 + i] + v[6 + i] + v[9 + i] + v[12 + i]);
      if (ok) {
        const raw = m[0], start = sec + m.index!;
        [0, 1, 2].forEach(i => p.amounts.push({ kind: 'actual', fiscalYear: uniq[i], amountYen: v[i] * 1000, rawValue: m[1 + i], rawUnit: '千円', evidence: evidence(input, raw, start) }));
        p.warnings.push('経費欄（決算額）の事業費行。3列を原文の年度見出し（3か年）の昇順に対応させ、財源内訳4行の合計が事業費と一致する場合のみ採用。');
      }
    }
  }
  p.warnings.push(BASE + `平成${head[1]}年度の評価表。評価対象年度は本文に明示がないため未設定。総合評価・予算反映は選択番号の列対応が確定できないため未登録。平成20年度様式以外（経費欄に「決算額」表記なし）や決算見込・予算額を含む経費欄は金額化しない。`);
  return [p];
}

// ---- 11385 上里町: 様式第１号 事務事業評価表（1事業1ファイル） ----
const KAMISATO = ids('00b234012988565dbf6c41a4 02f18c823e5a094e53d407a7 0fdb4818714be6eb7f2043ad 226da4f8d43667ea1fd2baa4 36602a77f7645411cf1b28cf 3f6a8ff8d8568826e2f18587 6a8480563075b315b4701e74 799f8aef13f7dca7606e432b 81c9fcc8fdd1b5e9f635f187 88c0816dd007a1d816d43785 a99f0986c2e9c70aff81c515 aa67a91a90977efdb052c77d d7f383f486b37970121a2b8e e211aeb9d830e23bbced504b edeaff7baa821e457b8814b2 fce93a4ab70fec510e9aae79');
const KAMISATO_SCALE = '期待した以上の効果や成果が上がっている（25～27点）／概ね期待していた効果・成果が上がっている（18～24点）／期待している効果や成果までは到達してない（10～17点）／これ以上の効果・成果や目的達成は期待できない（9点）';
function parseKamisato(input: CachedInput): ProjectEvaluation | null {
  if (!KAMISATO.has(input.sourceId)) return null;
  const t = input.text;
  const name = t.match(/^様式第１号\n\n事 務 事 業 評 価 表\n■Plan \(計画）\nA\.事務事業の\n名\n称\n\n(.+)\n\nB\.予算事業名\n/);
  const dept = t.match(/3\.主管課・係名(.+)\n/);
  // The year cells (評価年度・開始年度・終了年度) print together; the first is kept only when a 決算 column of the same year exists.
  const fy = t.match(/\n\n(平成[０-９\d]+年度)\n(?:[^\n]+\n){0,2}\n7\.予 算 科 目/);
  if (!name || !dept) return null;
  let year: number | null = null;
  if (fy) {
    const y = 1988 + digits(fy[1].slice(2, -2));
    if ([...t.matchAll(/平成([０-９\d]+)年度決算/g)].some(m => 1988 + digits(m[1]) === y)) year = y;
  }
  const p = project(input, name[1], name[1], year, name[0], 0);
  p.projectCode = null; p.evaluatedFiscalYear = year; p.department = dept[1].trim();
  p.evidence.push(evidence(input, dept[0], dept.index!));
  if (year !== null) p.evidence.push(evidence(input, fy![0], fy!.index!));
  // ● also marks 国庫/県費 above; only a single mark inside the 32.総合評価 block (before ■Action) counts.
  const block = t.indexOf('32.総合評価'), action = t.indexOf('■Action', block);
  const marks = block >= 0 && action > block ? [...t.slice(block, action).matchAll(/\n● ([^\n]+)\n/g)] : [];
  if (marks.length === 1) {
    const m = marks[0];
    p.ratings.push({ kind: 'self', label: '第１次評価 総合評価', value: m[1], scale: KAMISATO_SCALE, evidence: evidence(input, m[0], block + m.index!) });
  }
  p.warnings.push(BASE + '評価年度は原文「4.評価年度」の値で、同じ年度の決算列見出しがある場合のみ設定。費用欄・指標欄は列の対応が崩れているため金額・指標は未登録。第２次評価のチェック欄は未登録。');
  return p;
}
function extractKamisato(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const p = parseKamisato(input);
  if (!p) return [];
  // The same sheet may be published twice (H27 file and numbered file): emit once from the first sourceId, drop on disagreement.
  const twins = inputs.filter(i => i.sourceId !== input.sourceId).map(i => ({ i, o: parseKamisato(i) }))
    .filter((x): x is { i: CachedInput; o: ProjectEvaluation } => !!x.o && x.o.projectName === p.projectName && x.o.evaluationYear === p.evaluationYear);
  if (!twins.length) return [p];
  const sig = (o: ProjectEvaluation) => JSON.stringify([o.department, o.ratings.map(r => r.value)]);
  if (twins.some(x => sig(x.o) !== sig(p)) || twins.some(x => x.i.sourceId < input.sourceId)) return [];
  for (const x of twins) p.evidence.push(...x.o.evidence);
  p.warnings.push('同一年度・同名の評価表が別ファイルで再掲されており、内容が一致したため1件に統合。');
  return [p];
}

// ---- 14384 湯河原町: 令和７年度事務事業評価シート（既存の一覧と同名の事業は除外） ----
const YUGAWARA = ids('05e27f398d0b6c59eb2b13b7 079fc34fb46a0470e5c29ff3 2281e9d295cdc49913aacc33 28626e14349fb9033098d3f5 2c147ceea22a6fe64a3b2c34 453883207034875a1372ac77 4a196e194085c941cff00e72 4cc96be792bc4256c7e80b9a 4e53b926535db6d154fcc819 568c1d326a84812ae1f613eb 586fd747e32a1e81e8bae706 5ff37b178efa3d298313e35f 627927e9fcab0de261d04764 6cfa11ac32a674db807496dc 6d007b92ff71ce7860ca1294 79103a64054f307488a0e6f5 823b9be22ee9f0a290a7e628 8f9fbfe4167ac6b7ecb558f4 99dc58304c2c87f8193bf7e0 9e2fc9b1d832b501f48c2b52 a117a3b3d815e5ec5bbae350 b1de16c30acd1db3cdafc412 b90b97636d251993a2a39c5d bd7c7301cf917e207eaac7d2 c13ab561ae0c4fdd1afa715a c1497d512c98a706331917ff cd65229ce2fc1623d0ca3fec d88234e70824f88f7c9e8259 dd0b4440e54dc3ce05d6172a');
// Every other sheet name already exists in the structured 2025 list (16450.pdf); 図書等整備事業（湯河原中学校） is that list's row 197.
const YUGAWARA_NEW = new Set(['子どもフォーラム開催事業']);
function extractYugawara(input: CachedInput): ProjectEvaluation[] {
  if (!YUGAWARA.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/^令和７年度事務事業評価シート\n/gm)].map(m => m.index!);
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i], raw = t.slice(start, starts[i + 1] ?? t.length);
    const head = raw.match(/^令和７年度事務事業評価シート\n[^\n]*\n(\d+)\n事 業 番 号\n担当課等\n事 務 事 業 名 (.+)\n/);
    if (!head || !YUGAWARA_NEW.has(head[2])) continue;
    const p = project(input, head[1], head[2], 2025, head[0], start);
    p.evaluatedFiscalYear = 2024;
    const cost = raw.match(/区 分\n令和５年度（決算）\n令和６年度（決算）\n令和７年度（見込）\n事業費\n([\d,]+)\n([\d,]+)\n([\d,]+)\n[\s\S]*?人件費合計\n([\d,]+)\n([\d,]+)\n([\d,]+)\n総事業費\n([\d,]+)\n([\d,]+)\n([\d,]+)\n/);
    if (cost && [0, 1, 2].every(k => num(cost[1 + k]) + num(cost[4 + k]) === num(cost[7 + k]))) {
      const s = start + cost.index!;
      for (const k of [0, 1]) {
        const fy = 2023 + k;
        p.amounts.push({ kind: 'actual', fiscalYear: fy, amountYen: num(cost[1 + k]), rawValue: cost[1 + k], rawUnit: '円', evidence: evidence(input, cost[0], s) });
        p.amounts.push({ kind: 'personnel', fiscalYear: fy, amountYen: num(cost[4 + k]), rawValue: cost[4 + k], rawUnit: '円', evidence: evidence(input, cost[0], s) });
        p.amounts.push({ kind: 'fullCost', fiscalYear: fy, amountYen: num(cost[7 + k]), rawValue: cost[7 + k], rawUnit: '円', evidence: evidence(input, cost[0], s) });
      }
    }
    for (const [label, re] of [['一次評価 総合評価', /５ 一次評価（令和８年度以降の方向性に対する評価）\n総合評価\n\n([^\n]+)\n/], ['二次評価 総合評価', /７ 二次評価（[^\n]*\n総合評価\n\n([^\n]+)\n/]] as const) {
      const m = raw.match(re);
      if (m) p.ratings.push({ kind: 'self', label, value: m[1], scale: null, evidence: evidence(input, m[0], start + m.index!) });
    }
    p.warnings.push(BASE + '令和７年度評価シート（事業概要は令和６年度）。事業費・人件費・総事業費は令和５・６年度の決算列のみ（令和７年度見込は除外）。各年度で事業費＋人件費合計＝総事業費となる場合のみ採用。指標は列の対応が崩れているため未登録。他の評価シートは構造化済みの令和7年度評価一覧と同名のため除外。');
    out.push(p);
  }
  return out;
}

// ---- 06205 新庄市: 令和6年度事務事業評価シート（事後評価）柱2〜8 ----
const SHINJO = ids('1ec19ac122462935bc541739 350835c465034caee4b43505 735ed1a3270ae6c93f808221 abb3469872efc50466f5450c bf204ef13c954d81fdd75fc4 d9d7e0db3806eabc566fc2b2 e9e383dc10cdc59eb0574de3');
function shinjoSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const starts = [...t.matchAll(/^令和[6６]年度事務事業評価シート（事後評価）\n/gm)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const start = starts[i], raw = t.slice(start, starts[i + 1] ?? t.length);
    const name = raw.match(/１．事務事業の概要\n(?:事務事業名\n\n第５次総合計画体系\n\n([^\n]+)\n\n事業コード\n|事務事業名\n([^\n]+)\n\n第５次総合計画体系\n|([^\n]+)\n\n(?:事務事業名|事業コード)\n)/);
    const dept = raw.match(/担当部署\n\n([^\n]+)\n/);
    if (!name || !dept || !raw.includes('５．評価指標')) continue;
    const projectName = (name[1] ?? name[2] ?? name[3]).trim();
    if (/事務事業名|総合計画/.test(projectName)) continue;
    const codes = [...new Set([...raw.matchAll(/\n(\d-\d-[①-⑳他\d]-\d+)\n/g)].map(m => m[1]))];
    const code = codes.length === 1 ? codes[0] : null;
    const p = project(input, `${code}:${projectName}`, projectName, null, raw.slice(0, name.index! + name[0].length), start);
    p.projectCode = code; p.department = dept[1]; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, dept[0], start + dept.index!));
    p.warnings.push(BASE + '令和6年度事後評価票の対象年度を2024として保持し、評価実施年度は未設定。事業費・人員・指標の表は年度列の並びが崩れているため数値化しない。事業コードは書式どおりの値が1つだけ確認できる場合のみ設定。');
    out.push(p);
  }
  return out;
}
function extractShinjo(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (!SHINJO.has(input.sourceId)) return [];
  // All pillar books are read together so reprints across books merge and ambiguous name/code pairs drop.
  const all = inputs.filter(i => SHINJO.has(i.sourceId)).sort((a, b) => a.sourceId.localeCompare(b.sourceId))
    .flatMap(i => shinjoSheets(i).map(p => ({ i, p })));
  const codesByName = new Map<string, Set<string | null>>(), namesByCode = new Map<string, Set<string>>();
  for (const { p } of all) {
    codesByName.set(p.projectName, (codesByName.get(p.projectName) ?? new Set()).add(p.projectCode));
    if (p.projectCode) namesByCode.set(p.projectCode, (namesByCode.get(p.projectCode) ?? new Set()).add(p.projectName));
  }
  const out: ProjectEvaluation[] = [], seen = new Set<string>();
  for (const { i, p } of all) {
    const key = `${p.projectCode}\n${p.projectName}`;
    if (seen.has(key)) continue; seen.add(key);
    if (codesByName.get(p.projectName)!.size > 1 || (p.projectCode && namesByCode.get(p.projectCode)!.size > 1)) continue;
    const same = all.filter(x => `${x.p.projectCode}\n${x.p.projectName}` === key);
    if (new Set(same.map(x => x.p.department)).size > 1) continue;
    if (i.sourceId !== input.sourceId) continue;
    for (const x of same.slice(1)) p.evidence.push(...x.p.evidence);
    if (same.length > 1) p.warnings.push('同一事業コード・名称の再掲票を1件に統合（担当部署一致）。');
    out.push(p);
  }
  return out;
}

// ---- 12224 鎌ケ谷市: 令和7年度 事務事業評価 簡易評価表（評価順・施策順・組織順の3冊、いずれも途中で切れた抽出） ----
const KAMAGAYA_ORDER = ['5c1023896819ea322b436282', '55b74a4b5138fc8f08e0ddee', '135919a9eaa4b82e1ca6e974']; // 組織順・施策順・評価順
const KAMAGAYA_RATING = /(?:^|[ \n])([1-4])(拡大・拡充|精査・検証|縮小・統合|終了・廃止・休止)(?=[ \n])/g;
const KAMAGAYA_SCALE = '1拡大・拡充（資源を重点的に配分）／2精査・検証（資源の配分量を例年程度）／3縮小・統合（資源の配分量を減少）／4終了・廃止・休止';
interface KamagayaRow { key: string; name: string; account: string; item: string; raw: string; start: number; rating: { value: string; raw: string; start: number } | null }
function kamagayaRows(input: CachedInput): KamagayaRow[] {
  const t = input.text, rows: KamagayaRow[] = [];
  if (!t.includes('鎌ケ谷市事務事業評価表（簡易評価表）')) return rows;
  // Each printed page repeats the table title; page-number footers can land mid-page in the extraction.
  const pages = t.split(/(?=令和7年度\n\n鎌ケ谷市事務事業評価表（簡易評価表）)/);
  let offset = 0;
  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi], base = offset; offset += page.length;
    if (input.truncated && pi === pages.length - 1) continue;
    const all = [...page.matchAll(/会計名：/g)].length;
    const strict = [...page.matchAll(/会計名：(\S+)\n(\d+) ?款項目：([\d-]+)\n事業名：([^\n]*?(?:経費|事業))\n/g)];
    const ratings = [...page.matchAll(KAMAGAYA_RATING)];
    // Ratings are attached only when every row on the page carries the same category.
    const uniform = all > 0 && ratings.length === all && new Set(ratings.map(r => r[2])).size === 1 ? ratings[0] : null;
    for (const m of strict) {
      rows.push({ key: `${m[1]}|${m[3]}|${m[4]}`, name: m[4], account: m[1], item: m[3], raw: m[0], start: base + m.index!,
        rating: uniform ? { value: uniform[1] + uniform[2], raw: uniform[0].trim(), start: base + uniform.index! + uniform[0].indexOf(uniform[1]) } : null });
    }
  }
  return rows;
}
function extractKamagaya(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const rank = KAMAGAYA_ORDER.indexOf(input.sourceId);
  if (rank < 0) return [];
  const docs = KAMAGAYA_ORDER.map(id => inputs.find(i => i.sourceId === id)).map(d => d ? { d, rows: kamagayaRows(d) } : null);
  // A name printed under several accounts/budget items cannot be told apart without the department column: dropped.
  const keysByName = new Map<string, Set<string>>();
  for (const r of docs.flatMap(o => o?.rows ?? [])) keysByName.set(r.name, (keysByName.get(r.name) ?? new Set()).add(r.key));
  const out: ProjectEvaluation[] = [];
  const mine = docs[rank]!;
  for (const row of mine.rows) {
    if (keysByName.get(row.name)!.size > 1) continue;
    // Same key twice in one book (施策順 may repeat a project) or in a higher-priority book: handled once.
    if (mine.rows.find(r => r.key === row.key) !== row) continue;
    if (docs.slice(0, rank).some(o => o?.rows.some(r => r.key === row.key))) continue;
    const matches = docs.flatMap(o => o ? o.rows.filter(r => r.key === row.key).map(r => ({ d: o.d, r })) : []);
    const values = new Set(matches.map(x => x.r.rating?.value).filter(Boolean));
    if (values.size > 1) continue;
    const p = project(input, row.key, row.name, 2025, row.raw, row.start);
    p.projectCode = null;

    const title = input.text.indexOf('令和7年度\n\n鎌ケ谷市事務事業評価表（簡易評価表）');
    if (title >= 0) p.evidence.push(evidence(input, '令和7年度\n\n鎌ケ谷市事務事業評価表（簡易評価表）', title));
    for (const x of matches) {
      if (x.d !== input || x.r !== row) p.evidence.push(evidence(x.d, x.r.raw, x.r.start));
      if (x.r.rating && !p.ratings.length) p.ratings.push({ kind: 'self', label: '総合評価', value: x.r.rating.value, scale: KAMAGAYA_SCALE, evidence: evidence(x.d, x.r.rating.raw, x.r.rating.start) });
    }
    p.warnings.push(BASE + '簡易評価表は段組みが崩れて抽出されているため、事業名・会計名・款項目のみ行単位で確定。担当課・決算額・予算額は列の対応が確定できないため未登録。総合評価はページ内の全事業が同一区分の場合のみ付与。評価順・施策順・組織順の3冊の同一事業（会計名・款項目・事業名が一致）は1件に統合。抽出テキストは各冊とも途中で切れており全事業を網羅しない。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '11381': { extract: extractMisato, scope: '平成19・20年度の事務事業評価表（1事業1ファイル）から事業名・コード・主管課・内容と目的、平成20年度様式で財源内訳と整合する決算事業費を構造化。総合評価の選択番号・指標は対象外。' },
  '11385': { extract: extractKamisato, scope: '様式第１号 事務事業評価表（1事業1ファイル）から事業名・主管課・評価年度・第１次総合評価（●印の区分）を構造化。費用・指標・第２次評価は列崩れのため対象外。' },
  '14384': { extract: extractYugawara, scope: '令和７年度事務事業評価シートのうち、構造化済みの評価一覧にない事業のみ（決算事業費・人件費・総事業費、一次・二次総合評価）。一覧と同名の事業シートは対象外。' },
  '06205': { extract: extractShinjo, scope: '令和6年度事務事業評価シート（事後評価）柱2〜8の事業名・事業コード・担当部署を構造化。事業費・人員・評価指標の数値は列崩れのため対象外。' },
  '12224': { extract: extractKamagaya, scope: '令和7年度事務事業評価 簡易評価表（3冊・途中で切れた抽出）から事業名・会計名・款項目と、ページ内で一意に確定する総合評価のみ構造化。担当課・金額は対象外。' },
};
