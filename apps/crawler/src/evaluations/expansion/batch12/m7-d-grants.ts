import type { EvaluationIndicator, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, num, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- 南島原市（地方創生交付金事業実施調書（令和７年度事業）1事業1枚）
const SHIMABARA_SHEETS = '46d3964be60181c7c85c6a22';
const SHEET_HEAD = '地方創生交付金事業実施調書（令和７年度事業）\n担当課\n';

function splitValue(raw: string): { value: string; unit: string | null } {
  const m = /^(-?[\d,.]+) ?(\S+)$/.exec(raw.trim());
  return m ? { value: m[1], unit: m[2] } : { value: raw.trim(), unit: null };
}

/** 指標ブロック（指標①②または③④）: 指標名2つ・目標年月2つ・目標値2つ・実績値2つが揃うもののみ。 */
function indicatorPair(input: CachedInput, blockStart: number, block: string): { names: string[]; rows: { name: string; target: string; actual: string; raw: string; start: number }[] } | null {
  const nameLines = [...block.matchAll(/[^\n]*指 標 名 [^\n]*/g)];
  const names = nameLines.flatMap(m => m[0].split('指 標 名 ').slice(1).map(s => s.trim()).filter(Boolean));
  const tail = /目 標 値\n([^\n]+)\n目 標 値\n([^\n]+)\n実 績 値\n([^\n]+)\n実 績 値\n([^\n]+)/.exec(block);
  if (names.length !== 2 || !tail || !nameLines.length) return null;
  const start = blockStart + nameLines[0].index!, raw = input.text.slice(start, blockStart + tail.index + tail[0].length);
  return { names, rows: [
    { name: names[0], target: tail[1], actual: tail[3], raw, start },
    { name: names[1], target: tail[2], actual: tail[4], raw, start },
  ] };
}

function extractShimabara(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42214' || input.sourceId !== SHIMABARA_SHEETS) return [];
  const t = input.text;
  const title = '地方創生交付金事業実施調書（令和７年度事業）';
  const titleAt = t.indexOf(title);
  if (titleAt < 0 || titleAt > 20) return [];
  const starts = [...t.matchAll(new RegExp(SHEET_HEAD.replace(/[()（）]/g, m => `\\${m}`), 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length);
    // 担当課と事業名（No.N の後から「② 財源」まで）。No.4（同名で繰越分・現年分の2枚）は値が異なる別シートのため除外。
    const head = /^地方創生交付金事業実施調書（令和７年度事業）\n担当課\n(?:([^\n]+)\n① 事業名称\n\nNo\.(\d)\n\n|① 事業名称\n\n([^\n]+)\n\nNo\.(\d)\n\n)([\s\S]+?)\n② 財源\n/.exec(sheet);
    if (!head) return;
    const no = head[2] ?? head[4], dept = (head[1] ?? head[3]).trim(), rawName = head[5];
    if (no === '4' || rawName.includes('＜')) return;
    const name = rawName.replace(/\n/g, '').replace(/^【(?:広域連携|市単独)】/, '');
    const nameAt = s + head.index + head[0].indexOf(rawName, head[0].indexOf('No.'));
    const p = project(input, `No.${no}`, name, null, rawName, nameAt);
    p.projectCode = `No.${no}`;
    p.department = dept;
    p.evaluatedFiscalYear = 2025;
    const deptAt = s + head.index + head[0].indexOf(dept);
    p.evidence.push(evidence(input, title, titleAt),evidence(input, dept, deptAt));
    // 金額: 左欄（地方創生推進交付金など1つ目の財源）の「実績額（事業費）」が値と隣接して印字されるもののみ
    const act = /実績額（事業費）\n([\d,]+) 円\n/.exec(sheet);
    if (act) p.amounts.push(amount(input, 'actual', 2025, act[1], '円', act[0].trimEnd(), s + act.index));
    else p.warnings.push('実績額（事業費）が値と離れて印字され列の対応が確定しないため、金額は収録していません。');
    // 指標: ①②の組と③④の組。指標①の実績値は全シートで「58」と印字され、一覧表（資料3の別版）や所管課の評価文と食い違うため収録しない。
    const kpi = sheet.indexOf('⑥ 本事業における重要業績評価指標（KPI）'), b3 = sheet.indexOf('指標③', kpi), b7 = sheet.indexOf('⑦ 実績を踏まえた', b3);
    if (kpi > 0 && b3 > kpi && b7 > b3) {
      const pairs = [{ start: s + kpi, block: sheet.slice(kpi, b3), skipFirst: true }, { start: s + b3, block: sheet.slice(b3, b7), skipFirst: false }];
      for (const pr of pairs) {
        const pair = indicatorPair(input, pr.start, pr.block);
        if (!pair) continue;
        pair.rows.forEach((r, i) => {
          if (pr.skipFirst && i === 0) return;
          const tg = splitValue(r.target), ac = splitValue(r.actual);
          if (tg.unit !== ac.unit) return;
          const ind: EvaluationIndicator = { name: r.name, fiscalYear: 2025, target: tg.value, actual: ac.value, unit: tg.unit, evidence: evidence(input, r.raw, r.start) };
          p.indicators.push(ind);
        });
      }
    }
    // 所管課の評価（事業効果・今後の方針）
    const ev = /事\n業\n効\n果 ([^\n]+)\n今 後 の 方 針 ([^\n]+)\n/.exec(sheet);
    if (ev) {
      const at = s + ev.index;
      p.ratings.push({ kind: 'self', label: '事業効果', value: ev[1], scale: null, evidence: evidence(input, ev[0].slice(0, ev[0].indexOf('\n今 後')), at) });
      p.ratings.push({ kind: 'self', label: '今後の方針', value: ev[2], scale: null, evidence: evidence(input, `今 後 の 方 針 ${ev[2]}`, at + ev[0].indexOf('今 後')) });
    }
    p.warnings.push('地方創生交付金の事業実施調書（1事業1枚）で、交付金の効果検証であり事務事業評価ではない。金額は「実績額（事業費）」（円）を令和7年度の実績として収録（交付対象経費・交付決定額は未収録）。指標は目標年月（令和8年3月）から令和7年度として収録。指標①の実績値は全シートで同じ「58」と印字され別版の一覧表・評価文と食い違うため除外。事業名冒頭の【広域連携】【市単独】の区分表記は事業名から除いた。');
    out.push(p);
  });
  return mergeReprints(out, p => `${p.projectName}|${p.evaluatedFiscalYear}`);
}

// ---------------------------------------------------------------- 陸別町（地方創生臨時交付金 充当事業一覧）
// 行: 番号・補助/単独・事業名・目的と実績・事業期間・事業費決算額・交付金充当額・その他財源・一般財源・成果・所管課。
// 事業費決算額 = 交付金充当額 + その他財源 + 一般財源 の検算が合う場合のみ金額を収録する。
const RIKUBETSU: Record<string, { fy: number; rows: { title: RegExp; name: RegExp; nameText: string; total: string; grant: string; other: string; general: string; dept: string }[] }> = {
  '49ea7047f0a2ac13e88cfc89': { fy: 2024, rows: [
    { title: /令和６年度物価高騰対応重点支援地方創生臨時交付金 充当事業一覧（令和6年度 国の補正予算（推奨事業）対応分）/, name: /陸別町農業者緊急 ②家畜飼養農業者に対して支援金を給付する。\n11 単\n～\n47,314,000 17,756,000\n支援事業補助金/,
      nameText: '陸別町農業者緊急支援事業補助金', total: '47,314,000', grant: '17,756,000', other: '0', general: '29,558,000', dept: '産業振興課' },
  ] },
  'b9bbc4774706fb8dca2bfb5a': { fy: 2023, rows: [
    { title: /令和５年度新型コロナウイルス感染症対応地方創生臨時交付金充当事業一覧/, name: /プレミアム商品券発 ②プレミアム分（40%）と事務費を対象経費として、町が商工会に補助。当該\n7 単\n行事業\n補助金に交付金を充当する。/,
      nameText: 'プレミアム商品券発行事業', total: '30,283,145', grant: '19,252,000', other: '0', general: '11,031,145', dept: '産業振興課' },
    { title: /令和５年度物価高騰対応重点支援地方創生臨時交付金充当事業一覧（令和5年度完了事業分）/, name: /農業者緊急支援事 ②飼養家畜の分類ごとに基準単価を定め、頭数により算出した支援額に交\n10 単\n業\n付金を充当する。/,
      nameText: '農業者緊急支援事業', total: '49,197,000', grant: '14,069,000', other: '0', general: '35,128,000', dept: '産業振興課' },
  ] },
};

function extractRikubetsu(input: CachedInput): ProjectEvaluation[] {
  const doc = RIKUBETSU[input.sourceId];
  if (input.municipalityCode !== '01648' || !doc) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const r of doc.rows) {
    const title = r.title.exec(t), name = r.name.exec(t);
    if (!title || !name || name.index < title.index) continue;
    // 当該表の範囲（次の表題まで）
    const next = t.indexOf('充当事業一覧', title.index + title[0].length);
    const end = next < 0 ? t.length : t.lastIndexOf('\n', next);
    const table = t.slice(title.index, end);
    if (num(r.total) !== num(r.grant) + num(r.other) + num(r.general)) continue;
    // 決算額は行頭に印字された値（説明文中の同額ではなく表の列）を根拠にする
    const totalM = new RegExp(`\\n${r.total}[ \\n]`).exec(table);
    const totalAt = totalM ? title.index + totalM.index + 1 : -1, deptAt = t.indexOf(r.dept, name.index);
    if (totalAt < 0 || totalAt > end || deptAt < 0 || deptAt > end || !table.includes(r.grant) || !table.includes(r.general)) continue;
    const p = project(input, nfkc(r.nameText), r.nameText, null, name[0], name.index);
    p.department = r.dept;
    p.evaluatedFiscalYear = doc.fy;
    p.evidence.push(evidence(input, title[0], title.index), evidence(input, r.dept, deptAt));
    p.amounts.push(amount(input, 'actual', doc.fy, r.total, '円', r.total, totalAt));
    p.warnings.push(`地方創生臨時交付金の充当事業一覧（交付金実績報告に基づく公表資料）で、交付金の効果検証であり事務事業評価ではない。事業名は抽出テキスト上で説明文と行が交互に並ぶため「${r.nameText}」と連結して収録。金額は「事業費 決算額（円）」を表題の年度（令和${doc.fy - 2018}年度）の実績として収録し、交付金充当額＋その他財源＋一般財源との検算一致を確認。評価年度は本文に明記がないため未設定。`);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 吉備中央町（デジタル田園都市国家構想推進交付金 TYPE1 事業実施報告書）
const KIBI: Record<string, { name: string; dept: string }> = {
  '98b41b73306c3a454673e524': { name: '吉備中央町交通DX実装プロジェクト', dept: '総務課' },
  'a12127111f5f861ae9aa05dd': { name: '吉備中央町鳥獣対策DX実装プロジェクト', dept: '企画課' },
};
function extractKibichuo(input: CachedInput): ProjectEvaluation[] {
  const doc = KIBI[input.sourceId];
  if (input.municipalityCode !== '33681' || !doc) return [];
  const t = input.text;
  const title = 'デジタル田園都市国家構想推進交付金（デジタル実装タイプTYPE1） 事業実施報告書';
  const nameRaw = `交付対象事業の名称\n${doc.name}\n`, deptRaw = `担当部局名\n\n${doc.dept}\n`;
  const nameAt = t.indexOf(nameRaw), deptAt = t.indexOf(deptRaw);
  if (!t.startsWith(title) || nameAt < 0 || deptAt < 0) return [];
  const p = project(input, nfkc(doc.name), doc.name, null, nameRaw.trimEnd(), nameAt);
  p.department = doc.dept;
  p.evidence.push(evidence(input, title, 0), evidence(input, deptRaw.trimEnd(), deptAt));
  p.warnings.push('デジタル田園都市国家構想推進交付金（令和3年度補正）の事業実施報告書で、交付金の効果検証であり事務事業評価ではない。事業名・担当部局名のみの部分構造化。KPIの目標値・実績値は表の列対応が抽出テキスト上で確定しないため未収録。評価年度は本文に明記がないため未設定。');
  return [p];
}

export const grantEntries: Record<string, Entry> = {
  '42214': { extract: extractShimabara, scope: '南島原市 地方創生交付金事業実施調書（令和7年度事業・1事業1枚）の事業名・担当課・実績額（事業費）・KPI（指標②〜④の目標値/実績値）・事業効果と今後の方針。交付金の効果検証であり事務事業評価ではない。指標①（実績値が全シート同一の誤植）、No.4世界遺産センター整備事業（繰越分・現年分の2枚）、実績一覧表（列崩れ）、総合戦略評価指標一覧は対象外。' },
  '01648': { extract: extractRikubetsu, scope: '陸別町 地方創生臨時交付金 充当事業一覧（令和5年度・令和6年度）の事業名・所管課・事業費決算額（交付金充当額＋その他財源＋一般財源の検算が一致するもの）。交付金の効果検証であり事務事業評価ではない。目的・実績の文章、成果・効果の評価文は対象外。' },
  '33681': { extract: extractKibichuo, scope: '吉備中央町 デジタル田園都市国家構想推進交付金（TYPE1）事業実施報告書2件の事業名・担当部局名のみ（部分構造化）。交付金の効果検証であり事務事業評価ではない。KPI値、TYPE3報告書、地方創生臨時交付金の効果検証一覧（事業名と金額の列が崩れる）、事業種別の集計表、少子化対策交付金の事後評価書は対象外。' },
};
