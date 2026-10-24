import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { acrossDocuments, amount, num, type Entry } from '../batch9/i1-util';

const ZEN = '０１２３４５６７８９';
/** 令和の年数（全角・半角、「元」）を西暦に。 */
const reiwa = (s: string) => 2018 + (s === '元' ? 1 : Number([...s].map(c => (ZEN.includes(c) ? String(ZEN.indexOf(c)) : c)).join('')));
const isAmount = (s: string) => /^\d{1,3}(?:,\d{3})*$/.test(s);
const rating = (input: CachedInput, kind: EvaluationRating['kind'], label: string, value: string, scale: string | null, raw: string, start: number): EvaluationRating =>
  ({ kind, label, value, scale, evidence: evidence(input, raw, start) });
/** Split a text into sheets at each occurrence of a heading (absolute offsets kept). */
function sheets(text: string, heading: string): { start: number; text: string }[] {
  const starts: number[] = [];
  for (let i = text.indexOf(heading); i >= 0; i = text.indexOf(heading, i + 1)) starts.push(i);
  return starts.map((s, k) => ({ start: s, text: text.slice(s, starts[k + 1] ?? text.length) }));
}
const byNameYear = (p: ProjectEvaluation) => `${p.projectName}|${p.evaluatedFiscalYear}`;

// ---------------------------------------------------------------- 28213 西脇市（当初予算事業の概要説明書（兼評価説明書）＋外部評価結果）
const NISHIWAKI_SHEETS = new Set(['be8d90c70ebb38f11cdace5f', '76dd726fe91d021816bff44d', '9e3daa8807c1f932feac0b72', 'c705cd8960d4f398146faa5c']);
const NISHIWAKI_EXTERNAL = new Set(['666103ec32574f9cf206ff91', '986926f66915c4297b2d0951', 'ef794e8cd6a9ffbd4c8321b7']);
const NW_ITEMS = ['優先度（緊急性）', '必要性', '実施主体の妥当性', 'サービスの対象', '受益者負担の適切さ', '市民ニーズ'];
const NW_ITEM_SCALE = '５．そう思う／４．やや思う／３．どちらともいえない／２．あまり思わない／１．まったく思わない／－．わからない';
const NW_TOTAL = ['拡充', '継続実施', '見直し', '廃止'];
const NW_TOTAL_SCALE = '拡充／継続実施／見直し／廃止';

function extractNishiwaki(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '28213' || !NISHIWAKI_SHEETS.has(input.sourceId)) return [];
  const t = input.text;
  const title = /^令和(\d\d)年度\n\n当初予算事業の概要説明書\n（兼評価説明書）/.exec(t);
  const head = /\n要求区分\n\n([^\n]+)\n\n(\d{5})\n\n/.exec(t);
  if (!title || !head) return [];
  const name = head[1], year = reiwa(title[1]);
  const p = project(input, head[2], name, year, head[0].trim(), head.index + 1);
  p.evidence.push(evidence(input, title[0], 0));
  const dept = /\n\d\d ([^\n]+課)\n0795-/.exec(t);
  if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), dept.index + 1)); }
  const notes = [`西脇市「令和${title[1]}年度 当初予算事業の概要説明書（兼評価説明書）」1事業1枚。評価年度は表題の年度。事業コードは事務事業名の右の5桁番号。`];

  // ３．年度別事業費（千円）: 事業費の4列（決算3年＋予算1年）を財源内訳の各列の合計と照合できた場合のみ採用。
  const n4 = '\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)';
  const cost = new RegExp(`（単位：千円）\\n\\n業\\n\\n費${n4}\\n\\n令和(\\d\\d)年度決算額\\n令和(\\d\\d)年度決算額\\n令和(\\d\\d)年度決算額\\n令和(\\d\\d)年度予算額\\n\\n国庫支出金${n4}\\n\\n県支出金${n4}\\n\\n地 方 債${n4}\\n\\n分担金負担金 使用料手数料\\n${n4}\\n${n4}\\n\\nそ の 他${n4}`).exec(t);
  const general = new RegExp(`\\n一般財源${n4}\\n`).exec(t);
  if (cost) {
    const col = (g: number, k: number) => num(cost[g + k]);
    // 一般財源の4値が連続して取れない様式では、一般財源以外の財源だけで事業費と一致する（＝一般財源0）場合のみ採用。
    const sums = [0, 1, 2, 3].map(k => [9, 13, 17, 21, 25, 29].reduce((s, g) => s + col(g, k), 0) + (general ? num(general[1 + k]) : 0));
    if (sums.every((s, k) => s === col(1, k))) {
      [0, 1, 2, 3].forEach(k => p.amounts.push(amount(input, k < 3 ? 'actual' : 'budget', reiwa(cost[5 + k]), cost[1 + k], '千円', cost[0], cost.index)));
      if (general) p.evidence.push(evidence(input, general[0].trim(), general.index + 1));
      notes.push(general
        ? '年度別事業費は「事業費」の4列（令和N年度決算額×3・予算額×1）を、国庫支出金〜一般財源の各列の合計と一致することを確認して収録。'
        : '年度別事業費は「事業費」の4列（令和N年度決算額×3・予算額×1）を、国庫支出金〜その他の各列の合計と一致することを確認して収録（一般財源欄は抽出テキストで値が分離しているが、合計一致から0）。');
    } else notes.push('年度別事業費は財源内訳の合計と一致しないため未収録。');
  } else notes.push('年度別事業費は抽出テキストの列並びが確定しないため未収録。');
  // ４．総コストの概算: 人件費(Ａ)＋決算額(Ｂ)＝総コストの検算が合い、(Ｂ)が同年度の決算額と一致する場合のみ。
  const full = /\n([\d,]+)\n\n令和(\d\d)年度\n\n総コスト\n\n決算額（Ｂ）\n\n（Ａ）＋（Ｂ）\n\n?([\d,]+)\n\n([\d,]+)/.exec(t);
  if (full && num(full[1]) + num(full[3]) === num(full[4])) {
    const fy = reiwa(full[2]), actual = p.amounts.find(a => a.kind === 'actual' && a.fiscalYear === fy);
    if (actual && num(actual.rawValue) === num(full[3])) {
      p.amounts.push(amount(input, 'personnel', fy, full[1], '千円', full[0].trim(), full.index + 1));
      p.amounts.push(amount(input, 'fullCost', fy, full[4], '千円', full[0].trim(), full.index + 1));
      notes.push(`総コストの概算（令和${full[2]}年度）は人件費(Ａ)＋決算額(Ｂ)＝総コストの検算一致を確認して収録。`);
    }
  }
  // ６．評価 一次評価の事業の総合評価（選択肢の語が単独行で1つだけ現れる場合）。項目別の点数は列の対応が崩れるため未収録。
  const evalAt = t.indexOf('６．評価');
  if (evalAt >= 0) {
    const hits = [...t.slice(evalAt).matchAll(/\n(拡充|継続実施|見直し|廃止)\n/g)];
    if (hits.length === 1) p.ratings.push(rating(input, 'self', '一次評価 事業の総合評価', hits[0][1], NW_TOTAL_SCALE, hits[0][1], evalAt + hits[0].index! + 1));
  }
  notes.push('一次評価の項目別ポイント、活動指標・成果指標は抽出テキストで列（年度）の対応が確定しないため未収録。');

  // 外部評価結果（別資料・年度表記なし）: 事務事業名の行が一致する資料から、項目別評価と総合評価（☑）を収録。
  const ext = inputs.filter(i => NISHIWAKI_EXTERNAL.has(i.sourceId) && i.text.startsWith('外部評価結果') && i.text.split('\n').includes(name));
  if (ext.length === 1) {
    const e = ext[0], et = e.text;
    const items: EvaluationRating[] = [];
    for (const label of NW_ITEMS) {
      const esc = label.replace(/[()（）]/g, m => `\\${m}`);
      const m = new RegExp(`\\n\\n(${esc})\\n\\n((?:[^\\n]+\\n)*?[^\\n]+)\\n\\n([１２３４５－])\\n`).exec(et);
      if (m) items.push(rating(e, 'external', `外部評価 ${label}`, m[3], NW_ITEM_SCALE, m[0].trim(), m.index + 2));
    }
    const checked = [...et.matchAll(/☑(\S+)/g)].filter(m => NW_TOTAL.includes(m[1]));
    if (items.length === NW_ITEMS.length) p.ratings.push(...items);
    if (checked.length === 1) p.ratings.push(rating(e, 'external', '外部評価 総合評価', checked[0][1], NW_TOTAL_SCALE, checked[0][0], checked[0].index!));
    const names = et.slice(0, et.indexOf('５．そう思う')).split('\n').filter(l => /事業$/.test(l) && l !== '事務事業名');
    notes.push(`外部評価結果は別資料（${e.sourceUrl}）。資料内に年度の記載がないため、事務事業名の一致で本票に対応付けた。${names.length > 1 ? `この外部評価結果は「${names.join('」「')}」の${names.length}事業を1枚で評価したもの。` : ''}`);
  }
  p.warnings.push(notes.join(''));
  return [p];
}

// ---------------------------------------------------------------- 01331 松前町（教育委員会の事務・事業の点検及び評価シート）
const MATSUMAE_SOURCES = new Set(['1483b7546a044cb3f434b316', '251a6f0e4fbfed11c2623a39', 'c3e0c45615c637d65dd4a5a4']);
const MM_LABELS = ['事業内容', '財政面', '目的達成度', '総合評価'];
const MM_SCALE = '要改善 要検討 妥当 良好（1〜4の列。○囲みの数字が該当）';

/** Circled scores (①〜④ on their own line) of one score block, with the run of 1-4 lines around each as evidence. */
function circled(input: CachedInput, seg: string, segStart: number) {
  return [...seg.matchAll(/(?<=\n)[①②③④](?=\n)/g)].map(m => {
    let a = m.index!, b = a + 1;
    const step = /^(?:\n+[1-4①②③④])/;
    while (true) { const back = /(?:[1-4①②③④]\n+)$/.exec(seg.slice(Math.max(0, a - 4), a)); if (!back) break; a -= back[0].length; }
    while (true) { const fwd = step.exec(seg.slice(b, b + 4)); if (!fwd) break; b += fwd[0].length; }
    return { value: m[0], raw: seg.slice(a, b), start: segStart + a };
  });
}

function matsumaeOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01331' || !MATSUMAE_SOURCES.has(input.sourceId)) return [];
  const t = input.text;
  const docYear = /^令和(\S)年度\n\n教育委員会の事務・事業の点検及び評価シート/.exec(t);
  if (!docYear) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(t, '教育委員会の事務・事業の点検及び評価シート')) {
    const s = sh.text;
    const fy = /令和(\S)年度事務・事業分/.exec(s);
    const head = /事務事業番号\n(\d+)\n事務事業名 ([^\n]+)\n(?:担当名|\n担当課名)\n/.exec(s)
      ?? /事務事業番号\n事務事業名\n\n令和\S年度事務・事業分\n\n】\n\n(\d+)\n([^\n]+)\n担当名\n/.exec(s);
    if (!fy || !head) continue;
    const p = project(input, head[1], head[2].trim(), reiwa(docYear[1]), head[0].trim(), sh.start + head.index);
    p.evaluatedFiscalYear = reiwa(fy[1]);
    p.evidence.push(evidence(input, docYear[0], 0), evidence(input, fy[0], sh.start + fy.index));
    const dept = /\n([^\s\n]+課[^\s\n]*係)\n/.exec(s);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[1], sh.start + dept.index + 1)); }
    const notes = [`松前町教育委員会「事務・事業の点検及び評価シート」（令和${docYear[1]}年度、令和${fy[1]}年度事務・事業分）。評価年度は表題、評価対象年度は「令和${fy[1]}年度事務・事業分」。`];
    // 予算の状況（千円）: 節ごとの「番号 節名\n金額」が連続し、その合計が「計」と一致する場合のみ予算額として収録。
    const budgetAt = s.indexOf('金額(千円)\n');
    const budgetYear = /令和(\S)年度 予算の状況/.exec(s);
    if (budgetAt >= 0 && budgetYear && budgetYear[1] === fy[1]) {
      const pairs = /^(?:\d+ [^\n\d]+\n[\d,]+\n)+/.exec(s.slice(budgetAt + 8));
      const total = /\n計\n([\d,]+)\n/.exec(s);
      if (pairs && total && isAmount(total[1])) {
        const sum = [...pairs[0].matchAll(/\n([\d,]+)\n/g)].reduce((a, m) => a + num(m[1]), 0);
        if (sum === num(total[1])) {
          p.amounts.push(amount(input, 'budget', p.evaluatedFiscalYear, total[1], '千円', total[0].trim(), sh.start + total.index + 1));
          p.evidence.push(evidence(input, pairs[0].trimEnd(), sh.start + budgetAt + 8));
          notes.push(`金額は「令和${fy[1]}年度 予算の状況」の計（千円）。節別金額の合計と一致することを確認。`);
        }
      }
    }
    // 点数による評価: 自己評価・外部評価それぞれ○囲み数字がちょうど4つ（事業内容・財政面・目的達成度・総合評価の順）の場合のみ。
    const selfAt = s.indexOf('事業評価（自己評価）'), extAt = s.indexOf('外部評価の点検・評価の概要');
    const blocks: [EvaluationRating['kind'], string, number, number][] = [];
    if (selfAt >= 0 && extAt > selfAt) blocks.push(['self', '自己評価', selfAt, extAt]);
    if (extAt >= 0) blocks.push(['external', '外部評価', extAt, s.length]);
    for (const [kind, who, a, b] of blocks) {
      const seg = s.slice(a, b), c = circled(input, seg, sh.start + a);
      if (c.length === 4 && /事 ?業 ?内 ?容/.test(seg) && /財\s*政\s*面/.test(seg) && /目\s*的\s*達\s*成\s*度/.test(seg))
        c.forEach((x, k) => p.ratings.push(rating(input, kind, `${who} ${MM_LABELS[k]}`, x.value, MM_SCALE, x.raw, x.start)));
      else notes.push(`${who}の点数は○囲み数字が4つ揃わない（抽出テキストで丸囲みが失われた・崩れた）ため未収録。`);
    }
    notes.push('決算額の推移・指標で表せない効果等は列の対応が崩れるため未収録。');
    p.warnings.push(notes.join(''));
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 01459 美瑛町（まちづくり評価調書／個別施策評価調書の小事業一覧）
const BIEI_R2 = '04b5e4fd3efb57bdd6c7101c', BIEI_R3 = '8d492de7dc2f663f4686cad4', BIEI_R4 = '40bb2bd6c2b82592db017458';
const BIEI_R2_SCALE = '事業拡大／継続／内容見直し継続／他事業に統合／休止／事業廃止';
const BIEI_R3_SCALE = '拡充／現状継続／改善継続／縮小／統合／休止／廃止／完了';

/** 財源内訳の数値列: 先頭（事業費）＝残り（財源）の合計 のときだけ事業費を返す。 */
function checkedTotal(block: string): string | null {
  const ns = block.split('\n').filter(l => isAmount(l));
  if (ns.length < 2) return null;
  return num(ns[0]) === ns.slice(1).reduce((a, s) => a + num(s), 0) ? ns[0] : null;
}

function bieiR2(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = /^令和(\S)年（令和(\S)年度事業）美瑛町まちづくり評価一覧表/.exec(t);
  if (!title) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(t, '美瑛町まちづくり評価調書')) {
    const s = sh.text;
    const pre = t.lastIndexOf('令和', sh.start), fyM = /^令和(\S)年度事業\n[１-９\d]+\n\n$/.exec(t.slice(pre, sh.start));
    const head = /^美瑛町まちづくり評価調書\n\n事業概要\n事業名\n\n([^\n]+)\n\n担当課・係名\n/.exec(s);
    if (!fyM || !head || reiwa(fyM[1]) + 1 !== reiwa(title[1])) continue;
    const name = head[1].trim(), fy = reiwa(fyM[1]);
    const p = project(input, name, name, reiwa(title[1]), `事業名\n\n${head[1]}`, sh.start + s.indexOf('事業名\n\n'));
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], 0), evidence(input, fyM[0].split('\n')[0], pre));
    // 担当課・係名は直後の行、または「事業の概要・目的」見出しの直後の行にある場合のみ（他の位置は列ずれのため未設定）。
    const dept = /^(?:\n([^\n]+(?:係|課|室|館|センター))\n|事業の概要・目的\n\n([^\n]+(?:係|課))\n)/.exec(s.slice(head[0].length));
    if (dept) {
      p.department = dept[1] ?? dept[2];
      p.evidence.push(evidence(input, p.department, sh.start + head[0].length + dept[0].indexOf(p.department)));
    }
    const notes = [`美瑛町まちづくり評価調書（令和${fyM[1]}年度事業、1事業1枚）。評価年度は資料表題「令和${title[1]}年（令和${fyM[1]}年度事業）」の令和${title[1]}年。`];
    const costM = /事業決算額\n（単位：円）\n\n([\s\S]*?)\n\n（公共事業記載欄）/.exec(s);
    const total = costM ? checkedTotal(costM[1]) : null;
    if (costM && total) {
      p.amounts.push(amount(input, 'actual', fy, total, '円', costM[0], sh.start + costM.index));
      notes.push('金額は「当該年度事業費 事業決算額（単位：円）」。財源内訳の合計と一致することを確認。');
    } else notes.push('事業決算額は財源内訳との合計照合ができないため未収録。');
    const evalAt = s.indexOf('評価検討委員会評価結果（２次評価）');
    if (evalAt >= 0) {
      const hits = [...s.slice(evalAt).matchAll(/\n■(事業拡大|継続|内容見直し継続|他事業に統合|休止|事業廃止)(?=\n|$)/g)];
      const boxes = [...s.slice(evalAt).matchAll(/\n[■□](?:事業拡大|継続|内容見直し継続|他事業に統合|休止|事業廃止)(?=\n|$)/g)];
      if (hits.length === 1 && boxes.length === 6) {
        p.ratings.push(rating(input, 'external', '評価検討委員会評価結果（２次評価）', hits[0][1], BIEI_R2_SCALE, `■${hits[0][1]}`, sh.start + evalAt + hits[0].index! + 1));
        const target = /^評価検討委員会評価結果（２次評価）※令和(\S)年度実施に向けた事業評価/.exec(s.slice(evalAt));
        if (target) p.evidence.push(evidence(input, target[0], sh.start + evalAt));
        notes.push(`評価は評価検討委員会の２次評価${target ? `（令和${target[1]}年度実施に向けた事業評価）` : ''}。`);
      }
    }
    notes.push('項目別事業評価（１次評価）のチェック欄と評価指標の目標値・実績値は列の対応が崩れるため未収録。一覧表の「評価結果（案）」も未収録。');
    p.warnings.push(notes.join(''));
    out.push(p);
  }
  return out;
}

function bieiR3(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = /^令和(\S)年（令和(\S)年度事業）美瑛町まちづくり評価一覧表/.exec(t);
  if (!title) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(t, '美瑛町まちづくり評価調書')) {
    const s = sh.text, pre = t.lastIndexOf('令和', sh.start), fyM = /^令和(\S)年度事業\n\n$/.exec(t.slice(pre, sh.start));
    const head = /^美瑛町まちづくり評価調書\n\n(?:１\n事\n\n事業内容\n業|１ 事業内容\n事\n業)\n名 ([^\n]+?)(?: 経 費 区 分)?\n/.exec(s);
    if (!fyM || !head || reiwa(fyM[1]) + 1 !== reiwa(title[1])) continue;
    const name = head[1].trim(), fy = reiwa(fyM[1]);
    const p = project(input, name, name, reiwa(title[1]), `名 ${head[1]}`, sh.start + s.indexOf(`名 ${head[1]}`));
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], 0), evidence(input, `令和${fyM[1]}年度事業`, pre));
    const dept = /\n(?:担\n当\n課\n名|担 当 課 名)\n([^\n]+)\n/.exec(s);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), sh.start + dept.index + 1)); }
    const notes = [`美瑛町まちづくり評価調書（令和${fyM[1]}年度事業、1事業1枚）。評価年度は資料表題「令和${title[1]}年（令和${fyM[1]}年度事業）」の令和${title[1]}年。`];
    // この様式の「事業費（単位：円）」は決算額か予算額かが本文で明示されないため金額は収録しない。
    notes.push('「事業費（単位：円）」欄は決算額・予算額の別が本文に明記されないため金額は未収録。');
    const evalAt = s.indexOf('２次評価（評価検討委員会）');
    if (evalAt >= 0) {
      const seg = s.slice(evalAt, s.indexOf('まちづくり委員会の意見', evalAt) >= 0 ? s.indexOf('まちづくり委員会の意見', evalAt) : s.length);
      const hits = [...seg.matchAll(/\n■(拡充|現状継続|改善継続|縮小|統合|休止|廃止|完了)(?=\n|$)/g)];
      const boxes = [...seg.matchAll(/\n[■□](?:拡充|現状継続|改善継続|縮小|統合|休止|廃止|完了)(?=\n|$)/g)];
      const target = /※令和(\S)年度実施に向けた評価/.exec(seg);
      if (hits.length === 1 && boxes.length === 8) {
        p.ratings.push(rating(input, 'external', '２次評価（評価検討委員会）', hits[0][1], BIEI_R3_SCALE, `■${hits[0][1]}`, sh.start + evalAt + hits[0].index! + 1));
        if (target) p.evidence.push(evidence(input, target[0], sh.start + evalAt + target.index));
        notes.push(`評価は評価検討委員会の２次評価${target ? `（令和${target[1]}年度実施に向けた評価）` : ''}。`);
      }
    }
    notes.push('１次評価（担当課）のチェック欄と評価指標の目標値・実績値は列の対応が崩れるため未収録。一覧表の「評価結果（案）」も未収録。');
    p.warnings.push(notes.join(''));
    out.push(p);
  }
  return out;
}

/** 第６次総合計画 個別施策評価調書（令和4年度）の「個別施策を構成する小事業の評価結果等」の行。 */
function bieiR4(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith('第６次美瑛町まちづくり総合計画\n\n個別施策評価調書')) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(t, '個別施策を構成する小事業の評価結果等')) {
    const end = sh.text.indexOf('個別施策の視点別評価');
    const head = sh.text.indexOf('R4年度決算額');
    const prog = t.lastIndexOf('進捗状況（令和4年度）', sh.start);
    if (end < 0 || head < 0 || head > end || prog < 0) continue;
    const sec = sh.text.slice(0, end);
    for (const m of sec.matchAll(/(?<=\n)([①-⑳])\n\n([^\n]+)\n\n([^\n]+(?:係|課))\n\n(\d{1,3}(?:,\d{3})*)(?:\n\n| )(継続／[^\n]+|終了)\n\n([A-E])\n/g)) {
      const name = m[2].trim(), at = sh.start + m.index!;
      const p = project(input, name, name, null, m[0].trimEnd(), at);
      p.projectCode = null;
      p.evaluatedFiscalYear = 2022;
      p.department = m[3];
      p.evidence.push(evidence(input, 'R4年度決算額', sh.start + head));
      p.amounts.push(amount(input, 'actual', 2022, m[4], '千円', m[4], at + m[0].indexOf(`\n\n${m[3]}\n\n${m[4]}`) + m[3].length + 4));
      p.ratings.push(rating(input, 'self', '今後の展開方向', m[5], null, m[5], at + m[0].lastIndexOf(m[5], m[0].length - 4)));
      p.warnings.push('美瑛町 第６次まちづくり総合計画 個別施策評価調書（進捗状況：令和4年度）の「個別施策を構成する小事業の評価結果等」の表の行（小事業＝事務事業単位）。金額は「R4年度決算額（千円）」。担当は担当係名欄のまま。評価年度は本文に明記がないため未設定。「個別施策への貢献度」は施策ごとの評価で同じ小事業でも施策により異なるため未収録。複数の施策に掲載された小事業は値が一致する場合のみ1件に統合し、食い違う場合は除外。行の列が崩れた（№・事業名・係・金額・展開方向・貢献度が連続しない）行は対象外。');
      out.push(p);
    }
  }
  return out;
}

function bieiOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01459') return [];
  if (input.sourceId === BIEI_R2) return bieiR2(input);
  if (input.sourceId === BIEI_R3) return bieiR3(input);
  if (input.sourceId === BIEI_R4) return bieiR4(input);
  return [];
}

// ---------------------------------------------------------------- 07541 広野町（復興交付金事業計画の個別事業の実績に関する評価様式）
const HIRONO_SOURCES = new Set(['3df40c5e39791c2ae3e5e233', 'c385e8256bd7dd67e633fa71', 'ec79701cad50c3bc546fb4db', 'f9365d5ecc0e5821cb3a18e3']);
function hironoOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07541' || !HIRONO_SOURCES.has(input.sourceId)) return [];
  const t = input.text, form = '【復興交付金事業計画の個別事業の実績に関する評価様式】';
  if (!t.startsWith(form)) return [];
  const pairs = [...t.matchAll(/事業番号 ([^\n]+)\n事業名\n([^\n]+)\n/g)].map(m => ({ code: m[1].trim(), name: m[2].trim(), raw: m[0].trimEnd(), at: m.index! }));
  const alt = /^【[^\n]+】\n事業番号\n事業名\n\n([^\n]+)\n([^\n]+)\n/.exec(t);
  if (!pairs.length && alt) pairs.push({ code: alt[1].trim(), name: alt[2].trim(), raw: alt[0].slice(form.length + 1).trimEnd(), at: form.length + 1 });
  const dept = /\n事業担当部局\n([^\n]+?課)(?: 電話番号|\n)/.exec(t);
  return pairs.map(x => {
    const p = project(input, x.code, x.name, null, x.raw, x.at);
    p.evidence.push(evidence(input, form, 0));
    if (dept) { p.department = dept[1].trim(); p.evidence.push(evidence(input, dept[0].trim(), dept.index + 1)); }
    p.warnings.push(`広野町復興交付金事業計画の個別事業の実績に関する評価様式（事業番号 ${x.code}）。事務事業評価ではなく復興交付金事業の事後評価で、事業担当部局は福島県。${pairs.length > 1 ? `同じ評価様式で${pairs.length}事業（${pairs.map(q => q.code).join('・')}）をまとめて評価している。` : ''}事業費は複数年度（事業期間）の総額で単一年度に確定しないため未収録。評価は文章のみで記号・区分がないため ratings なし。評価年度・評価対象年度は本文に明記がないため未設定。`);
    return p;
  });
}

const keep = (one: (i: CachedInput, all: CachedInput[]) => ProjectEvaluation[]) => (input: CachedInput, inputs: CachedInput[]) =>
  acrossDocuments(input, inputs, i => one(i, inputs), byNameYear);

export const entries: Record<string, Entry> = {
  '28213': { extract: keep(extractNishiwaki), scope: '西脇市 令和5年度「当初予算事業の概要説明書（兼評価説明書）」4事業の事業名・事業コード・担当課・年度別事業費（決算3年・予算1年、財源内訳の合計照合済み）・総コスト・一次評価の総合評価と、別資料「外部評価結果」の項目別評価・総合評価。活動/成果指標・一次評価の項目別ポイントは列が崩れるため対象外。' },
  '01331': { extract: keep(matsumaeOne), scope: '松前町 教育委員会の事務・事業の点検及び評価シート（令和3〜5年度事務・事業分）の事務事業名・番号・担当係・予算額（節別合計と一致する場合）・自己評価/外部評価の点数（○囲みが4つ揃う場合）。決算額の推移、事業名が複数行に崩れたシートは対象外。' },
  '01459': { extract: keep(bieiOne), scope: '美瑛町 まちづくり評価調書（令和元年度・2年度事業）の事業名・担当課係・２次評価（評価検討委員会）と、令和元年度事業分の事業決算額（財源内訳と照合、2年度事業分は決算/予算の別が不明のため金額なし）、第６次総合計画 個別施策評価調書（令和4年度）の小事業一覧の行（決算額・今後の展開方向）。施策評価本体、令和5年度調書（財源列で崩れる）、評価一覧表の指標、行政区アンケート・提案事業一覧は対象外。' },
  '07541': { extract: keep(hironoOne), scope: '広野町 復興交付金事業計画の個別事業の実績に関する評価様式（テキストのある4資料・5事業）の事業番号・事業名・事業担当部局のみの部分構造化。事務事業評価ではなく復興交付金の事後評価。総合的な実績評価様式、画像のみの資料、事業費（複数年度総額）は対象外。' },
};
