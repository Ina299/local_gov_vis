import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

const key = (p: ProjectEvaluation) => `${nfkc(p.projectName)}|${p.department ?? ''}|${p.evaluationYear}|${p.evaluatedFiscalYear}`;

// ---------------------------------------------------------------- 六ヶ所村（教育に関する事務の点検及び評価に関する報告書 令和５年度事業分）
const ROKKASHO_ID = '0b23fd6de3e3813ed9cbf69a';
const ROKKASHO_TITLE = '教育に関する事務の点検\n\n及び評価に関する報告書\n令和５年度事業分';
const ROKKASHO_SCALE = 'Ａ：期待通りの成果が上がっており、現状のまま継続する。\nＢ：概ね期待通りであるが、さらに改善の余地がある。\nＣ：早急に改善を要する。';
const ROKKASHO_DEPTS = new Set(['学務課', '学校給食ｾﾝﾀｰ', '学校給食センター', '社会教育課', '中央公民館', '泊地区ふれあいｾﾝﾀｰ', '泊地区ふれあいセンター', '千歳平地区公民館']);
function extractRokkasho(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '02411' || input.sourceId !== ROKKASHO_ID) return [];
  const t = input.text;
  if (!t.startsWith(ROKKASHO_TITLE) || !t.includes(ROKKASHO_SCALE)) return [];
  const bodyAt = t.indexOf('主要な事業の概要\n施');
  if (bodyAt < 0) return [];
  // 個票は「施\n事\n…名 <施策名>…名 <事業名>…No.N…<担当課>」で始まる。
  const starts = [...t.slice(bodyAt).matchAll(/\n施\n/g)].map(m => bodyAt + m.index! + 1);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const seg = t.slice(s, starts[k + 1] ?? t.length);
    const nos = [...seg.matchAll(/No\.(\d+)/g)], names = [...seg.matchAll(/\n名 ([^\n]+)/g)];
    if (nos.length !== 1 || names.length !== 2) return;
    const nameLine = names[1], name = nameLine[1].replace(/ (新規|中止|廃止)$/, '').trim();
    const p = project(input, `No.${nos[0][1]}`, name, null, nameLine[0].slice(1), s + nameLine.index! + 1);
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, `No.${nos[0][1]}`, s + nos[0].index!), evidence(input, ROKKASHO_TITLE, 0));
    // 担当課は個票内に単独行で1種類だけ現れる場合のみ採る。
    const depts = [...seg.matchAll(/(?<=\n)([^\n]+)(?=\n)/g)].filter(m => ROKKASHO_DEPTS.has(m[1]));
    if (depts.length && depts.every(d => d[1] === depts[0][1])) {
      p.department = depts[0][1];
      p.evidence.push(evidence(input, depts[0][1], s + depts[0].index!));
    }
    const cost = [...seg.matchAll(/令和５年度決算額\n\n([\d,]+) 千円\n([^\n]*)\n/g)];
    if (cost.length === 1) {
      const c = cost[0], raw = c[0].slice(0, -1), off = s + c.index!;
      p.amounts.push(amount(input, 'actual', 2023, c[1], '千円', raw, off));
      if (/^[AＡBＢCＣ]$/.test(c[2])) {
        p.ratings.push({ kind: 'self', label: '評価（担当課の一次評価・教育委員の二次評価を経た個票の評価）', value: c[2], scale: ROKKASHO_SCALE.replace(/\n/g, ' '), evidence: evidence(input, raw, off) });
      }
      p.warnings.push('金額は個票の「令和５年度決算額」（千円）。評価は決算額の直後に記載された個票の評価欄の値（Ａ〜Ｃ、「―」は中止・廃止事業で未収録）。');
      if (c[1] === '0') p.warnings.push('決算額は個票に「0 千円」と印字された値（中止・廃止事業）。空欄を0としたものではない。');
    } else {
      p.warnings.push('個票の決算額・評価欄が抽出テキストで本文と交互に崩れており対応が確定しないため金額・評価は未収録。');
    }
    p.warnings.push('六ヶ所村教育委員会の点検・評価報告書（令和５年度事業分）の個票。評価年度は本文に明記がないため未設定。指標は個票に記載がない。');
    out.push(p);
  });
  return mergeReprints(out, key);
}

// ---------------------------------------------------------------- 一宮市（2025年度 行政評価結果報告 施策評価シート「７．施策実現に向けて実施した事業」）
const ICHINOMIYA_ID = 'e6e79ca38af8294e18032dc6';
const ICHINOMIYA_TITLE = '2025 年度\n行政評価結果報告\n\n一宮市';
const DEPT = '[^ \\n]{1,20}?(?:課|室|所|館|センター|局)';
// 事業名と担当課が同じ行、または事業名→担当課→決算→必要性 が連続する行のみ採る（事業展開の方向性の断片を事業名と誤らないよう、事業名は「…事業」「…事業（…）」に限る）。
const ICHINOMIYA_ROW = new RegExp(`(?<=\\n\\n)([^\\n]*?事業(?:（[^）\\n]+）)?)(?: |\\n\\n)(${DEPT})\\n\\n([\\d,]+|-)\\n\\n(○|要検討)\\n`, 'g');
function extractIchinomiya(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '23203' || input.sourceId !== ICHINOMIYA_ID || !input.text.startsWith(ICHINOMIYA_TITLE)) return [];
  const t = input.text, sheetsAt = t.indexOf('（２）各施策の施策評価シート');
  if (sheetsAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  const heads = [...t.slice(sheetsAt).matchAll(/７．施策実現に向けて実施した事業（実施計画に掲載した事業）とその評価結果\n/g)].map(m => sheetsAt + m.index!);
  for (const h of heads) {
    const end = t.indexOf('８．大幅な見直しを行う事業', h);
    if (end < 0) continue;
    const sec = t.slice(h, end);
    for (const m of sec.matchAll(ICHINOMIYA_ROW)) {
      const name = m[1].trim();
      if (!name || /[★○]/.test(name)) continue;
      const off = h + m.index!, raw = m[0].slice(0, -1);
      const p = project(input, name, name, 2025, raw, off);
      p.department = m[2];
      p.evidence.push(evidence(input, ICHINOMIYA_TITLE, 0), evidence(input, '７．施策実現に向けて実施した事業（実施計画に掲載した事業）とその評価結果', h));
      p.ratings.push({ kind: 'self', label: '事業評価結果（必要性）', value: m[4], scale: '必要性は「○」または「要検討」の２段階評価', evidence: evidence(input, raw, off) });
      p.warnings.push('2025年度行政評価の施策評価シート「７．」に掲載された事業（2024年度実施計画掲載事業）。決算欄は単位の記載がないため金額は未収録。有効性・効率性（★）は抽出テキストで行との対応が崩れているため未収録。評価対象年度は本文で事業単位に明示されないため未設定。');
      out.push(p);
    }
  }
  return mergeReprints(out, key);
}

// ---------------------------------------------------------------- 姫路市（教育に関する事務の管理及び執行の状況の点検及び評価の結果報告書（令和７年度実績）事務事業個票）
const HIMEJI_ID = 'b6fa78f093036a20bea05ae4';
const HIMEJI_TITLE = '教育に関する事務の管理及び執行の状況\nの点検及び評価の結果報告書\n（令和７年度実績）';
const HIMEJI_DEPT = /^[^\s\d・▶【]{2,12}(?:課|室|館|ｾﾝﾀｰ|センター)$/;
function extractHimeji(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '28201' || input.sourceId !== HIMEJI_ID || !input.text.startsWith(HIMEJI_TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  // 個票の事業番号・事業名の行（1行に収まり、直後に「担当課」か「事業の内容」が続くもの。改行で折り返した事業名は採らない）。
  const heads = [...t.matchAll(/(?<=\n)([１-９]－[１-９]－[①-⑳]) ([^\n]+)\n\n(?=担当課\n|事業の\n内容\n)/g)]
    .filter(h => t.slice(Math.max(0, h.index! - 40), h.index!).includes('事業名\n'));
  heads.forEach((h, k) => {
    if (h[2].startsWith('（再掲）')) return;
    const s = h.index!, seg = t.slice(s, heads[k + 1]?.index ?? t.length);
    const raw = h[0].replace(/\n+$/, '');
    const p = project(input, h[1], h[2].trim(), null, raw, s);
    p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, HIMEJI_TITLE, 0));
    // 担当課は「担当課」直後か「実績・成果」直前のどちらかに出る。両方に出て食い違う場合、
    // 事業名より前に担当課欄がある個票（複数課の可能性）は未設定。
    const cands: { name: string; raw: string; at: number }[] = [];
    const a = /^担当課\n+([^\n]+)\n+事業の/.exec(seg.slice(h[0].length));
    if (a && HIMEJI_DEPT.test(a[1])) cands.push({ name: a[1], raw: a[0].replace(/\n+事業の$/, ''), at: s + h[0].length });
    const r = seg.indexOf('\n実績・成果');
    if (r >= 0) {
      const before = /\n([^\n]+)\n+$/.exec(seg.slice(0, r + 1));
      if (before && HIMEJI_DEPT.test(before[1])) cands.push({ name: before[1], raw: before[1], at: s + before.index! + 1 });
    }
    const deptBefore = t.slice(Math.max(0, s - 120), s).includes('担当課\n');
    if (!deptBefore && cands.length && cands.every(c => c.name === cands[0].name)) {
      p.department = cands[0].name;
      p.evidence.push(evidence(input, cands[0].raw, cands[0].at));
    }
    p.warnings.push('教育委員会の点検・評価結果報告書（令和７年度実績）の事務事業個票。評価年度は本文に明記がないため未設定。指標は施策単位の表で列が崩れており事業との対応が確定しないため未収録。事業費の記載はない。');
    out.push(p);
  });
  return mergeReprints(out, key);
}

// ---------------------------------------------------------------- 小矢部市（令和４年度 行政評価について：前期実施計画事業の評価結果一覧）
const OYABE_ID = '619d4642bcd2d74f67e3534e';
const OYABE_TITLE = '令和４年度 行政評価について';
const OYABE_DEPTS = ['農林課', '都市建設課', '上下水道課', '企画政策課', '生活環境課', '商工観光課', '定住支援課', '総務課', '財政課', '教育総務課', '文化スポーツ課', '健康福祉課', '社会福祉課', 'こども課'];
const OYABE_ROW = new RegExp(`(?<=\\n\\n)([^\\n○①-⑳]{3,}?)\\n\\n(${OYABE_DEPTS.join('|')})\\n\\n○\\n`, 'g');
function extractOyabe(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '16209' || input.sourceId !== OYABE_ID || !input.text.startsWith(OYABE_TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  // 外部評価・教育委員会関係の章より前の、基本目標ごとの評価結果表に限る（教育委員会関係の表は同じ14事業の再掲）。
  const end = t.indexOf('外部評価の結果\n小矢部市外部評価委員会');
  const body = t.slice(0, end < 0 ? t.length : end);
  for (const m of body.matchAll(OYABE_ROW)) {
    const name = m[1].trim();
    if (/^[\d\s]+$/.test(name) || /課$/.test(name)) continue;
    const off = m.index!, raw = m[0].slice(0, -1);
    const p = project(input, name, name, 2022, raw, off);
    p.department = m[2];
    p.evidence.push(evidence(input, OYABE_TITLE, 0));
    p.warnings.push('令和４年度行政評価（第７次総合計画 前期実施計画事業、令和５年度に実施予定の事業を対象）の結果一覧の事業。評価区分（大分類・中分類の○印）は抽出テキストで列位置が失われ区分を確定できないため未収録。事業名と担当課が隣接して並ぶ行のみ採用。');
    out.push(p);
  }
  return mergeReprints(out, key);
}

// ---------------------------------------------------------------- 東峰村（R６ まち・ひと・しごと創生総合戦略事業評価シート）
const TOHO_ID = '45f9ac9b9101cb348f888f18';
const TOHO_TITLE = 'R６ 東峰村まち・ひと・しごと創生総合戦略事業評価シート';
// 「具体的な事業」欄の事業名（抽出テキストで1か所にしか出ないもの。改行・番号で分断された名称はその原文のまま根拠にする）。
const TOHO_NAMES: { name: string; raw: string }[] = [
  { name: '防災プログラムの実施', raw: '防災プログラムの実施' },
  { name: '大学や企業との連携（包括連携協定等）', raw: '大学や企業との連携\n（包括連携協定等）' },
  { name: '東峰村応援団の環の拡大', raw: '東峰村応援団の環の拡大' },
  { name: '観光プロモーション事業', raw: '観光プロモーション\n事業' },
  { name: '起業支援補助金', raw: '\n起業支援補助金\n' },
  { name: '農林産物を活用した新たな商品開発', raw: '農林産物を活用した新たな\n商品開発' },
  { name: '持ち家制度・住み替え制度の構築', raw: '持ち家制度・住み替え制度\nの構築' },
  { name: '定住・移住促進住宅の整備', raw: '定住・移住促進住宅の\n整備' },
  { name: '子育て支援事業', raw: '\n子育て支援事業\n' },
  { name: '保育料・給食費の完全無償化', raw: '保育料・給食費の\n完全無償化' },
  { name: '保育施設の維持', raw: '\n保育施設の維持\n' },
  { name: 'ふるさと返礼品の充実とPR', raw: 'ふるさと返礼品の充実とPR' },
];
function extractToho(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40448' || input.sourceId !== TOHO_ID || !input.text.startsWith(TOHO_TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const target = '※R6年度事業について記\n入';
  if (!t.includes(target)) return [];
  const common = (p: ProjectEvaluation) => {
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, TOHO_TITLE, 0), evidence(input, target));
  };
  for (const n of TOHO_NAMES) {
    const at = t.indexOf(n.raw);
    if (at < 0 || t.indexOf(n.raw, at + 1) >= 0) continue;
    const raw = n.raw.replace(/^\n|\n$/g, ''), off = at + (n.raw.startsWith('\n') ? 1 : 0);
    const p = project(input, n.name, n.name, null, raw, off);
    common(p);
    p.warnings.push('総合戦略事業評価シート（R6年度事業）の「具体的な事業」。表の列が抽出テキストで分離しており、主管課・KPI・予算額・決算額・評価（本部評価・外部評価・最終評価）は事業との対応が確定しないため未収録。');
    out.push(p);
  }
  // No.14 は表の末尾で列が連続して残っており、予算額・決算額は備考欄の内訳（円）の合計と一致する。
  const head = '14\n\nⅢ\n\n⑦\n\n10）\n\n東峰学園と連携した\nキャリア教育等の実践\n\n教育課\n';
  const vals = '―\n\n100%\n\n91.08%\n（92人/101人）\n\n6,932,000\n\n5,869,634';
  const hAt = t.indexOf(head), vAt = t.indexOf(vals);
  const parts = ['予算額：4,950,000円、決算額4,950,000円', '予算額：1,216,000円、決算額：520,050円', '予算額：766,000円、決算額：399,584円', '予算額：0円、決算額：0円'];
  if (hAt >= 0 && vAt > hAt && parts.every(x => t.includes(x))) {
    const nameRaw = '東峰学園と連携した\nキャリア教育等の実践', nAt = hAt + head.indexOf(nameRaw);
    const p = project(input, '東峰学園と連携したキャリア教育等の実践', '東峰学園と連携したキャリア教育等の実践', null, nameRaw, nAt);
    common(p);
    p.department = '教育課';
    p.evidence.push(evidence(input, head.slice(0, -1), hAt), ...parts.map(x => evidence(input, x)));
    const off = vAt + vals.indexOf('6,932,000');
    p.amounts.push(amount(input, 'budget', 2024, '6,932,000', '円', '6,932,000', off));
    p.amounts.push(amount(input, 'actual', 2024, '5,869,634', '円', '5,869,634', vAt + vals.indexOf('5,869,634')));
    p.indicators.push({ name: '「夢に向かって努力する」と回答した児童・生徒の割合', fiscalYear: 2024, target: '100', actual: '91.08', unit: '%',
      evidence: evidence(input, '―\n\n100%\n\n91.08%\n（92人/101人）', vAt) });
    p.warnings.push('No.14の値は表の並び（基準値（R1年度）・目標値（R6年度）・実績・予算額・決算額）で読み、予算額・決算額（円）は備考欄の内訳（4,950,000＋1,216,000＋766,000＋0円、4,950,000＋520,050＋399,584＋0円）の合計と一致することを確認。KPI名は抽出テキストで事業内容と交互に分断されているため連結して記載。評価（本部評価・外部評価・最終評価）は列の対応が確定しないため未収録。');
    out.push(p);
  }
  return out;
}

const own = (fn: (i: CachedInput) => ProjectEvaluation[]) => (input: CachedInput, inputs: CachedInput[]) => municipalityRecords(input, inputs, fn, key);

export const entries: Record<string, Entry> = {
  '02411': { extract: own(extractRokkasho), scope: '六ヶ所村教育委員会の点検・評価報告書（令和５年度事業分）の主要な事業の個票から事業名・担当課・令和５年度決算額（千円）・評価（Ａ〜Ｃ）を構造化。個票の決算額・評価欄が本文と交互に崩れたものは金額・評価を入れない。教育委員会の活動状況・有識者意見・予算総括は対象外。' },
  '23203': { extract: own(extractIchinomiya), scope: '一宮市2025年度行政評価結果報告の施策評価シート「７．施策実現に向けて実施した事業」から、事業名と担当課が隣接して読める行の事業名・担当課・必要性（○／要検討）を構造化。決算（単位記載なし）・有効性・効率性（★、列崩れ）と施策評価（成果指標・体感指標）は対象外。' },
  '28201': { extract: own(extractHimeji), scope: '姫路市教育委員会の点検・評価結果報告書（令和７年度実績）の事務事業個票から事業番号・事業名・担当課（位置が一意なもののみ）を構造化。再掲個票は除外。施策単位の指標表（列崩れ）と教育委員会活動状況・学識経験者の所見は対象外。' },
  '16209': { extract: own(extractOyabe), scope: '小矢部市令和４年度行政評価の基本目標ごとの評価結果表から、事業名と担当課が隣接して読める前期実施計画事業の事業名・担当課を構造化。評価区分（○印の列）は列位置が失われるため対象外。外部評価の意見・教育委員会関係の再掲表は対象外。' },
  '40448': { extract: own(extractToho), scope: '東峰村R６まち・ひと・しごと創生総合戦略事業評価シートの「具体的な事業」の事業名を構造化し、列が連続して残るNo.14のみ主管課・KPI目標/実績・予算額/決算額（円、内訳合計で確認）を収録。他事業のKPI・金額・評価は列崩れのため対象外。' },
};
