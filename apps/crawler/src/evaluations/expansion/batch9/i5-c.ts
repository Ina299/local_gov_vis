import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc } from '../batch7/g1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** First occurrence of a heading that must exist verbatim, as evidence. */
function must(input: CachedInput, raw: string) {
  return input.text.includes(raw) ? evidence(input, raw) : null;
}

/** Same name twice in one cycle cannot be told apart by the integrator: keep neither. */
function uniqueNames(records: ProjectEvaluation[]): ProjectEvaluation[] {
  const count = new Map<string, number>();
  for (const p of records) count.set(nfkc(p.projectName), (count.get(nfkc(p.projectName)) ?? 0) + 1);
  return records.filter(p => count.get(nfkc(p.projectName)) === 1);
}

const MOGAMI_R4_LIST = '4ce6e24ac0ad1b0cb124b21e';
const MOGAMI_R5_LIST = '7c1bd78262e7e76ab36a3ac2';
const MOGAMI_R4_SCALE = '1. 81点以上 継続性あり／2. 71～80点 継続性は認められるが見直しを検討する必要あり／3. 61～70点 縮小または他の事務事業との統合化を検討する必要あり／4. 60点以下 廃止を検討する必要あり（1次～3次評価の平均値）';
const MOGAMI_R5_SCALE = '継続性あり／継続性は認められるが見直しを検討／縮小又は統合／廃止を検討／法定事業／その他';

const r4Rank = (score: number) => score >= 81 ? '1' : score >= 71 ? '2' : score >= 61 ? '3' : '4';
const r5Direction = (score: number) => score >= 80 ? '継続' : score >= 70 ? '見直し' : score >= 60 ? '縮小・統合' : '廃止';

/** 最上町 令和４年度（現年度事業）事務事業評価 最終評価シート（一覧）の行。評価年度は同時公開の報告書の表題による。 */
function extractMogamiR4(input: CachedInput): ProjectEvaluation[] {
  const title = '令和４年度（現年度事業）事務事業評価 最終評価シート';
  if (input.sourceId !== MOGAMI_R4_LIST || !input.text.startsWith(title)) return [];
  const titleEv = evidence(input, title, 0);
  // 「番号 事業番号 担当課 枝番」が1行のものと、事業番号・担当課・枝番が別行のもの（最上病院の行）。
  const row = /(?<=\n\n)(?:\d+ )?(\d-\d-\d-\d-\d)(?: ([^\n\d ]+(?:課|室)) ?\d|\n\n([^\n\d]+(?:課|室|病院))\n\n\d)\n\n([^\n]+)\n\n(\d+)\n\n(\d+)\n\n(\d+)\n\n(\d+)\n\n([1-4])\n\n(\9\.[^\n]+)(?=\n)/g;
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(row)) {
    const [raw, code, deptA, deptB, name, s1, s2, s3, fin, rank, label] = m, dept = deptA ?? deptB;
    const scores = [s1, s2, s3].map(Number), final = Number(fin);
    // 最終点は1次〜3次の平均（報告書の評価システム）。平均・評価区分の点数帯と食い違う行は列ずれの疑いがあるため除外。
    if (Math.abs(scores.reduce((a, b) => a + b, 0) / 3 - final) > 1 || r4Rank(final) !== rank) continue;
    const s = m.index!;
    const p = project(input, code, name, null, raw, s);
    p.department = dept; p.evaluatedFiscalYear = 2022;
    const ev = evidence(input, raw, s);
    p.ratings.push({ kind: 'self', label: '評価点数（1次）', value: s1, scale: '担当課による評価点（全9項目）', evidence: ev });
    p.ratings.push({ kind: 'self', label: '評価点数（2次）', value: s2, scale: '他課管理職による評価点（平均値）', evidence: ev });
    p.ratings.push({ kind: 'self', label: '評価点数（3次）', value: s3, scale: '特別職による評価点', evidence: ev });
    p.ratings.push({ kind: 'self', label: '評価点数（最終）', value: fin, scale: '1次～3次評価の平均値', evidence: ev });
    p.ratings.push({ kind: 'self', label: '最終評価内容', value: label, scale: MOGAMI_R4_SCALE, evidence: ev });
    p.evidence.push(titleEv);
    p.warnings.push('令和４年度（現年度事業）事務事業評価 最終評価シート（一覧）の1行から事業番号・担当課・事務事業名・1次〜3次・最終の評価点数・最終評価内容を収録。評価対象年度は一覧表題の「令和４年度（現年度事業）」による。同時公開の報告書（令和５年度（令和４年度事業）事務事業評価報告書）が評価年度を令和5年度としているが、一覧自体に評価年度の記載がないため評価年度は未設定。評価区分の点数帯・評価者（1次担当課・2次他課管理職・3次特別職）は同報告書の記載による。最終点が1〜3次の平均と1点を超えて食い違う行、評価区分の点数帯と合わない行、改ページで番号・事業名・評価内容が分離した行、未評価の行は除外。事業費は対象外。');
    out.push(p);
  }
  return uniqueNames(mergeReprints(out, p => p.projectCode!));
}

/** 最上町 令和５年度（現年度事業）事務事業の評価（最終評価シート一覧）の行。評価年度は同時公開の総括の表題による。 */
function extractMogamiR5(input: CachedInput): ProjectEvaluation[] {
  const title = '令和５年度（現年度事業）事務事業の評価';
  if (input.sourceId !== MOGAMI_R5_LIST || !input.text.startsWith(title)) return [];
  const titleEv = evidence(input, title, 0);
  // 方向性の次が次の行の番号でない行は、改ページ等で方向性が別の行のものとずれている可能性があるため取らない。
  const row = /(?<=\n\n)(\d+(?:-\d)?)\n\n(\d-\d-\d-\d-\d)\n\n(\d)\n\n([^\n]+)\n\n([^\n]+?(?:課|室))\n\n(\d+|-)\n\n(継続|見直し|縮小・統合|廃止|法定|その他)(?=\n\n\d+(?:-\d)?\n\n\d-\d-\d-\d-\d\n|\n*$)/g;
  const out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(row)) {
    const [raw, , code, , name, dept, score, dir] = m;
    if (score === '-' ? !['法定', 'その他'].includes(dir) : r5Direction(Number(score)) !== dir) continue;
    const s = m.index!;
    const p = project(input, code, name, null, raw, s);
    p.department = dept; p.evaluatedFiscalYear = 2023;
    const ev = evidence(input, raw, s);
    if (score !== '-') p.ratings.push({ kind: 'self', label: '3次評価 得点', value: score, scale: '3次評価（副町長）の得点', evidence: ev });
    p.ratings.push({ kind: 'self', label: '事業の方向性', value: dir, scale: MOGAMI_R5_SCALE, evidence: ev });
    p.evidence.push(titleEv);
    p.warnings.push('令和５年度（現年度事業）事務事業の評価（最終評価シート一覧）の1行から事業番号・事務事業名・担当課・3次評価得点・事業の方向性を収録。評価対象年度は一覧表題の「令和５年度（現年度事業）」による。同時公開の総括（令和６年度（令和５年度事業）事務事業評価の総括）が評価年度を令和6年度としているが、一覧自体に評価年度の記載がないため評価年度は未設定。3次評価者（副町長）は同総括の記載による。得点が「-」の行は得点を収録せず方向性（法定／その他）のみ。得点と方向性の点数帯（評価シートの80点以上・79～70点・69～60点・59点以下）が合わない行と、改ページで方向性が分離した行は除外。個別の事務事業評価シート（2資料）は事業費の列対応が確定しないため対象外。');
    out.push(p);
  }
  return uniqueNames(mergeReprints(out, p => p.projectCode!));
}

function extractMogami(input: CachedInput): ProjectEvaluation[] {
  return [...extractMogamiR4(input), ...extractMogamiR5(input)];
}

const TSUGARU_DOCS: Record<string, number> = { '0c1c322eedff34ba6f305af1': 7, '3f94ddcd3ed666e8f8709fff': 6, '6802f03cbdc4f8cbd82804b3': 4, '51acd8424f9d2765c7797a64': 3 };
const kanji = (n: number) => String(n).replace(/\d/g, d => String.fromCharCode(0xff10 + Number(d)));

/** つがる市 教育委員会事務の点検及び評価報告書（令和3・4・6・7年度分）の事業別シート見出し（事業名・担当・当初予算・決算）。 */
function extractTsugaru(input: CachedInput): ProjectEvaluation[] {
  const reiwa = TSUGARU_DOCS[input.sourceId];
  if (!reiwa) return [];
  const title = `教育委員会事務の点検及び評価報告書\n\n－令和${kanji(reiwa)}年度分－`;
  if (!input.text.startsWith(title)) return [];
  const titleEv = evidence(input, title, 0), fy = 2018 + reiwa, t = input.text, out: ProjectEvaluation[] = [];
  const isDept = (s: string) => /^(?:[^\n]+\n)?[^\n]+課$/.test(s);
  const amt = () => `([\\d,]+|－) 千円\\n\\n決算\\n\\n([\\d,]+|－) 千円\\n\\n執行率\\n\\n(?:([\\d.]+) ％|－％)`;
  const head = String.raw`事 業 №\n\n(\d+)\n\n(?:[^\n]*\n+){0,8}?`;
  const nameDept = String.raw`事業名\n\n(?:([^\n]+)\n\n担当\n\n([^\n]+(?:\n[^\n]+)?)|担当\n\n([^\n]+)\n\n([^\n]+(?:\n[^\n]+)?))\n\n`;
  const patterns: RegExp[] = reiwa >= 6
    ? [new RegExp(head + nameDept + `令和(\\d)年度 当初\\n\\n${amt()}\\n\\n令和(\\d)年度 当初\\n\\n${amt()}`, 'g')]
    : reiwa === 4
      ? [new RegExp(String.raw`事 業 №\n\n(\d+)\n\n予\n\n` + nameDept + `算 当初\\n\\n${amt()}\\n\\n前年度予算 当初\\n\\n${amt()}`, 'g')]
      : [new RegExp(String.raw`事 業 №\n\n(\d+)\n\n予\n\n算 当初\n\n事業目的\n\n事\n計\n実\n\n業\n画\n績\n\n事業名\n\n([^\n]+)\n\n([\d,]+) 千円\n\n担当\n\n決算\n\n([\d,]+) 千円\n\n執行率\n\n([^\n]+課)\n([\d.]+) ％`, 'g')];
  for (const m of t.matchAll(patterns[0])) {
    const s = m.index!, raw = m[0];
    let no: string, name: string, dept: string;
    const years: { fy: number; budget: string; actual: string; rate: string | undefined }[] = [];
    if (reiwa === 3) {
      [, no, name, , , dept] = m;
      years.push({ fy, budget: m[3], actual: m[4], rate: m[6] });
    } else {
      no = m[1];
      [name, dept] = m[2] !== undefined ? [m[2], m[3]] : [m[4], m[5]];
      if (reiwa >= 6) {
        if (Number(m[6]) !== reiwa || Number(m[10]) !== reiwa - 1) continue;
        years.push({ fy, budget: m[7], actual: m[8], rate: m[9] }, { fy: fy - 1, budget: m[11], actual: m[12], rate: m[13] });
      } else years.push({ fy, budget: m[6], actual: m[7], rate: m[8] }, { fy: fy - 1, budget: m[9], actual: m[10], rate: m[11] });
    }
    if (!isDept(dept) || /課$/.test(name) || /^(?:事業名|担当|事業目的)$/.test(name)) continue;
    // 執行率（決算÷当初）が本文の値と一致しない場合は当初・決算の対応が確定しないため除外。「－」（全て空欄）と0千円の年度は金額を入れない。
    const num = (v: string) => Number(v.replaceAll(',', ''));
    const blank = (y: (typeof years)[number]) => (y.budget === '－' && y.actual === '－' && y.rate === undefined) || (num(y.budget) === 0 && num(y.actual) === 0);
    if (years.some(y => !blank(y) && (y.rate === undefined || y.budget === '－' || y.actual === '－' || num(y.budget) === 0 || Math.abs(num(y.actual) / num(y.budget) * 100 - Number(y.rate)) > 0.01))) continue;
    const p = project(input, `事業№${no}`, name, null, raw, s);
    p.department = dept.replace('\n', ''); p.evaluatedFiscalYear = fy;
    for (const y of years.filter(y => !blank(y))) {
      p.amounts.push(amount(input, 'budget', y.fy, y.budget, '千円', raw, s));
      p.amounts.push(amount(input, 'actual', y.fy, y.actual, '千円', raw, s));
    }
    p.evidence.push(titleEv);
    p.warnings.push(`教育委員会事務の点検及び評価報告書（令和${reiwa}年度分）の事業別シート見出しから事業№・事業名・担当課・当初予算額・決算額（千円）を収録。` +
      (reiwa === 4 ? '「予算 当初／決算」を報告書の対象年度（令和4年度）、「前年度予算 当初／決算」を令和3年度として扱った（事業№1は令和3年度分報告書の当初・決算と一致）。' : reiwa === 3 ? '当初・決算は対象年度（令和3年度）の値。' : '') +
      '金額は本文の執行率（決算÷当初）と一致する場合のみ（一致しないシートは除外）、「－」や0千円の年度は金額なし。総合評価（A・B等）はシート内の位置が改ページで前後のシートとずれる箇所があり事業との対応が確定しないため未収録。事業内容の内訳金額、成果・課題の文章は未構造化。評価年度は資料に明記がなく未設定。');
    out.push(p);
  }
  return uniqueNames(mergeReprints(out, p => p.projectCode!));
}

const AKIRUNO_DOCS: Record<string, [number, number]> = {
  '096a6058a6d53b2a22e14b8c': [6, 5], 'ee8b796eacd63f2fb8ad397b': [7, 6], '1a0e1816af451801a2b2d25e': [8, 7],
};

/** あきる野市 教育委員会の権限に属する事務の管理及び執行の状況の点検及び評価 報告書の事務事業ごとの点検評価（取組状況・課題）。 */
function extractAkiruno(input: CachedInput): ProjectEvaluation[] {
  const years = AKIRUNO_DOCS[input.sourceId];
  if (!years) return [];
  const [ey, fy] = years;
  const title = `令和${kanji(ey)}年度\nあきる野市教育委員会の権限に属する事務の管理\n及び執行の状況の点検及び評価（令和${kanji(fy)}年度分）`;
  const titleEv = must(input, title), targetEv = must(input, '事務事業を担当する各係に、対象年度に実施した事務事業の点検・評価を行います。');
  if (!titleEv || !targetEv || !input.text.startsWith(title)) return [];
  // 見出し（事業名・【担当】・主な取組状況）から課題の記載の終わり（空行または頁番号）まで。
  const row = /(?<=\n\n)([^\n]+)\n\n【([^】\n]+)】\n主な取組状況\n\n([◆●【][^]*?)\n\n?課 ?題\n([・【][^]*?)(?=\n\n|\n- \d+ -)/g, out: ProjectEvaluation[] = [];
  for (const m of input.text.matchAll(row)) {
    const [raw, name, dept, activities] = m;
    if (name.length > 30 || /[。、]/.test(name) || /基本施策|取組目標/.test(name) || /主な取組状況|\n\n\n/.test(raw.slice(raw.indexOf('主な取組状況') + 6))) continue;
    const s = m.index!;
    const p = project(input, name, name, 2018 + ey, raw, s);
    p.projectCode = null; p.department = dept; p.evaluatedFiscalYear = 2018 + fy;
    p.activities = activities;
    p.evidence.push(titleEv, targetEv);
    p.warnings.push(`令和${ey}年度 教育委員会の点検及び評価報告書（令和${fy}年度分）の事務事業（教育基本計画の53事業）ごとの記載から、事業名・担当（【】内）・主な取組状況（原文のまま）を収録。課題の文章は根拠テキストに含むが項目化していない。報告書は事業別の評価区分・事業費を示していないため評価・金額は未収録。見出し（事業名・担当・主な取組状況）の並びが改ページ等で崩れた事業（各年度5〜7事業）は除外。基本施策単位の評価・施策の目標（指標表）は対象外。`);
    out.push(p);
  }
  return uniqueNames(out);
}

export const entries: Record<string, Entry> = {
  '06362': { extract: extractMogami, scope: '令和４年度（現年度事業）事務事業評価 最終評価シート一覧（1次〜3次・最終の評価点数と最終評価内容）と令和５年度（現年度事業）事務事業の評価一覧（3次評価得点・事業の方向性）の行を事業単位で構造化。評価対象年度は各一覧の表題による（評価年度は一覧に記載がなく未設定）。個別の事務事業評価シート（事業費の列対応が確定しない）、予算・決算額一覧、総括・報告書本文は対象外。' },
  '02209': { extract: extractTsugaru, scope: '教育委員会事務の点検及び評価報告書（令和3・4・6・7年度分）の事業別シート見出し（事業№・事業名・担当課・当初予算額・決算額、執行率で照合）を構造化。総合評価（A/B）は改ページでシートとの対応が確定しないため対象外。審議状況・施策別一覧・意見等も対象外。' },
  '13228': { extract: extractAkiruno, scope: '教育委員会の権限に属する事務の管理及び執行の状況の点検及び評価報告書（令和5・6・7年度分）の事務事業ごとの記載（事業名・担当・主な取組状況）を構造化。評価区分・事業費は報告書にないため対象外。基本施策の目標指標表、第２次総合計画進捗管理シート（施策単位）は対象外。' },
};
