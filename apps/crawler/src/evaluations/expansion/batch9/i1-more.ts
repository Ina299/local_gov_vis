import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, num, sheets, type Entry } from './i1-util';

// ---------------------------------------------------------------- さいたま市（基本計画の実施状況報告書：施策（の進捗）及び事業の達成状況一覧）
const SAITAMA: Record<string, { fy: number; phrase: string; twoColumns: boolean }> = {
  'eb4eeba04595e03f8a6e7116': { fy: 2022, phrase: '令和４年度における事業の達成度', twoColumns: false },
  '27d39c3073b7ea5867896be9': { fy: 2023, phrase: '令和５年度における事業の達成度', twoColumns: false },
  '5e4c2d909efceb5468981bc6': { fy: 2024, phrase: '令和６年度の事業の達成度', twoColumns: false },
  '2d4689fe6a4ad07a0b6fd316': { fy: 2025, phrase: '令和７年度事業の達成度', twoColumns: true },
};
const SAITAMA_SCALE = 'Ａ 目標を上回って達成（達成率110％以上）／Ｂ 目標をおおむね達成（90％以上110％未満）／Ｃ 目標を未達成（90％未満）';
function extractSaitama(input: CachedInput): ProjectEvaluation[] {
  const spec = SAITAMA[input.sourceId];
  if (input.municipalityCode !== '11100' || !spec || !input.text.startsWith('さいたま市総合振興計画\n基本計画の実施状況報告書')) return [];
  const phraseAt = input.text.indexOf(spec.phrase);
  const listAt = input.text.indexOf('達成状況一覧\n', 200);
  if (phraseAt < 0 || listAt < 0) return [];
  const end = input.text.indexOf('（２）評価シート', listAt);
  const body = input.text.slice(listAt, end > 0 ? end : undefined);
  const r = '([ABCＡＢＣ])';
  const row = new RegExp(`\\n(\\d{1,2})\\n\\n(\\d{2}-\\d-\\d-\\d{2})\\n\\n([^\\n]+)\\n\\n${r}\\n\\n${spec.twoColumns ? `${r}\\n\\n` : ''}([^\\n]+?)(?:\\n\\n| )([^\\n]+(?:\\n[^\\n]+)?)\\n\\n(\\d+)\\n`, 'g');
  const out: ProjectEvaluation[] = [];
  for (const m of body.matchAll(row)) {
    const [, , code, name, first, second] = m, bureau = spec.twoColumns ? m[6] : m[5], section = (spec.twoColumns ? m[7] : m[6]).replace(/\n/g, '');
    if (/^\d+$/.test(section) || /^\d+$/.test(bureau)) continue;
    const raw = m[0].slice(1, -1), at = listAt + m.index! + 1;
    const p = project(input, code, name, null, raw, at);
    p.department = `${bureau} ${section}`; p.evaluatedFiscalYear = spec.fy;
    p.evidence.push(evidence(input, spec.phrase, phraseAt));
    p.ratings.push({ kind: 'self', label: spec.twoColumns ? '事業の達成度（令和７年度）' : '事業の達成度', value: nfkc(first), scale: SAITAMA_SCALE, evidence: evidence(input, raw, at) });
    if (spec.twoColumns) p.ratings.push({ kind: 'self', label: '事業の達成度（計画期間：令和３〜７年度）', value: nfkc(second), scale: SAITAMA_SCALE, evidence: evidence(input, raw, at) });
    p.warnings.push('基本計画の実施状況報告書の「施策（の進捗）及び事業の達成状況一覧」から、再掲でない事業行の事業コード・事業名・事業の達成度・局・とりまとめ課を収録。達成度が「－」「コロナ影響有」の行、事業名・課名が改行で分かれた行、再掲行は対象外。評価シート本文（目標指標・事業費）は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 松島町（教育委員会教育行政点検評価報告書）
const MATSUSHIMA: Record<string, { year: number; fy: number; head: string }> = {
  '1abef32a660185d4ebcfc4b5': { year: 2025, fy: 2024, head: '令和７年度（令和６年度対象）\n\n松島町教育委員会教育行政点検評価報告書' },
  '29b242f20611b3724c5c2817': { year: 2024, fy: 2023, head: '令和６年度（令和５年度対象）\n\n松島町教育委員会教育行政点検評価報告書' },
  '90f296e2dd0c236787cb5f8c': { year: 2023, fy: 2022, head: '令和５年度（令和４年度対象）\n\n松島町教育委員会教育行政点検評価報告書' },
};
function extractMatsushima(input: CachedInput): ProjectEvaluation[] {
  const spec = MATSUSHIMA[input.sourceId];
  if (input.municipalityCode !== '04401' || !spec || !input.text.startsWith(spec.head)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(/【担当課：([^】\n]+)】\n\n?基本施策(\S+?)： ?([^\n]+)\n（([０-９\d]+)） ?([^\n]+)\n事業目的と概要/g)) {
    const [raw, dept, policy, , no, name] = m;
    const p = project(input, `${nfkc(policy)}-${nfkc(no)}:${dept}`, name.trim(), spec.year, raw, m.index);
    p.department = dept; p.evaluatedFiscalYear = spec.fy;
    p.evidence.push(evidence(input, spec.head, 0));
    p.warnings.push('教育行政点検評価報告書の基本施策ごとの取組項目（事業目的と概要・事業実施状況・効果・課題の票）の項目名と担当課を収録。評価区分・事業費の記載はない様式。項目は基本施策の下の取組単位で、予算上の事務事業と一致するとは限らない。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 築上町（2024年度 事務事業評価シート）
const CHIKUJO_ID = '6270737ecc893f487926e6ba';
/** 抽出テキストに混じる康熙部首（⼒・⾦など）を通常の漢字に戻す（名称の表示用。根拠は原文のまま）。 */
const radicals = (s: string) => s.replace(/[⺀-⿟]/g, c => c.normalize('NFKC'));
function chikujoCosts(block: string): { values: string[]; raw: string; offset: number } | null {
  if (!['2021年度', '2022年度', '2023年度', '2024年度'].every(y => block.includes(y)) || !block.includes('決算\n（千円）')) return null;
  const isNum = (l: string) => /^[\d,]+$/.test(l);
  // 末尾の数値だけのブロック（空行区切り）。4列の歳出と、その後の4列の財源内訳（合計が歳出と一致）を期待する。
  const lines = block.replace(/\n+$/, '').split('\n');
  let i = lines.length;
  while (i > 0 && (lines[i - 1] === '' || isNum(lines[i - 1]))) i--;
  while (i < lines.length && lines[i] === '') i++;
  const tail = lines.slice(i).join('\n');
  const groups = tail.split(/\n\n/).filter(Boolean).map(g => g.split('\n'));
  if (groups.length === 8 && groups.slice(0, 4).every(g => g.length === 1)
    && [0, 1, 2, 3].every(k => groups[4 + k].reduce((s, v) => s + num(v), 0) === num(groups[k][0]))) {
    return { values: groups.slice(0, 4).map(g => g[0]), raw: tail, offset: block.lastIndexOf(tail) };
  }
  // 列ごとに「歳出＋内訳」が並ぶ場合：4行のまとまりで先頭＝残り3行の合計が4組そろうときのみ。
  const cols = [...block.matchAll(/(?:^|\n)([\d,]+)\n([\d,]+)\n([\d,]+)\n([\d,]+)(?=\n)/g)].filter(m => num(m[1]) === num(m[2]) + num(m[3]) + num(m[4]));
  if (cols.length === 4) {
    const s = cols[0].index! + (cols[0][0].startsWith('\n') ? 1 : 0), e = cols[3].index! + cols[3][0].length;
    return { values: cols.map(c => c[1]), raw: block.slice(s, e), offset: s };
  }
  return null;
}
function extractChikujo(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40647' || input.sourceId !== CHIKUJO_ID) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, /2024年度\n予算事業名\n\n事 務 事 業 評 価 シ ー ト\n\n/)) {
    const nm = /^2024年度\n予算事業名\n\n事 務 事 業 評 価 シ ー ト\n\n(?:事業No\.\d+\n\n)?([^\n]+)\n/.exec(sh.text);
    const dept = /\n担当課 ([^\n]+)\n/.exec(sh.text), no = /事業No\.(\d+)/.exec(sh.text);
    if (!nm || !dept || !no || nm[1].startsWith('担当課')) continue;
    const name = radicals(nm[1].trim());
    const p = project(input, `No.${no[1]}`, name, 2024, nm[0].replace(/\n+$/, ''), sh.start);
    p.department = radicals(dept[1].trim());
    p.evidence.push(evidence(input, dept[0].slice(1, -1), sh.start + dept.index + 1), evidence(input, no[0], sh.start + no.index));
    const bs = sh.text.indexOf('３．事業の実績'), be = sh.text.indexOf('４．一次評価');
    const costs = bs >= 0 && be > bs ? chikujoCosts(sh.text.slice(bs, be)) : null;
    if (costs) {
      [2021, 2022, 2023].forEach((y, k) => { if (num(costs.values[k]) > 0) p.amounts.push(amount(input, 'actual', y, costs.values[k], '千円', costs.raw, sh.start + bs + costs.offset)); });
      p.warnings.push('金額は「３．事業の実績」の決算（千円）の歳出で、財源内訳の合計との検算が4列すべて一致した場合のみ、2021〜2023年度分を実績として収録（2024年度は見込のため未収録）。');
    }
    const first = /４．一次評価\n評価項目\n必要性\n公共性\n有効性\n効率性\n\n評価\n(\S+)\n([1-4])\n(\S+)\n([1-4])\n(\S+)\n([1-4])\n(\S+)\n([1-4])\n/.exec(sh.text);
    if (first) {
      const ev = evidence(input, first[0].slice(0, -1), sh.start + first.index);
      ['必要性', '公共性', '有効性', '効率性'].forEach((label, k) => p.ratings.push({ kind: 'self', label: `一次評価 ${label}`, value: radicals(`${first[1 + 2 * k]} ${first[2 + 2 * k]}`), scale: null, evidence: ev }));
    }
    const final = /７．評価結果（幹事会調整後）の統合\n評価項目\n\n評価結果\n\n必要性\n\n([1-4])\n\n公共性\n\n([1-4])\n\n有効性\n\n([1-4])\n\n効率性\n\n([1-4])\n/.exec(sh.text);
    if (final) {
      const ev = evidence(input, final[0].slice(0, -1), sh.start + final.index);
      ['必要性', '公共性', '有効性', '効率性'].forEach((label, k) => p.ratings.push({ kind: 'self', label: `評価結果（幹事会調整後） ${label}`, value: final[1 + k], scale: null, evidence: ev }));
    }
    p.warnings.push('事務事業評価シート（2024年度）の予算事業名・担当課・事業No.と、一次評価・幹事会調整後の評価結果（4項目）を収録。総合評価・今後の方向性欄は抽出テキスト上で値と見出しの対応が確定しないため未収録。二次評価（企画財政課意見）の文章は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 鏡石町（令和７年度 教育行政に関する点検評価報告書）
const KAGAMIISHI_ID = '3dd681d4d63e4119caf6a305', KAGAMIISHI_HEAD = '令和７年度\n教育行政に関する点検評価報告書', KAGAMIISHI_FY = '令和７年度における主要事務事業に関し点検・評価を行い';
const KAGAMIISHI_SCALE = '4〜1点（評価項目ごと）、総合評価 Ａ 16～14点／Ｂ 13～11点／Ｃ 10～9点／Ｄ 8～7点';
function extractKagamiishi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07342' || input.sourceId !== KAGAMIISHI_ID || !input.text.startsWith(KAGAMIISHI_HEAD) || !input.text.includes(KAGAMIISHI_FY)) return [];
  const reportAt = input.text.indexOf('点検評価報告書\n№');
  const out: ProjectEvaluation[] = [];
  // 票の区切りは「№」。番号が見出しの後ろに出力される票もあるため、番号ではなく「№」で分割して票の範囲を限定する。
  for (const sh of sheets(input.text, /№\n\n/).filter(s => s.start > reportAt)) {
    const nm = /\n\n(?:事業名\n\n)?([^\n]+)\n\n担当\n\n(教育グループ|生涯学習グループ)\n/.exec(sh.text.slice(0, 900));
    if (!nm || nm[1] === '事業名') continue;
    const name = nm[1].trim();
    const raw = nm[0].replace(/^\n+/, '').replace(/\n$/, ''), at = sh.start + nm.index + nm[0].indexOf(raw);
    const p = project(input, name, name, 2025, raw, at);
    p.department = nm[2]; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, KAGAMIISHI_FY));
    // 評価委員会の点数：R7とR6の2組。R7の組が位置で確定でき、4項目の和が合計と一致するものだけ採用。
    let scores: { v: string[]; total: string; rank: string | null; raw: string; at: number } | null = null;
    const a1 = /R7(?: 必\n有\n効\n達| 必)?\n([1-4])\n([1-4])\n([1-4])\n([1-4])\n(\d{1,2})\n([A-D])\n/.exec(sh.text);
    const a2 = /有\n効\n達\n([1-4])\n([1-4])\n([1-4])\n([1-4])\n(\d{1,2})\n([A-D])\n価 R7 必\n合\n評\n要\n効\n率\n成\n計\n価\nR6 性\n([1-4])\n([1-4])\n([1-4])\n([1-4])\n(\d{1,2})\n([A-D])\n/.exec(sh.text);
    const b = /(R7\nR6\n\n方今\n向後\n性の\n\n)?必\n要\n性\n\n([1-4])\n([1-4])\n\n[^]{0,20}?有\n効\n性\n\n([1-4])\n([1-4])\n\n[^]{0,20}?効\n率\n性\n\n([1-4])\n([1-4])\n\n[^]{0,20}?達\n成\n度\n\n([1-4])\n([1-4])\n\n[^]{0,20}?合\n計\n\n(\d{1,2})\n(\d{1,2})\n/.exec(sh.text);
    // 列見出し（R7・R6）が直前に無い組は、R7とR6の値がすべて同じ場合のみ採用（列の取り違えが結果に影響しない）。
    const bSame = b && [2, 4, 6, 8, 10].every(k => b[k] === b[k + 1]);
    if (a1) scores = { v: a1.slice(1, 5), total: a1[5], rank: a1[6], raw: a1[0].slice(0, -1), at: a1.index };
    else if (a2 && a2.slice(1, 7).join() === a2.slice(7, 13).join()) scores = { v: a2.slice(1, 5), total: a2[5], rank: a2[6], raw: a2[0].slice(0, -1), at: a2.index };
    else if (b && (b[1] || bSame)) scores = { v: [b[2], b[4], b[6], b[8]], total: b[10], rank: null, raw: b[0].slice(0, -1), at: b.index };
    const rankOk = (t: number, r: string | null) => r === null || (r === 'A' ? t >= 14 : r === 'B' ? t >= 11 && t <= 13 : r === 'C' ? t >= 9 && t <= 10 : t <= 8);
    if (scores && scores.v.reduce((s, x) => s + Number(x), 0) === Number(scores.total) && rankOk(Number(scores.total), scores.rank)) {
      const ev = evidence(input, scores.raw, sh.start + scores.at);
      const ratings: EvaluationRating[] = ['必要性', '有効性', '効率性', '達成度'].map((label, k) => ({ kind: 'external', label: `点検評価委員会 ${label}（R7）`, value: scores!.v[k], scale: KAGAMIISHI_SCALE, evidence: ev }));
      ratings.push({ kind: 'external', label: '点検評価委員会 合計（R7）', value: scores.total, scale: KAGAMIISHI_SCALE, evidence: ev });
      if (scores.rank) ratings.push({ kind: 'external', label: '点検評価委員会 総合評価（R7）', value: scores.rank, scale: KAGAMIISHI_SCALE, evidence: ev });
      p.ratings.push(...ratings);
    }
    const dir = [...sh.text.matchAll(/([①②③④])．(重点化|継続|改善|縮小)/g)];
    if (dir.length === 1) p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir[0][2], scale: '１．重点化／２．継続／３．改善／４．縮小（選択された番号が丸数字）', evidence: evidence(input, dir[0][0], sh.start + dir[0].index!) });
    p.warnings.push('点検評価報告書の事業票の事業名・担当グループ、点検評価委員会の評価点（R7の組が位置で確定し4項目の和が合計と一致する場合のみ）、今後の方向性（丸数字で選択された1つ）を収録。総合評価ランクは点数の直後にランクが印字された票のみ。事業費（R7決算見込・R6決算）は財源内訳との列の対応が確定しないため未収録。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 堺市（令和8年度事務事業評価：局別の評価シート一覧と評価シートPDF）
const SAKAI_SHEETS = new Set(['783fd91c5a2c7920bfbaa38c', 'eef9f0a75727ccf781d7848e']);
function sakaiSheetName(input: CachedInput): string | null {
  return /^令和8年度 事務事業評価シート（1）\n\[ 令和7年度事務事業 \]\n一般会計\n事務事業名\n\n([^\n]+)\n/.exec(input.text)?.[1] ?? null;
}
function extractSakaiSheet(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '27140' || !SAKAI_SHEETS.has(input.sourceId)) return [];
  const head = /^令和8年度 事務事業評価シート（1）\n\[ 令和7年度事務事業 \]\n一般会計\n事務事業名\n\n([^\n]+)\n\n担当部署名\n\n([^\n]+)\n\n([^\n]+)\n\n局\n/.exec(input.text);
  const code = /\n事業番号\n\n(\d{3}-\d{3})\n/.exec(input.text);
  if (!head || !code) return [];
  const headEnd = input.text.indexOf('Ⅰ．基本情報');
  const sections = input.text.slice(0, headEnd).split('\n').filter(l => /^\S+課$/.test(l));
  const p = project(input, code[1], head[1], 2026, head[0], 0);
  p.department = [head[2], head[3], sections.length === 1 ? sections[0] : null].filter(Boolean).join(' ');
  p.evaluatedFiscalYear = 2025;
  p.evidence.push(evidence(input, code[0].slice(1, -1), code.index + 1));
  const n5 = '\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n\\n([\\d,]+)\\n';
  const a = new RegExp(`事業費 \\(a\\)${n5}`).exec(input.text), b = new RegExp(`14 人件費 （ｂ）${n5}`).exec(input.text);
  const c = /15 年間経費 \(ｃ\)=\(ａ\)\+\(ｂ\)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/.exec(input.text);
  const header = /令和5年度\n\n令和6年度\n\n決算\n\n決算\n\n（単位：千円）\n\n令和7年度\n当初予算\n\n令和8年度\n決算\n\n当初予算\n/.exec(input.text);
  if (a && b && c && header && [0, 1, 2, 3].every(k => num(a[1 + k]) + num(b[1 + k]) === num(c[1 + k]))) {
    const ar = a[0].slice(0, -1), br = b[0].slice(0, -1), cr = c[0].slice(0, -1);
    const cols: [number, 'actual' | 'budget', number][] = [[0, 'actual', 2023], [1, 'actual', 2024], [2, 'budget', 2025], [3, 'actual', 2025], [4, 'budget', 2026]];
    for (const [k, kind, y] of cols) {
      if (num(a[1 + k]) > 0) p.amounts.push(amount(input, kind, y, a[1 + k], '千円', ar, a.index));
      if (kind === 'actual' && num(b[1 + k]) > 0) p.amounts.push(amount(input, 'personnel', y, b[1 + k], '千円', br, b.index));
      if (kind === 'actual' && num(c[1 + k]) > 0) p.amounts.push(amount(input, 'fullCost', y, c[1 + k], '千円', cr, c.index));
    }
    p.evidence.push(evidence(input, header[0].slice(0, -1), header.index));
    p.warnings.push('金額は「Ⅲ．投入量 事業コスト」（千円）の事業費(a)・人件費(b)・年間経費(c)で、a＋b＝cの検算が一致した列のみ。列は令和5年度決算・令和6年度決算・令和7年度当初予算・令和7年度決算・令和8年度当初予算の順（当初予算は前年度からの繰越分を含む）。人件費・年間経費は決算列のみ収録。');
  }
  p.warnings.push('令和8年度 事務事業評価シート（令和7年度事務事業）から事業名・事業番号・担当部署を収録。成果指標・活動指標、評価欄の所見・必要性/有効性のチェックは未構造化。');
  return [p];
}
function extractSakaiList(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '27140' || !/\/jimujigyo_r8\/sosiki\/[a-z]+\.html$/.test(input.sourceUrl)) return [];
  const bureau = /^(\S+) 堺市\n/.exec(input.text);
  if (!bureau || !input.text.includes('\n事務事業評価シート\n所管部名\n所管課名\n事務事業名\n分類\n')) return [];
  const sheetNames = new Set(inputs.filter(i => SAKAI_SHEETS.has(i.sourceId)).map(sakaiSheetName).filter(Boolean));
  const lines = input.text.split('\n'), starts: number[] = [];
  lines.reduce((o, l) => { starts.push(o); return o + l.length + 1; }, 0);
  const out: ProjectEvaluation[] = [];
  for (let k = 2; k + 1 < lines.length; k++) {
    const m = /^(.+?)（PDF：[\d,.]+KB）$/.exec(lines[k]);
    if (!m || !/^[A-G]$/.test(lines[k + 1]) || /事業概要一覧表/.test(m[1])) continue;
    const [bu, se] = [lines[k - 2], lines[k - 1]];
    if (!bu || !se || /（PDF|^[A-G]$|^所管/.test(bu + se)) continue;
    const name = m[1].trim();
    if (sheetNames.has(name)) continue; // 評価シートPDFを取得済みの事業はPDF側で収録
    const raw = lines.slice(k - 2, k + 2).join('\n');
    const dept = [bureau[1], bu, se === '―' ? null : se].filter(Boolean).join(' ');
    const p = project(input, `${dept}:${name}`, name, 2026, raw, starts[k - 2]);
    p.department = dept;
    p.evidence.push(evidence(input, bureau[0].slice(0, -1), 0));
    p.warnings.push('令和8年度事務事業評価の局別ページにある「事務事業評価シート」一覧の行（所管部名・所管課名・事務事業名）から収録。評価シート本文（PDF）は未取得のため、金額・指標・所見は未収録。対象は令和7年度実施事業と令和8年度新規事業を含むため評価対象年度は未設定。分類（A〜G）は評価ではないため未収録。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

// ---------------------------------------------------------------- 釜石市（令和６年度 教育委員会の事務の管理及び執行状況に係る点検・評価報告書）
const KAMAISHI_ID = '190b843fb7858d45f21365a9', KAMAISHI_FY = '令和 6 年度の教育委員会の事務の管理及び執行状況に係る点検並びに評価結果を取\nりまとめたものです。';
const KAMAISHI_LABELS = ['拡充(継続）', '現状継続', '縮小(継続)', '廃止(完了含む)'];
const KAMAISHI_SKIP = /^(事業名|担当課|目 的|令和 6 年度|決算額|小学校費|中学校費|（小中学校費）|未来を担う子どもたちの育成|子どもを育む環境づくり|生涯学習・スポーツの振興|歴史・文化・芸術文化の振興|\(\d\) .+|学校給食センター)$/;
const KAMAISHI_DEPT = /^(教育委員会事務局\S*課|まちづくり課\S*|文化振興課\S*)$/;
function extractKamaishi(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03211' || input.sourceId !== KAMAISHI_ID || !input.text.includes(KAMAISHI_FY)) return [];
  const out: ProjectEvaluation[] = [];
  for (const sh of sheets(input.text, '事業名\n担当課\n')) {
    // 見出し部：最初の金額行または本文（目的の文章）までの行から、事業名を1行に確定できる票だけ採用する。
    const lines = sh.text.split('\n'), starts: number[] = [];
    lines.reduce((o, l) => { starts.push(o); return o + l.length + 1; }, 0);
    const head: number[] = [];
    for (let k = 0; k < lines.length && k < 30; k++) {
      if (KAMAISHI_SKIP.test(lines[k])) continue;
      if (lines[k].length > 22 || lines[k] === '取組内容') break;
      if (lines[k] && !/^[\d,]+ 円$/.test(lines[k])) head.push(k);
    }
    const depts = head.filter(k => KAMAISHI_DEPT.test(lines[k])), names = head.filter(k => !KAMAISHI_SKIP.test(lines[k]) && !KAMAISHI_DEPT.test(lines[k]));
    if (names.length !== 1 || depts.length !== 1) continue;
    const name = lines[names[0]].trim();
    const p = project(input, name, name, null, lines[names[0]], sh.start + starts[names[0]]);
    p.department = lines[depts[0]]; p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, lines[depts[0]], sh.start + starts[depts[0]]), evidence(input, KAMAISHI_FY));
    const bodyEnd = sh.text.indexOf('取組内容');
    const yen = [...sh.text.slice(0, bodyEnd > 0 ? bodyEnd : sh.text.length).matchAll(/(?:^|\n)([\d,]+) 円(?=\n)/g)];
    if (yen.length === 1 && /令和 6 年度\n/.test(sh.text.slice(0, 400)) && sh.text.slice(0, 400).includes('決算額')) {
      const off = yen[0].index! + (yen[0][0].startsWith('\n') ? 1 : 0);
      p.amounts.push(amount(input, 'actual', 2024, yen[0][1], '円', `${yen[0][1]} 円`, sh.start + off));
      p.warnings.push('金額は票上部の「令和 6 年度 決算額」欄の金額（円）が1つだけの場合に実績として収録。');
    }
    const rs = sh.text.indexOf('評価結果\n');
    if (rs >= 0 && sh.text.indexOf('廃止(完了含む)', rs) > 0) {
      const seg = sh.text.slice(rs + '評価結果\n'.length).split('廃止(完了含む)')[0] + '廃止(完了含む)';
      const cleaned = seg.replace(/- \d+ -/g, '');
      const marks = [...cleaned.matchAll(/[□■]/g)].map(x => x[0]);
      const rest = cleaned.replace(/[□■]/g, '').replace(/拡充\(継続）|現状継続|縮小\(継続\)|廃止\(完了含む\)/g, '').trim();
      if (marks.length === 4 && marks.filter(x => x === '■').length === 1 && rest === '' && seg.length < 120) {
        p.ratings.push({ kind: 'self', label: '評価結果', value: KAMAISHI_LABELS[marks.indexOf('■')], scale: '拡充（継続）：内容を拡充して取り組む／現状継続：現状どおり継続して取り組む／縮小（継続）：内容を見直しながら継続／廃止（完了含む）：事業完了、他事業との統合',
          evidence: evidence(input, `評価結果\n${seg}`, sh.start + rs) });
      }
    }
    p.warnings.push('点検・評価報告書の事業票から、見出し部で1行に確定できた事業名・担当課と、評価結果（■の選択が1つだけ判別できる場合）を収録。事業名が複数行に分かれた票・複数の金額欄がある票の金額は除外。取組内容・成果と課題の文章は未構造化。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

export const moreEntries: Record<string, Entry> = {
  '11100': { extract: extractSaitama, scope: 'さいたま市総合振興計画 基本計画の実施状況報告書（令和4〜7年度実績）の「施策（の進捗）及び事業の達成状況一覧」から、再掲でない事業行の事業コード・事業名・局・とりまとめ課・事業の達成度（Ａ/Ｂ/Ｃ、令和7年度は計画期間の達成度も）を構造化。施策の進捗度・中間目標達成度、評価シート本文（目標指標・事業費）、重点戦略のKPIは対象外。' },
  '04401': { extract: extractMatsushima, scope: '松島町教育委員会 教育行政点検評価報告書（令和5〜7年度、令和4〜6年度対象）の基本施策ごとの取組項目の票から、項目名と担当課を構造化。評価区分・金額の記載はなく、教育委員会の会議・研修の票、学識経験者の意見書は対象外。' },
  '40647': { extract: extractChikujo, scope: '築上町 2024年度事務事業評価シートの各票から、予算事業名・担当課・事業No.、財源内訳との検算が一致した2021〜2023年度の決算（歳出、千円）、一次評価と幹事会調整後の評価結果（必要性・公共性・有効性・効率性）を構造化。総合評価・今後の方向性欄、2024年度見込額、総括表（列が崩れている）、令和7年度の評価シート（文字情報のないPDF）は対象外。' },
  '07342': { extract: extractKagamiishi, scope: '鏡石町 令和７年度 教育行政に関する点検評価報告書の事業票から、事業名・担当グループ、点検評価委員会の評価点（必要性・有効性・効率性・達成度・合計、位置と合計で確定できるR7分のみ）・総合評価ランク・今後の方向性を構造化。事業費（財源内訳と列の対応が確定しない）と前年度評価、制度説明資料は対象外。' },
  '27140': { extract: (input, inputs) => [...extractSakaiSheet(input), ...extractSakaiList(input, inputs)], scope: '堺市 令和8年度事務事業評価の局別ページの「事務事業評価シート」一覧から事業名・所管部・所管課を、取得済みの評価シートPDF2件から事業名・事業番号・担当部署と検算が一致した事業コスト（事業費・人件費・年間経費、千円）を構造化。事業概要一覧表、分類（A〜G）、成果・活動指標、所見、令和6・7年度の索引ページは対象外。' },
  '03211': { extract: extractKamaishi, scope: '釜石市 令和６年度 教育委員会の事務の管理及び執行状況に係る点検・評価報告書の事業票から、1行に確定できる事業名・担当課、決算額欄が1つの票の令和6年度決算額（円）、評価結果（■の選択）を構造化。複数行の事業名・複数金額の票の該当項目、取組内容・成果と課題の文章、学識経験者の意見は対象外。' },
};
