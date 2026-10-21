import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, num, sheets, type Entry } from './i1-util';

// ---------------------------------------------------------------- 太田市（議会の決算事業評価シート、1資料1事業）
type OtaAmount = [kind: 'budget' | 'actual', fiscalYear: number, rawValue: string, context: string];
const OTA: Record<string, { name: string; nameRaw: string; amounts: OtaAmount[]; note?: string }> = {
  '3582654e5d28bcb36f450112': { name: 'こどもプラッツ推進事業', nameRaw: '事業名称\n\nこどもプラッツ推進事業\n\n議会評価', amounts: [
    ['budget', 2016, '９０，０００，０００', 'H２８年度予算額\n９０，０００，０００円\n２８，５００，０００円\n\n事業費\n利用料歳入'],
    ['actual', 2015, '７０，０００，０００', '（参考）H２７年度決算額\n７０，０００，０００円\n１９，０３２，０００円'],
    ['actual', 2014, '２４，９６１，５９３', '（参考）H２６年度決算額\n２４，９６１，５９３円\n４，７８５，０００円']],
    note: '各年度欄の2行（事業費・利用料歳入）のうち、行見出しの並び順に従い1行目を事業費として収録。' },
  '51328bb49ab55088b8c9ba1e': { name: 'おおたスポーツアカデミー運営委託事業', nameRaw: '【事業名称】\n\nおおたスポーツアカデミー運営委託事業', amounts: [
    ['budget', 2017, '22，900，000', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n22，900，000 円\n\n21，986，543 円\n\n15，883，254 円'],
    ['actual', 2016, '21，986，543', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n22，900，000 円\n\n21，986，543 円\n\n15，883，254 円'],
    ['actual', 2015, '15，883，254', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n22，900，000 円\n\n21，986，543 円\n\n15，883，254 円']] },
  '60ada4b5f7f34af88d3bf6ac': { name: '中・高年齢者生き甲斐づくり推進事業', nameRaw: '事業名称 「中・高年齢者生き甲斐づくり推進事業」', amounts: [
    ['budget', 2016, '１０，０００，０００', 'H２８年度予算額\n１０，０００，０００円\n\n事業費'],
    ['actual', 2015, '１０，０００，０００', '（参考）H２７年度決算額\n１０，０００，０００円'],
    ['actual', 2014, '１０，０００，０００', '（参考）H２６年度決算額\n１０，０００，０００円']] },
  '9fb8ba3e01d119189c84db42': { name: 'おおた芝桜まつり・イルミネーション運営業務委託事業', nameRaw: '事業名称 「おおた芝桜まつり・イルミネーション運営業務委託事業」', amounts: [
    ['budget', 2016, '30,000,000', 'H２８年度予算額\n15,000,000 円\n15,000,000 円\n30,000,000 円\n\n芝桜まつり事業費\nイルミネーション事業費\n合\n計'],
    ['actual', 2015, '40,988,947', '（参考）H２７年度決算額\n22,286,710 円\n18,702,237 円\n40,988,947 円'],
    ['actual', 2014, '42,874,612', '（参考）H２６年度決算額\n21,220,278 円\n21,654,334 円\n42,874,612 円']],
    note: '金額は芝桜まつり事業費とイルミネーション事業費の合計行で、2行の和と一致することを確認した値のみ収録。' },
  'a1625ed261802f5b55e4e7be': { name: '太田市金券取扱事務事業', nameRaw: '【事業名称】\n\n太田市金券取扱事務事業', amounts: [],
    note: '事業費の3列（H29予算・H28決算・H27決算）の並びが抽出テキストで崩れているため金額は未収録。' },
  'b7f751fac51588ae445800b8': { name: '八王子山公園(墓所増設)整備事業', nameRaw: '事業名称 八王子山公園(墓所増設)整備事業', amounts: [
    ['budget', 2015, '4,000,000', 'H27 年度予算額\n4,000,000 円\n\n事業費'],
    ['actual', 2013, '3,980,000', '（参考）H25 年度決算額\n3,980,000 円']],
    note: 'H26年度決算額は繰越分を含む2行表記のため未収録。' },
  'befd09e4b205558b70639b30': { name: 'おおたん教育支援隊事業', nameRaw: '事業名称\n\nおおたん教育支援隊事業\n\n議会評価', amounts: [
    ['budget', 2015, '90,922,000', 'H２７年度予算額\n90,922,000 円\n\n事業費'],
    ['actual', 2014, '102,267,428', '（参考）H２６年度決算額\n102,267,428 円'],
    ['actual', 2013, '98,045,569', '（参考）H２５年度決算額\n98,045,569 円']] },
  'c1d1bcd5b309c7dd5088142a': { name: '一般介護予防事業', nameRaw: '【事業名称】\n\n一般介護予防事業', amounts: [
    ['budget', 2017, '40,814,000', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n40,814,000 円\n\n33,993,942 円\n\n12,126,970 円'],
    ['actual', 2016, '33,993,942', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n40,814,000 円\n\n33,993,942 円\n\n12,126,970 円'],
    ['actual', 2015, '12,126,970', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n40,814,000 円\n\n33,993,942 円\n\n12,126,970 円']] },
  'c489ef822797a67f79ca7925': { name: 'おおた市民債発行事業', nameRaw: '【事業名称】「おおた市民債発行事業」', amounts: [
    ['budget', 2017, '3,068,000', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n3,068,000 円\n\n3,067,092 円\n\n3,067,092 円'],
    ['actual', 2016, '3,067,092', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n3,068,000 円\n\n3,067,092 円\n\n3,067,092 円'],
    ['actual', 2015, '3,067,092', '事業費\n\nH２９年度予算額\n\nH２８年度決算額\n\nH２７年度決算額\n\n3,068,000 円\n\n3,067,092 円\n\n3,067,092 円']] },
  'db48ddcb1e29437fd7ab9626': { name: '太陽光発電システム導入報奨金事業', nameRaw: '事業名称 太陽光発電システム導入報奨金事業', amounts: [
    ['budget', 2015, '57,600,000', 'H２７年度予算額\n57,600,000 円\n\n事業費'],
    ['actual', 2013, '41,990,000', '（参考）H２５年度決算額\n41,990,000 円']],
    note: 'H26年度は決算見込額のため未収録。' },
  'df1aa4d5b5bdb9a44be187b4': { name: '収納対策事業', nameRaw: '事業名称\n\n収納対策事業\n\n議会評価', amounts: [],
    note: 'シート上部の金額は市税等の収入状況（歳入）で事業費ではないため未収録。' },
  'f974b5f52e839da7d06aaa62': { name: '市政情報発信事業', nameRaw: '事業名称 市政情報発信事業', amounts: [
    ['budget', 2016, '92,607,000', 'H２８年度予算額\n92,607,000 円\n\n事業費'],
    ['actual', 2015, '91,146,550', '（参考）H２７年度決算額\n91,146,550 円'],
    ['actual', 2014, '94,608,053', '（参考）H２６年度決算額\n94,608,053 円']] },
};
const OTA_TOTAL_SCALE = '5 きわめて良好である（80点以上）／4 適正である（60～79点）／3 おおむね適正である（40～59点）／2 問題がある（20～39点）／1 不適正である（19点以下）';
const OTA_DIRECTION_SCALE = '5「拡充する」／4「現状のまま継続する」／3「改善・効率化し継続する」／2「見直しのうえ縮小する」（今後の方向性基準評価）';

function extractOta(input: CachedInput): ProjectEvaluation[] {
  const spec = OTA[input.sourceId];
  if (input.municipalityCode !== '10205' || !spec || !input.text.includes('事業評価チェック表')) return [];
  const p = project(input, spec.name, spec.name, null, spec.nameRaw);
  p.evidence.push(evidence(input, '事業評価チェック表'));
  for (const [kind, fy, raw, ctx] of spec.amounts) p.amounts.push(amount(input, kind, fy, raw, '円', ctx, input.text.indexOf(ctx)));
  if (spec.note) p.warnings.push(spec.note);
  const rating = /議会評価\n総合評価\n今後の方向性\n\n([1-5１-５])\n\n([1-5１-５])\n/.exec(input.text);
  const score = /計\n+([0-9０-９]+)／100/.exec(input.text);
  // 合計点がある票は、総合評価が評価基準（80点以上=5 …）と整合する場合のみ採用する。
  const band = (s: number) => s >= 80 ? 5 : s >= 60 ? 4 : s >= 40 ? 3 : s >= 20 ? 2 : 1;
  if (rating && (!score || band(num(score[1])) === num(rating[1]))) {
    const ev = evidence(input, rating[0].slice(0, -1), rating.index);
    p.ratings.push({ kind: 'external', label: '議会評価 総合評価', value: nfkc(rating[1]), scale: OTA_TOTAL_SCALE, evidence: ev });
    p.ratings.push({ kind: 'external', label: '議会評価 今後の方向性', value: nfkc(rating[2]), scale: OTA_DIRECTION_SCALE, evidence: ev });
    if (score) p.ratings.push({ kind: 'external', label: '事業評価チェック表 評価点 計', value: `${nfkc(score[1])}／100`, scale: '100点満点（必要性・公共性・費用対効果・優先性・成果 各20点）', evidence: evidence(input, score[0], score.index) });
  } else p.warnings.push('評価（総合評価・今後の方向性）は選択印（○）の位置が抽出テキストで判別できないため未収録。');
  p.warnings.push('市議会による政策評価・事務事業評価シート（決算事業評価）。評価年度・評価対象年度は本文に明記がないため未設定。金額は各年度欄の事業費（円）で、予算額は予算、決算額は実績として収録。');
  return [p];
}

// ---------------------------------------------------------------- 城里町（令和７年度 事務事業評価及び施策評価のまとめ）
const SHIROSATO_HEAD = '令和７年度 事務事業評価及び施策評価のまとめ\n（令和６年度に実施した事業の評価）';
function extractShirosato(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '08310' || input.sourceId !== 'dc21f518c9f5be55da6999e0') return [];
  const s = input.text.indexOf(SHIROSATO_HEAD);
  if (s < 0) return [];
  const body = input.text.slice(s);
  const rows = [...body.matchAll(/^(\d{1,2}) (\S[^\n]*?(?:事業|事務|事業）|補助金|除草|管理))(?: (\S+(?:課|事務局)))?\n(?:\n(\S+課)\n)?/gm)];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r[2], (counts.get(r[2]) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  for (const r of rows) {
    if ((counts.get(r[2]) ?? 0) > 1) continue; // 同名の行（公民館ごと等）は区別できないため除外
    const dept = r[3] ?? r[4] ?? null;
    const p = project(input, r[2], r[2], 2025, r[0].replace(/\n+$/, ''), s + r.index!);
    p.evaluatedFiscalYear = 2024; p.department = dept;
    p.evidence.push(evidence(input, SHIROSATO_HEAD, s));
    p.warnings.push('令和７年度 事務事業評価及び施策評価のまとめ（令和６年度に実施した事業の評価）の一覧表の行から事務事業名（と同じ行または直後の行の担当課）を収録。貢献度・事業の方向性・予算の方向性の評価記号は表の列が抽出テキストで分離しており行との対応が確定しないため未収録。同名の行が複数ある事業（公民館別など）は除外。');
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 木更津市（第３次基本計画（事業）進行管理票）
const KISARAZU: Record<string, number> = { '115b4a48fc9625ce53db8a2f': 2023, '01e5b138e70edbd361657485': 2024, '98141d3fd3382e2a13e2673b': 2025 };
const KISARAZU_SCALE = '○：実施計画のとおりに実施できた事業／△：実施計画のとおりには実施できなかった事業／×：事業見直し等により中止した事業';
function extractKisarazu(input: CachedInput): ProjectEvaluation[] {
  const fy = KISARAZU[input.sourceId];
  if (input.municipalityCode !== '12206' || !fy) return [];
  const era = '０１２３４５６７８９'[fy - 2018];
  const title = `第３次基本計画（事業）進行管理票\n（令和${era}年度）`;
  if (!input.text.includes(title)) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, /施策名\n\nNo\.\n\n/)) {
    if (sh.text.includes('○、△、×で記載')) continue; // 「シートの見方」の記入例
    const h = /\n事業名\n\n担当部課\n\n進捗状況\n\n([^\n]+)\n\n([^\n]+(?:\n[^\n]+)?)\n\n([○△×])\n\n事業概要\n/.exec(sh.text);
    const plan = new RegExp(`\\n令和${era}年度\\n実施計画\\n`).exec(sh.text);
    if (!h || !plan) continue;
    const name = h[1].trim(), dept = h[2].replace(/\n/g, ' ');
    const p = project(input, `${dept}:${name}`, name, null, h[0].slice(1, -1), sh.start + h.index + 1);
    p.department = dept; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title), evidence(input, plan[0].slice(1, -1), sh.start + plan.index + 1));
    p.ratings.push({ kind: 'self', label: '進捗状況', value: h[3], scale: KISARAZU_SCALE, evidence: evidence(input, h[0].slice(1, -1), sh.start + h.index + 1) });
    const m = /(?:前年度)?繰越額（千円）\n\n当初予算額（千円）\n\n決算見込額（千円）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/.exec(sh.text);
    if (m && num(m[2]) > 0) p.amounts.push(amount(input, 'budget', fy, m[2], '千円', m[0].slice(0, -1), sh.start + m.index));
    p.warnings.push(`進行管理票（重点事業）の事業名・担当部課・進捗状況（令和${era}年度 実施計画に対する取組結果）を収録。金額は当初予算額（千円、繰越分を含まない）のみ予算として収録し、決算見込額は見込値のため、前年度繰越額は当年度予算でないため未収録。`);
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 鹿嶋市（重点施策 事業評価シート：既存事業進捗確認シート）
const KASHIMA: Record<string, { year: number; head: string }> = {
  '6b096b56edd28d53d349d9ea': { year: 2024, head: '令和６年度\n鹿嶋市 重点施策 事業評価シート\n【中間面談による実施】' },
  '6fc25fd01a2439661f703d0f': { year: 2025, head: '令和７年度\n鹿嶋市 重点施策 事業評価シート\n【中間面談による実施】' },
  'dea2915e1a2afadbf5d0f517': { year: 2026, head: '令和８年度\n鹿嶋市 重点施策 事業評価シート\n【当初面談による実施】' },
};
function extractKashima(input: CachedInput): ProjectEvaluation[] {
  const spec = KASHIMA[input.sourceId];
  if (input.municipalityCode !== '08222' || !spec || !input.text.startsWith(spec.head)) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, /既存事業進捗確認シート（[^）\n]+）\n/)) {
    const m = /^既存事業進捗確認シート（[^）\n]+）\n\n№\n\n(\S+)\n\n施策の\n位置づけ\n\n担当課\n\n([^\n]+)\n\n事業名\n\n([^\n]+)\n\n施策/.exec(sh.text);
    if (!m) continue;
    const p = project(input, `${m[2]}:${m[3]}`, m[3], spec.year, m[0].slice(0, -('\n\n施策'.length)), sh.start);
    p.department = m[2];
    p.evidence.push(evidence(input, spec.head, 0));
    p.warnings.push('重点施策 事業評価シート（既存事業進捗確認シート）の担当課・事業名を、見出しの並びが崩れていない票のみ収録（複数事業をまとめた票・事業名が離れて出力された票は除外）。評価年度は資料見出しの年度。成果指標の目標値・実績・進捗率、予定：実績の判定記号は表の列が分離しており未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 小川町（行政評価の公表ページ一覧・事務事業評価シート）
const OGAWA_PAGES: Record<string, { title: string; year: number; fy: number }> = {
  'ea9e8041626d7be166b6cb4a': { title: '令和3年度（令和2年度分）行政評価', year: 2021, fy: 2020 },
  'c11b0b92d3968fe1c3379f0d': { title: '令和4年度（令和3年度分）行政評価', year: 2022, fy: 2021 },
  'e1bd2b954b6104a6b4512374': { title: '令和5年度（令和4年度分）行政評価', year: 2023, fy: 2022 },
};
const OGAWA_SCALE = '1 拡充／2 現状維持／3 縮小・統廃合（事業の方向性の判断）';
const OGAWA_WHO: Record<string, string> = { '担当課長': '一次評価（担当課長）', '政策推進課長': '二次評価（政策推進課長）', '町長': '最終評価（町長）' };
function extractOgawaPage(input: CachedInput): ProjectEvaluation[] {
  const spec = OGAWA_PAGES[input.sourceId];
  if (input.municipalityCode !== '11343' || !spec || !input.text.startsWith(spec.title)) return [];
  const out: ProjectEvaluation[] = [];
  let dept: { name: string; at: number } | null = null, offset = 0;
  for (const line of input.text.split('\n')) {
    const lineAt = offset; offset += line.length + 1;
    if (/^\S+(課|室|局|センター)$/.test(line)) { dept = { name: line, at: lineAt }; continue; }
    const m = /^(\d{2})[ _](.+?) （注釈[123]）（((?:(?:担当課長|政策推進課長|町長)[123] ?)+)）? \(PDFファイル/.exec(line);
    if (!m || !dept) continue;
    const name = m[2].trim();
    const p = project(input, `${dept.name}:${m[1]}`, name, spec.year, m[0], lineAt);
    p.department = dept.name; p.evaluatedFiscalYear = spec.fy;
    p.evidence.push(evidence(input, dept.name, dept.at), evidence(input, spec.title, 0));
    for (const r of m[3].matchAll(/(担当課長|政策推進課長|町長)([123])/g)) {
      p.ratings.push({ kind: 'self', label: `事業の方向性の判断 ${OGAWA_WHO[r[1]]}`, value: r[2], scale: OGAWA_SCALE, evidence: evidence(input, m[0], lineAt) });
    }
    p.warnings.push('行政評価の公表ページの事業一覧（課ごとの見出し・事業名・評価主体別の事業の方向性の判断）から収録。個別の事務事業評価シート（PDF）は未取得のため、事業費・指標は未収録。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

const OGAWA_SHEETS = new Set(['d75460ff8a46e32345f4410c', 'ef8e934a49d434d635c79f54']);
function extractOgawaSheet(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11343' || !OGAWA_SHEETS.has(input.sourceId) || !input.text.includes('第５次総合振興計画事務事業評価シート（様式１）')) return [];
  const name = /\n④予算事業名 ([^\n]+)\n/.exec(input.text), dept = /\nR7\.\d{1,2}\.\d{1,2}\n(\S+課)\n/.exec(input.text);
  const fy = /実施年度（R[６6]/.exec(input.text), first = /（1）一次評価\n（担当課長）\n\n([123]) (拡充|現状維持|縮小・統廃合)\n/.exec(input.text);
  if (!name || !dept || !fy) return [];
  const p = project(input, `${dept[1]}:${name[1].trim()}`, name[1].trim(), null, name[0].slice(1, -1), name.index + 1);
  p.department = dept[1]; p.evaluatedFiscalYear = 2024;
  p.evidence.push(evidence(input, '第５次総合振興計画事務事業評価シート（様式１）'), evidence(input, dept[0].slice(1, -1), dept.index + 1), evidence(input, fy[0], fy.index));
  if (first) p.ratings.push({ kind: 'self', label: '事業の方向性の判断 一次評価（担当課長）', value: `${first[1]} ${first[2]}`, scale: OGAWA_SCALE, evidence: evidence(input, first[0].slice(0, -1), first.index) });
  p.warnings.push('第５次総合振興計画事務事業評価シート（様式１）の予算事業名・担当課・一次評価を収録（評価対象は「実施年度（R6年度）」）。事業コスト表・指標表・項目別評価は列の並びが抽出テキストで崩れているため未構造化。二次評価・最終評価は記載なし。');
  return [p];
}

export const smallEntries: Record<string, Entry> = {
  '10205': { extract: extractOta, scope: '太田市議会の政策評価・事務事業評価シート（決算事業評価、12事業）から事業名と、行の対応が確定した事業費（予算額・決算額、円）、議会評価の総合評価・今後の方向性（合計点がある票は評価基準と整合する場合のみ）を構造化。評価コメント、評価項目別の点数、選択印の判別できない様式の評価は対象外。' },
  '08310': { extract: extractShirosato, scope: '城里町 令和７年度行政評価報告書の「事務事業評価及び施策評価のまとめ（令和６年度に実施した事業の評価）」の一覧表から、事務事業名と同じ行・直後の行の担当課を構造化。評価記号（貢献度・方向性）は列の対応が確定しないため対象外。施策評価、本文の集計、令和６年度報告書（一覧が画像）は対象外。' },
  '12206': { extract: extractKisarazu, scope: '木更津市 第３次基本計画（事業）進行管理票（令和５・６・７年度）の重点事業シートから、事業名・担当部課・進捗状況（○△×）・当初予算額（千円）を構造化。決算見込額、取組結果の文章、施策の進行管理票・審議会資料は対象外。' },
  '08222': { extract: extractKashima, scope: '鹿嶋市 重点施策 事業評価シート（令和６・７年度中間面談、令和８年度当初面談）の既存事業進捗確認シートから、担当課・事業名を見出しの並びが崩れていない票のみ構造化。成果指標・進捗率、令和５年度版（様式が崩れている）、令和６年度当初面談版（同年度の中間面談版と重複）、各部選定施策シート、ロジックモデルは対象外。' },
  '11343': { extract: (input) => [...extractOgawaPage(input), ...extractOgawaSheet(input)], scope: '小川町 行政評価の公表ページ（令和3・4・5年度、令和2〜4年度分）の課別事業一覧から事業名・担当課・評価主体別の事業の方向性の判断（1拡充/2現状維持/3縮小・統廃合）と、令和7年度の事務事業評価シート2件の事業名・担当課・一次評価を構造化。シートの事業コスト・指標・項目別評価は対象外。' },
};
