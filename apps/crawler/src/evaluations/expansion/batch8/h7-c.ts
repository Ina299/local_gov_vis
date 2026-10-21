import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount } from '../batch7/g7-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 白馬村 平成25年度事務事業評価結果報告書（平成24年度実施分）。外部評価30事業の最終方針一覧＋個別調書。 */
const HAKUBA_REPORT = '4e311cfe5e7e9ca1bba35cf4';
const HAKUBA_SCALE = 'Ａ充実/Ｂ継続/Ｃ縮小/Ｄ統合/Ｅ基本的見直し/Ｆ完結事業';

function extractHakuba(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '20485' || input.sourceId !== HAKUBA_REPORT || input.truncated) return [];
  const t = input.text;
  if (!t.startsWith('平成２５年度\n白馬村事務事業評価\n評価結果報告書') || !t.includes('【平成２５年度（平成２４年度実施分）事務事業評価実施要領】')) return [];
  const listStart = t.indexOf('事務事業別今後の方向性'), listEnd = t.indexOf('平成２６年度の評価作業に向けて', listStart);
  if (listStart < 0 || listEnd < 0 || !t.slice(listStart, listEnd).includes(HAKUBA_SCALE)) return [];

  // 個別調書: 1頁目（経費欄を含む頁）の先頭から次の1頁目まで。
  const pages = [...t.matchAll(/平成2[45]年度 事務事業評価調書\n/g)].map(m => m.index!);
  const firstPages = pages.filter((p, i) => t.slice(p, pages[i + 1] ?? t.length).includes('２．事務事業に要する経費'));
  const sheets = firstPages.map((p, i) => ({ start: p, text: t.slice(p, firstPages[i + 1] ?? t.length) }));

  const out: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  const list = t.slice(listStart, listEnd);
  for (const m of list.matchAll(/^(\d+)\n\n(\S+)\n\n([A-F])$/gm)) {
    const [raw, , name, grade] = m, start = listStart + m.index!;
    if (seen.has(name)) continue;
    seen.add(name);
    const p = project(input, name, name, 2013, raw, start);
    p.evaluatedFiscalYear = 2012;
    p.ratings.push({ kind: 'external', label: '事務事業評価委員会 最終方針', value: grade, scale: HAKUBA_SCALE, evidence: evidence(input, raw, start) });
    p.warnings.push('平成25年度（平成24年度実施分）事務事業評価の外部評価対象30事業の最終方針一覧から抽出。評価外（農業総務事業「-」）は除外。内部評価（担当課・庁内評価委員会）の評点は列が崩れているため未収録。');

    const hits = sheets.filter(s => {
      const first = s.text.slice(0, s.text.indexOf('３．成果の自己検証'));
      return first.includes(name);
    });
    if (hits.length === 1) {
      const s = hits[0], head = s.text.slice(0, s.text.indexOf('３．成果の自己検証'));
      const fin = [...s.text.matchAll(/今後の方向性\n最終方針\n\n(?:充実|継続|縮小|統合|基本的見直し|完結事業)\n\n([A-F])/g)].at(-1);
      if (fin && fin[1] !== grade) continue; // 一覧と個別調書の最終方針が食い違う事業は除外
      const dept = /担 当 課 等 名(?:\n\n| )(\S+)\n/.exec(head);
      if (dept) {
        p.department = dept[1];
        p.evidence.push(evidence(input, dept[0].trimEnd(), s.start + dept.index!));
      }
      if (fin) p.evidence.push(evidence(input, fin[0], s.start + fin.index!));
      const cost = /H 23 年度\n決 算 額\n\nC ○\n([\d,]+)\n\n（単位：千円）\nH 24 年度\n決 算 額\nD\n([\d,]+)\n/.exec(head);
      if (cost) {
        const at = s.start + cost.index!, rawCost = cost[0].trimEnd();
        if (cost[1] !== '0') p.amounts.push(amount(input, 'actual', 2011, cost[1], '千円', rawCost, at));
        if (cost[2] !== '0') p.amounts.push(amount(input, 'actual', 2012, cost[2], '千円', rawCost, at));
        p.warnings.push('個別調書「２．事務事業に要する経費」の総事業費A行（H23・H24決算額、千円）を収録。0表記は収録していない。');
      } else {
        p.warnings.push('個別調書の経費欄が「H23/H24決算額」の見出しで読めない（H24/H25表記の調書等）ため金額は未収録。');
      }
    } else {
      p.warnings.push('一覧の事業名と一致する個別調書を一意に特定できないため、所管課・金額は未収録。');
    }
    out.push(p);
  }
  return out;
}

/** 西和賀町 地域公共交通確保維持改善事業・事業評価（地域内フィーダー系統確保維持費国庫補助金）。 */
const NISHIWAGA_EVAL = '47e6d9345c758f5c7ae0bc52';

function extractNishiwaga(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03366' || input.sourceId !== NISHIWAGA_EVAL || input.truncated) return [];
  const t = input.text;
  const head = /地域公共交通確保維持改善事業・事業評価（生活交通確保維持改善計画に基づく事業）\n(令和([０-９\d]+|元)年([０-９\d]+)月([０-９\d]+)日)\n\n協議会名：西和賀町地域公共交通活性化協議会\n評価対象事業名：(地域内フィーダー系統確保維持費国庫補助金)\n/.exec(t);
  if (!head) return [];
  const name = head[5];
  const p = project(input, name, name, null, head[0].trimEnd(), head.index!);
  p.department = null;
  const routes = ['沢内線', '湯田おでかけバス', '沢内おでかけバス'];
  for (const route of routes) {
    const target = new RegExp(`・${route}\\s+年間利用者数 ([\\d,]+)人以上`).exec(t);
    const actual = new RegExp(`・${route} ([\\d,]+)人（達成率([\\d.]+)％）`).exec(t);
    if (!target || !actual) continue;
    const sheet = new RegExp(`【目標値】\\n年間${target[1]}人以上\\n【実績値】\\n年間${actual[1]}人\\n【達成率】\\n${actual[2]}％`).exec(t);
    if (!sheet) continue; // 概要表と評価表の数値が一致しない系統は入れない
    p.indicators.push({ name: `${route} 年間利用者数`, fiscalYear: null, target: `${target[1]}人以上`, actual: `${actual[1]}人`, unit: '人', evidence: evidence(input, sheet[0], sheet.index!) });
    p.evidence.push(evidence(input, actual[0], actual.index!));
  }
  if (!p.indicators.length) return [];
  const crit = t.indexOf('※評価の判定基準\n・A ⇒ 目標達成100%以上');
  if (crit >= 0) p.evidence.push(evidence(input, '※評価の判定基準\n・A ⇒ 目標達成100%以上', crit));
  p.warnings.push(`地域公共交通活性化協議会による国庫補助事業の事業評価（${head[1]}付）。評価年度・評価対象年度の表記がないため年度は未設定（実績値の対象期間も明示なし）。`);
  p.warnings.push('系統別の目標値・実績値は概要表と評価表の両方で一致したもののみ収録。系統別の評価記号（A/C）は表の列が崩れているため未収録。事業費の記載なし。');
  return [p];
}

export const entries: Record<string, Entry> = {
  '20485': { extract: extractHakuba, scope: '平成25年度白馬村事務事業評価結果報告書（平成24年度実施分）の外部評価対象事業の最終方針一覧（事業名・最終方針A〜F）と、一意に対応する個別調書の担当課・総事業費（H23/H24決算額）。内部評価の評点・付記意見・案内ページは対象外' },
  '03366': { extract: extractNishiwaga, scope: '地域公共交通確保維持改善事業・事業評価（地域内フィーダー系統確保維持費国庫補助金）1件の系統別年間利用者数（目標値・実績値）。系統別評価記号・計画書本文・路線図・案内ページは対象外' },
};
