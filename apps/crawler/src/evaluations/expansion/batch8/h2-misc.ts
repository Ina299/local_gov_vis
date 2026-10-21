import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, dedupe, num } from '../batch7/g7-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const isNumLine = (l: string) => /^[\d,.\s%％△-]+$/.test(l.trim());
const hasNumLine = (s: string) => s.split('\n').some(l => l.trim() !== '' && isNumLine(l));

/**
 * 北広島町 令和６年度主要施策の概要（主要施策成果シート）。施策ページ（成果指標表）は対象外。
 * 決算データは「R6/R5/R4」見出し直後に事業費3列が並び、財源内訳の各行（3列）の列合計が事業費と一致する場合のみ採用。
 */
const KITAHIROSHIMA = '5565c33146172695cb5c5757';
function kitahiroshima(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34369' || input.sourceId !== KITAHIROSHIMA) return [];
  const t = input.text, title = '令和６年度主要施策の概要';
  const titleAt = t.indexOf(title);
  if (titleAt < 0) return [];
  const heads = [...t.matchAll(/主要施策成果シート\n/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index!, end = heads[i + 1]?.index ?? t.length;
    if (input.truncated && i === heads.length - 1) continue;
    const seg = t.slice(start, end);
    const nm = seg.match(/\n事業名\n\n([^\n]+)\n/);
    const fy = seg.match(/\n対象年度\n\n/);
    if (!nm || !fy || !seg.includes('事業成果\n（目標達成状況）')) continue;
    const p = project(input, nm[1].trim(), nm[1].trim(), null, nm[0].trim(), start + nm.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title, titleAt));
    const dept = seg.match(/\n担当課\n\n([^\n]+)\n/);
    if (dept) { p.department = dept[1].trim(); p.evidence.push(evidence(input, dept[0].trim(), start + dept.index! + 1)); }
    const purpose = seg.match(/\n目的\n\n(?:（円）\n\n)?([\s\S]+?)\n+内容（箇条書き）/);
    if (purpose && !hasNumLine(purpose[1]) && !/（円）|事業費|一般財源/.test(purpose[1])) {
      p.purpose = purpose[1].trim();
      p.evidence.push(evidence(input, purpose[1].trim(), start + purpose.index! + purpose[0].indexOf(purpose[1].trim())));
    }
    // 事業概要（内容・事業費）の本文が「事業成果」見出しより前にある（内容見出し→事業費（円）と数値→事業概要見出し→事業成果見出し）場合のみ。
    const outc = seg.match(/\n内容（箇条書き）\n(?:(?!事業成果)[\s\S])*?\n事業費（円）\n(?:[^\n]*\n)*?[\d,]+\n\n事業概要\n（手段、手法など）\n\n事業成果\n（目標達成状況）\n\n([\s\S]+?)\n\n課題・問題点\n\n/);
    if (outc && !hasNumLine(outc[1]) && !/事業費（円）|内容（箇条書き）|事業概要/.test(outc[1])) {
      p.outcomes = outc[1].trim();
      p.evidence.push(evidence(input, outc[1].trim(), start + outc.index! + outc[0].lastIndexOf(outc[1])));
    }
    const fin = seg.match(/(R[６6]年度\n\nR[５5]年度\n\n(?:Ｐ\.[^\n]*\n\n)?[ＲR][４4]年度\n\n)事業費\n\n（円）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n国県支出金\n/);
    if (fin) {
      const blockStart = fin.index!, purposeAt = seg.indexOf('\n目的\n', blockStart);
      const block = seg.slice(blockStart + fin[1].length, purposeAt > 0 ? purposeAt : undefined);
      const groups: number[][] = []; let cur: number[] = [];
      for (const line of block.split('\n')) {
        const l = line.trim(); if (!l) continue;
        if (/^[\d,]+$/.test(l)) cur.push(num(l)); else if (cur.length) { groups.push(cur); cur = []; }
      }
      if (cur.length) groups.push(cur);
      const ok = purposeAt > 0 && groups.length >= 2 && groups.every(g => g.length === 3)
        && [0, 1, 2].every(k => groups.slice(1).reduce((s, g) => s + g[k], 0) === groups[0][k]);
      if (ok) {
        const raw = fin[0].trimEnd(), at = start + fin.index!;
        [2024, 2023, 2022].forEach((y, k) => p.amounts.push(amount(input, 'actual', y, fin[2 + k], '円', raw, at)));
      }
    }
    p.warnings.push('北広島町「令和６年度主要施策の概要」（令和７年度 主要施策の成果に関する調書（令和６年度決算資料）をまちづくり総合委員会資料として再編集）の主要施策成果シート。評価実施年度は本文で特定できないため未設定、対象年度R6を評価対象年度とした。');
    p.warnings.push('決算データ（事業費）は「R６年度／R５年度／Ｒ４年度」見出しの直後に事業費3列が並び、財源内訳の各行が3列ずつで列合計が事業費と一致する場合のみ、見出し順にR6・R5・R4決算として採用（単位：円）。それ以外は列対応が確定できないため不採用。事業成果は「事業成果（目標達成状況）」見出しと「課題・問題点」見出しの間に本文がある場合のみ収録（課題・問題点欄は欄の境界が確定できないため未収録）。施策ページの成果指標は施策単位のため対象外。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}

/** 西海市 令和６年度 主要施策成果説明書（一般会計等の事業別ページ）。款項目別の予算額・決算額一覧ページは対象外。 */
const SAIKAI = '0ca67a1c6dec04bd78ccd450';
function saikai(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42212' || input.sourceId !== SAIKAI) return [];
  const t = input.text, title = '令和６年度\n\n主要施策成果説明書';
  if (!t.startsWith(title)) return [];
  // ページ末尾は「\n\n<頁番号>\n\n\n」。1ページに「事業名称」が1つだけのページを1事業として扱う。
  const breaks = [...t.matchAll(/\n\n\d+\n\n\n/g)].map(m => m.index! + m[0].length);
  const bounds = [0, ...breaks];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < bounds.length; i++) {
    const start = bounds[i], end = bounds[i + 1] ?? t.length;
    if (end === t.length && input.truncated) continue;
    const page = t.slice(start, end);
    if (page.split('事業名称').length !== 2) continue;
    const nm = page.match(/\n事業名称\n\n([^\n]+?)（Ｐ[^\n）]*）\n/);
    if (!nm || !page.includes('事業評価')) continue;
    const name = nm[1].trim();
    const p = project(input, name, name, null, nm[0].trim(), start + nm.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title, 0));
    const code = page.match(/^款項目(\d{6})\n/m);
    if (code) p.evidence.push(evidence(input, code[0].trim(), start + code.index!));
    const after = page.match(/\n所管課\n\n([^\n]+)\n/), before = page.match(/\n([^\n]+)\n\n所管課\n/);
    const deptOk = (s: string) => /(課|室|局|センター|事務所)$/.test(s.trim()) && !/目標|政策|施策/.test(s);
    const dm = after && deptOk(after[1]) ? after : before && deptOk(before[1]) ? before : null;
    if (dm) { p.department = dm[1].trim(); p.evidence.push(evidence(input, dm[0].trim(), start + dm.index! + 1)); }
    // 予算額・決算額: 「当初予算額\n説\n\n…<数>\n明」「最終予算額\n\n<数>\n\n金額（円）」「決算額\n明\n\n<数>\n金額（円）」の順に一意に並ぶ場合のみ。
    const am = page.match(/\n当初予算額\n説\n\n(?:主な支出\n\n)?(?:事業目的\n及び\n事業内容\n\n)?(?:成果・実績\n\n)?([\d,]+)\n明\n\n(?:[^\n\d][^\n]*\n\n)?(?:[^\n\d][^\n]*\n\n)?最終予算額\n\n([\d,]+)\n\n金額（円）\n\n説\n\n決算額\n明\n\n([\d,]+)\n金額（円）\n/);
    if (am) {
      const finalBudget = num(am[2]), actual = num(am[3]);
      // 主な支出の内訳金額より小さい値は決算額ではない可能性があるため不採用。
      const items = [...page.slice(am.index! + am[0].length).matchAll(/^([\d,]{4,})(?: [^\n]*)?$/gm)].map(m => num(m[1]));
      if (actual <= finalBudget && items.every(v => v <= actual)) {
        const raw = am[0].slice(1, -1), at = start + am.index! + 1;
        p.amounts.push(amount(input, 'budget', 2024, am[2], '円', raw, at), amount(input, 'actual', 2024, am[3], '円', raw, at));
      }
    }
    // 事業評価欄: 「成果・実績」見出しの直後に「事業評価」見出しが続くページは成果本文が事業評価見出しの後に来るため不採用。
    const ev = page.match(/\n\n事業評価\n\n([\s\S]+?)\n\n\d+\n\n\n/) ?? page.match(/\n\n事業評価\n\n([\s\S]+)$/);
    if (ev && !/成果・実績\n\n事業評価\n/.test(page) && !/実績】|成果】|【実績|給付実績|円）/.test(ev[1]) && !/^[\d,]/.test(ev[1].trim()) && ev[1].trim().length >= 20) {
      p.outcomes = ev[1].trim();
      p.evidence.push(evidence(input, ev[1].trim(), start + ev.index! + ev[0].indexOf(ev[1].trim())));
    }
    if (!p.outcomes) continue; // 評価要素（事業評価欄）が確定できないページは返さない。
    p.warnings.push('西海市 令和６年度 主要施策成果説明書の事業別ページ（1ページに事業名称が1つだけのページ）。outcomesは「事業評価」欄の本文（成果・実績の見出しと事業評価見出しが連続し本文の帰属が確定できないページは除外）。評価実施年度は本文で特定できないため未設定。');
    p.warnings.push('予算額（最終予算額）・決算額は見出しと数値が所定の順で並び、決算額≦最終予算額かつ主な支出の各内訳金額≦決算額の場合のみ採用（単位：円）。当初予算額・繰越予算額・主な支出・成果・実績の数値は未収録。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}

/** 木古内町: 北海道 電源立地地域対策交付金 事業評価総括表・個表（令和6年度、道内市町村合冊）のうち交付金事業者名が木古内町の個表のみ。 */
const KIKONAI = '2f45b20bfa1bf4e1ea8a813e';
function kikonai(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01334' || input.sourceId !== KIKONAI) return [];
  const t = input.text;
  const sumRaw = '交付金事業の名称\n\n木古内町パークゴルフ場運営事業\n\n交付金事業者名又は\n間接交付金事業者名\n\n木古内町\n\n交付金事業に\n要した経費\n\n1,999,000\n\n交付金充当額\n\n備\n\n考\n\n1,999,000 総事業費 2,361,690';
  const sumAt = t.indexOf(sumRaw);
  if (sumAt < 0 || t.indexOf(sumRaw, sumAt + 1) >= 0) return [];
  const head = 'Ⅱ．事業評価個表（令和6年度）';
  const from = t.indexOf(head, sumAt), to = t.indexOf('\n別紙\n', from);
  if (from < 0 || to < 0) return [];
  const sheet = t.slice(from, to);
  const nameRaw = '交付金事業の名称\n木古内町パークゴルフ場運営事業\n木古内町\n';
  if (!sheet.includes(nameRaw)) return [];
  const p = project(input, 'kikonai-parkgolf', '木古内町パークゴルフ場運営事業', 2024, nameRaw.trim(), from + sheet.indexOf(nameRaw));
  p.projectCode = null;
  p.evaluatedFiscalYear = 2024;
  p.evidence.push(evidence(input, head, from), evidence(input, sumRaw, sumAt));
  const act = '開場時期の5月～11月における作業員（会計年度任用職員）4名の人件費に交付金の一部を充当します。';
  if (sheet.includes(act)) p.activities = act;
  const oc = sheet.match(/交付金事業の定性的な成果及び評価等\n及び成果実績\n\n令和6年度\n\n([\s\S]+?)\n\n活動指標\n/);
  if (oc) { p.outcomes = oc[1].trim(); p.evidence.push(evidence(input, oc[1].trim(), from + oc.index! + oc[0].indexOf(oc[1]))); }
  const res = sheet.match(/単位 評価年度\n成果実績\n人\n([\d,]+)\n合計利用者数\n目標値\n人\n([\d,]+)\n合計利用者数\n/);
  if (res && sheet.includes('及び成果実績\n\n令和6年度\n'))
    p.indicators.push({ name: '【成果指標】合計利用者数', fiscalYear: 2024, target: res[2], actual: res[1], unit: '人', evidence: evidence(input, res[0].trim(), from + res.index!) });
  const actName = '会計年度任用職員の\n雇用量雇用時間（時間）';
  const a45 = sheet.match(/単位\n令和4年度\n令和5年度\n活動実績 時間\n([\d,]+)\n([\d,]+)\n活動見込 時間\n([\d,]+)\n([\d,]+)\n達成度\n％\n([\d.]+)%\n([\d.]+)%\n/);
  const a6 = sheet.match(/\n令和6年度\n([\d,]+)\n([\d,]+)\n([\d.]+)%\n備\n/);
  if (sheet.includes(actName) && a45 && a6) {
    // 達成度（実績÷見込）が各年度で一致することを確認してから採用。
    const rows: [number, string, string, string, string, number][] = [
      [2022, a45[1], a45[3], a45[5], a45[0].trim(), from + a45.index!], [2023, a45[2], a45[4], a45[6], a45[0].trim(), from + a45.index!],
      [2024, a6[1], a6[2], a6[3], a6[0].trim(), from + a6.index! + 1]];
    if (rows.every(r => Math.abs(num(r[1]) / num(r[2]) * 100 - Number(r[3])) < 0.06))
      for (const [y, actual, target, , raw, at] of rows)
        p.indicators.push({ name: '【活動指標】会計年度任用職員の雇用量雇用時間（時間）', fiscalYear: y, target, actual, unit: '時間', evidence: evidence(input, raw, at) });
  }
  const cost = sheet.match(/\n令和5年度\n\n令和6年度\n\n([\d,]+)\n([\d,]+)\n\n([\d,]+)\n([\d,]+)\n\n([\d,]+)\n([\d,]+)\n/);
  if (cost && cost[5] === '2,361,690' && cost[6] === '1,999,000') {
    const raw = cost[0].trim(), at = from + cost.index! + 1;
    [2022, 2023, 2024].forEach((y, k) => p.amounts.push(amount(input, 'actual', y, cost[1 + 2 * k], '円', raw, at)));
  }
  p.warnings.push('北海道の電源立地地域対策交付金 事業評価総括表・個表（令和6年度）の合冊から、交付金事業者名が木古内町の個表1件のみを抽出。他市町村の個表は対象外。');
  p.warnings.push('総事業費は「交付金事業の総事業費等」欄の（総事業費, 交付金充当額）の組が年度見出し順に3組並び、令和6年度の組が総括表の総事業費2,361,690円・交付金充当額1,999,000円と一致する場合のみ、令和4〜6年度の総事業費（決算）として採用。担当課室・評価課室は欄の対応が抽出テキスト上で確定できないため未設定。');
  return [p];
}

/** 阿久根市 電源立地地域対策交付金（補助金）事業評価総括表・個表（令和6年度、令和5,6年度繰越を含む）。 */
const AKUNE = '97123f04942e2ba6230a8c82';
function akune(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '46206' || input.sourceId !== AKUNE) return [];
  const t = input.text;
  const heads = [...t.matchAll(/Ⅱ．事業評価個表（(令和6年度|令和5，6年度（繰越）)）\n/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!;
    const nextSum = t.indexOf('\n別紙\n', start), nextHead = heads[i + 1]?.index ?? t.length;
    const end = Math.min(nextSum < 0 ? t.length : nextSum, nextHead);
    if (input.truncated && end === t.length) continue;
    const sheet = t.slice(start, end);
    const nm = sheet.match(/\n公共用施設に係る整備，維持補修又は維\n([^\n]+)\n持運営等措置\n/);
    const no = sheet.match(/^Ⅱ．[^\n]+\n番号\n+(\d+)\n/);
    if (!nm || !no || !/\n阿久根市\n/.test(sheet)) continue;
    const fy = h[1] === '令和6年度' ? 2024 : null;
    const name = nm[1].trim();
    const p = project(input, `${h[1]}-${name}`, name, null, nm[0].trim(), start + nm.index! + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, h[0].trim(), start));
    const dept = sheet.match(/補助金事業の担当課室\n\n([^\n]+)\n/);
    if (dept) { p.department = dept[1].trim(); p.evidence.push(evidence(input, dept[0].trim(), start + dept.index!)); }
    const oc = sheet.match(/補助金事業の定性的な成果及び評価等\n+([\s\S]+?)\n+評価に係る第三者機関等の活用の有無/);
    if (oc) { p.outcomes = oc[1].trim(); p.evidence.push(evidence(input, oc[1].trim(), start + oc.index! + oc[0].indexOf(oc[1].trim()))); }
    // 成果指標: 評価年度が令和6年度で実績・目標値が見出し直後に並ぶもののみ。名称は【目標】行の文言。
    const res = sheet.match(/評価年度\n\n令和6年度\n\n成果実績\n\n％\n\n(\d+)\n\n目標値\n\n％\n\n(\d+)\n\n達成度/);
    const goal = sheet.match(/【目標】\n([^\n]+?)(\d+[%％])（令和6年度）\n/);
    if (res && goal) p.indicators.push({ name: `【成果指標】${goal[1]}`, fiscalYear: 2024, target: res[2], actual: res[1], unit: '％', evidence: evidence(input, res[0], start + res.index!) });
    if (goal) p.evidence.push(evidence(input, goal[0].trim(), start + goal.index!));
    const an = sheet.match(/補助金事業の活動指標\n及び活動実績\n\n([^\n]+)\n/);
    const act = sheet.match(/\n単位\n\n((?:令和\d年度\n\n)+)活動実績\n\n([^\n\d]+)\n\n((?:\d+\n\n)+)活動見込\n\n([^\n\d]+)\n\n((?:\d+\n\n)+)達成度\n/);
    if (an && act) {
      const ys = act[1].trim().split(/\n+/).map(s => 2018 + Number(s.match(/令和(\d)年度/)![1]));
      const av = act[3].trim().split(/\n+/), tv = act[5].trim().split(/\n+/);
      if (ys.length === av.length && ys.length === tv.length && act[2] === act[4])
        ys.forEach((y, k) => p.indicators.push({ name: `【活動指標】${an[1].trim()}`, fiscalYear: y, target: tv[k], actual: av[k], unit: act[2], evidence: evidence(input, act[0].slice(1), start + act.index! + 1) }));
    }
    // 総事業費（要した経費）: 直前の総括表の番号順の行（阿久根市→経費→充当額）を、個表の総事業費・補助金充当額欄の値と照合して採用。
    const sumAt = t.lastIndexOf('Ⅰ．事業評価総括表', start);
    if (sumAt >= 0) {
      const sum = t.slice(sumAt, t.indexOf('Ⅱ．事業評価個表', sumAt));
      const rows = [...sum.matchAll(/\n阿久根市\n\n([\d,]+)\n\n([\d,]+)\n/g)];
      const single = sum.match(/\n要した経費\n\n阿久根市\n\n補助金充当額\n\n([\d,]+)\n\n備 考\n\n([\d,]+)\n/);
      let pair: [string, string, string, number] | null = null;
      if (rows.length && rows[Number(no[1]) - 1]) { const r = rows[Number(no[1]) - 1]; pair = [r[1], r[2], r[0].slice(1, -1), sumAt + r.index! + 1]; }
      else if (single && no[1] === '1') pair = [single[1], single[2], single[0].slice(1, -1), sumAt + single.index! + 1];
      const costPart = sheet.slice(sheet.indexOf('総事業費'));
      if (pair && sheet.includes('総事業費') && new RegExp(`\\n${pair[0]}\\n`).test(costPart) && costPart.slice(costPart.indexOf('補助金充当額')).includes(`\n${pair[1]}\n`) && num(pair[1]) <= num(pair[0]))
        p.amounts.push(amount(input, 'actual', fy, pair[0], '円', pair[2], pair[3]));
    }
    p.warnings.push('阿久根市 電源立地地域対策交付金 事業評価個表。評価実施年度は本文で特定できないため未設定（個表見出しの年度を評価対象年度とし、「令和5，6年度（繰越）」は評価対象年度を未設定）。outcomesは「補助金事業の定性的な成果及び評価等」欄の原文。');
    p.warnings.push('決算額は総括表の「補助金事業に要した経費」（単位：円）を、個表の総事業費・補助金充当額欄に同じ値があることを確認した場合のみ採用。個表の年度別総事業費は列が混在するため未収録。成果指標は評価年度が令和6年度で実績・目標値が確定するもののみ（評価年度が令和7・8年度のものは未収録）。');
    out.push(p);
  }
  return dedupe(out, p => `${p.evaluatedFiscalYear}\n${p.projectName}`);
}

/** 伊是名村 簡易水道施設整備事業 事業評価（平成29年度実施、事業採択時の評価）。 */
const IZENA = 'd03bb72f22028ed02e2f60de';
function izena(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '47360' || input.sourceId !== IZENA) return [];
  const t = input.text, head = '事業評価の内容（平成 29 年度実施）';
  const nameRaw = '事業名\n\n伊是名村簡易水道施設整備事業';
  if (!t.startsWith(head) || !t.includes(nameRaw)) return [];
  const p = project(input, 'izena-water', '伊是名村簡易水道施設整備事業', 2017, nameRaw);
  p.projectCode = null;
  p.evidence.push(evidence(input, head, 0));
  const purpose = t.match(/■目\n\n的\n\n([\s\S]+?)\n■必要性/);
  if (purpose) { p.purpose = purpose[1].trim(); p.evidence.push(evidence(input, purpose[1].trim(), purpose.index! + purpose[0].indexOf(purpose[1].trim()))); }
  const bc = '1)費用便益比の算定方法(評価の基準年度：平成 29 年度)';
  const bcr = t.match(/費用便益比＝ (\d+\.\d+) ＞ 1\.00/);
  if (bcr && t.includes(bc)) p.indicators.push({ name: '費用便益比（事業全体）', fiscalYear: 2017, target: null, actual: bcr[1], unit: null, evidence: evidence(input, bcr[0], bcr.index!) });
  const policy = t.match(/■対応方針\n\n\n([\s\S]+?)\n■学識経験者等の第三者の意見/);
  if (policy) p.ratings.push({ kind: 'self', label: '対応方針', value: policy[1].trim(), scale: null, evidence: evidence(input, policy[1].trim(), policy.index! + policy[0].indexOf(policy[1].trim())) });
  const ext = t.match(/評価の結果\n(伊是名村水道施設整備事業の内容を審議した結果、事業を実施することが妥当であると判断する。)/);
  if (ext) p.ratings.push({ kind: 'external', label: '学識経験者等の第三者の意見（評価の結果）', value: ext[1], scale: null, evidence: evidence(input, ext[0], ext.index!) });
  const op = t.match(/本委員会からの意見\n([\s\S]+?)\n■問合せ先/);
  if (op) { p.outcomes = op[1].trim(); p.evidence.push(evidence(input, op[1].trim(), op.index! + op[0].indexOf(op[1].trim()))); }
  const dept = '沖縄県伊是名村役場 建設環境課';
  if (t.includes(dept)) { p.department = '建設環境課'; p.evidence.push(evidence(input, dept)); }
  p.warnings.push('伊是名村簡易水道施設整備事業の事業評価（平成29年度実施、事業採択段階の評価）。評価対象年度は該当しないため未設定。総事業費1,229,269千円（税込）は平成30〜37年度の計画事業費で予算・決算のいずれでもないためamountsへ転記しない。総便益・総費用も未収録。');
  p.warnings.push('費用便益比は評価の基準年度（平成29年度）の値。outcomesは第三者委員会からの意見（３項目）の原文。担当課は問合せ先の記載による。');
  return [p];
}

export const entries: Record<string, Entry> = {
  '34369': { extract: kitahiroshima, scope: '北広島町 令和６年度主要施策の概要の主要施策成果シート（事業名・担当課・目的・事業成果・列合計を確認したR4〜R6決算事業費）。施策ページの成果指標・課題欄・評価検証の趣旨説明資料・HTMLページは対象外' },
  '42212': { extract: saikai, scope: '西海市 令和６年度主要施策成果説明書の事業別ページ（事業名称・所管課・事業評価欄・順序と大小関係を確認した最終予算額と決算額）。款項目別の予算決算一覧・成果実績の数値・教育委員会点検評価のHTML一覧は対象外' },
  '01334': { extract: kikonai, scope: '北海道電源立地地域対策交付金 事業評価個表（令和6年度）合冊のうち交付金事業者が木古内町のパークゴルフ場運営事業の成果指標・活動指標・総事業費・定性的成果。他市町村の個表は対象外' },
  '46206': { extract: akune, scope: '阿久根市 電源立地地域対策交付金 事業評価個表（令和6年度・令和5,6年度繰越）の事業名・担当課室・定性的成果・成果/活動指標・総括表と照合した要した経費。年度別総事業費と農業委員会HTMLは対象外' },
  '47360': { extract: izena, scope: '伊是名村簡易水道施設整備事業の事業評価（平成29年度実施・採択時評価）の目的・費用便益比・対応方針・第三者委員会の評価結果と意見。計画総事業費は金額に含めない' },
};
