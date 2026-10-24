import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, nfkc, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- あきる野市（教育委員会 点検及び評価報告書の事務事業シート）
// 1シート = 事業名／主管課／【N年度取組内容（目標）】／評価（H29〜の年度別 A〜E）／取組状況／課題／方向性（Ⅰ〜Ⅳ）。
const DOCS: Record<string, { evaluationYear: number; fy: number; anchor: string; ratingColumns: number | null }> = {
  // 令和元年度報告書（平成30年度分）: 評価欄は H29・H30 の2値
  '8f814a8d471caec48b2d0552': { evaluationYear: 2019, fy: 2018, anchor: '【３０年度取組', ratingColumns: 2 },
  // 令和2年度報告書（令和元年度分）: 評価欄は H29・H30・R1 の3値
  '922847d1c1c61bfa99bf4687': { evaluationYear: 2020, fy: 2019, anchor: '【元年度取組', ratingColumns: 3 },
  // 令和4年度報告書（令和3年度分）: 評価欄の5値は抽出テキスト上の並びが年度順と一致しない（令和元年度報告書の値と照合して不一致）ため評価は収録しない
  'e70ec7e57fc550bea40f553c': { evaluationYear: 2022, fy: 2021, anchor: '【３年度取組', ratingColumns: null },
};
const TITLE: Record<string, RegExp> = {
  '8f814a8d471caec48b2d0552': /令和元年度\nあきる野市教育委員会の権限に属する事務の管理\n及び執行の状況の点検及び評価（平成３０年度分）/,
  '922847d1c1c61bfa99bf4687': /令和２年度\nあきる野市教育委員会の権限に属する事務の管理\n及び執行の状況の点検及び評価（令和元年度分）/,
  'e70ec7e57fc550bea40f553c': /令和４年度\nあきる野市教育委員会の権限に属する事務の管理\n及び執行の状況の点検及び評価（令和３年度分）/,
};
const RATING_SCALE = 'A:計画以上にできた B:計画どおりできた C:概ね計画どおりできた D:一部できなかった E:できなかった';
const DIRECTION_SCALE = 'Ⅰ:事業の計画を変更（前倒し又は拡充）して実施 Ⅱ:事業を計画どおり実施 Ⅲ:事業の計画を見直（改善又は縮小）して実施 Ⅳ:事業を廃止';
const DEPT = /^(?:指導室|教育総務課|学校教育課|生涯学習推進課|スポーツ推進課|図書館|教育相談所|郷土芸能伝承館|文化財課|社会教育課|青少年課)$/;
const SHEET_END = '変更\n内容';
/** 様式の欄見出し・前シートからはみ出した方向性の値（事業名候補から除く） */
const LABEL = /^(?:主管課|評価|取組状況|課|題|課 題|方向性|変更|内容|[ⅠⅡⅢⅣ－-])$/;

interface Line { s: string; start: number }
function lines(text: string, offset: number): Line[] {
  return [...text.matchAll(/[^\n]+/g)].map(m => ({ s: m[0], start: offset + m.index! }));
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  const doc = DOCS[input.sourceId];
  if (input.municipalityCode !== '13228' || !doc) return [];
  const title = TITLE[input.sourceId].exec(input.text.slice(0, 500));
  if (!title) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const anchors = [...t.matchAll(new RegExp(doc.anchor, 'g'))].map(m => m.index!);
  let prevEnd = t.indexOf('○ 事務事業の点検及び評価'); // 本文（事務事業の点検及び評価）の開始以降のみ
  for (const a of anchors) {
    const end = t.indexOf(SHEET_END, a);
    if (end < 0 || prevEnd < 0 || prevEnd > a) { prevEnd = end < 0 ? -1 : end + SHEET_END.length; continue; }
    let preStart = prevEnd;
    const section = t.lastIndexOf('○ 事務事業の点検及び評価', a);
    if (section >= preStart) preStart = section + '○ 事務事業の点検及び評価'.length;
    const sheetStart = preStart, sheetEnd = end + SHEET_END.length;
    prevEnd = sheetEnd;
    // 1シート分であることの確認: 取組見出し・評価年度欄（Ｈ２９）・方向性の凡例がそれぞれ1回だけ現れる
    const sheetText = t.slice(sheetStart, sheetEnd), count = (s: string) => sheetText.split(s).length - 1;
    if (count(doc.anchor) !== 1 || count('Ｈ２９') !== 1 || count('Ⅰ：事業の計画を変更') !== 1) continue;
    // 事業名: 前置き部分の最初の箇条書き（・）より前で、番号・「主管課」・課名以外の行がちょうど1行のもの
    const pre = lines(t.slice(preStart, a), preStart);
    const firstBullet = pre.findIndex(l => l.s.startsWith('・'));
    const head = (firstBullet < 0 ? pre : pre.slice(0, firstBullet)).filter(l => {
      const s = l.s.trim();
      return s && !/^\d+$/.test(s) && !LABEL.test(s) && !DEPT.test(s) && !/^(?:指導室|教育総務課) ・$/.test(s);
    });
    if (head.length !== 1) continue;
    const nameLine = head[0];
    const name = nameLine.s.trim().replace(/\s*※/g, '');
    if (name.length < 3 || /[。、]$/.test(name) || /^[【（(]/.test(name)) continue;
    // 主管課: シート内（評価欄より前）の「主管課」以外の課名行
    const sheetLines = lines(t.slice(sheetStart, sheetEnd), sheetStart);
    const yearAt = sheetLines.findIndex(l => l.s.startsWith('Ｈ２９'));
    if (yearAt < 0) continue;
    const deptLines = sheetLines.slice(0, yearAt + 12).filter(l => DEPT.test(l.s.trim()));
    const multi = sheetLines.slice(0, yearAt + 12).find(l => /^指導室 ・$/.test(l.s.trim()));
    let dept: string | null = null, deptEv: Line | null = null;
    if (multi) {
      const next = sheetLines[sheetLines.indexOf(multi) + 1];
      if (next && DEPT.test(next.s.trim())) { dept = `指導室・${next.s.trim()}`; deptEv = { s: t.slice(multi.start, next.start + next.s.length), start: multi.start }; }
    } else if (new Set(deptLines.map(l => l.s.trim())).size === 1) { dept = deptLines[0].s.trim(); deptEv = deptLines[0]; }
    const p = project(input, nfkc(name), name, doc.evaluationYear, nameLine.s, nameLine.start);
    p.evaluatedFiscalYear = doc.fy;
    p.department = dept;
    p.evidence.push(evidence(input, title[0], title.index));
    if (deptEv) p.evidence.push(evidence(input, deptEv.s, deptEv.start));
    // 取組内容（目標）: 【…取組\n内容（目標）】の見出し
    p.evidence.push(evidence(input, doc.anchor, a));
    // 評価（年度別 A〜E）: 「Ｈ２９」以降、最初の文章行までに単独で並ぶ記号。個数が年度数と一致し、最後の値を評価対象年度の評価とする。
    if (doc.ratingColumns) {
      const after = sheetLines.slice(yearAt);
      const stop = after.findIndex((l, i) => i > 0 && l.s.trim().length >= 15 && !/^[A-EＡ-Ｅ]：|概ね計画どおりできた|一部できなかった|E：できなかった|^Ｈ２９/.test(l.s.trim()));
      const region = stop < 0 ? [] : after.slice(0, stop);
      const vals = region.filter(l => /^[ＡＢＣＤＥABCDE－-]$/.test(l.s.trim()));
      if (vals.length === doc.ratingColumns) {
        const last = vals[vals.length - 1];
        const raw = t.slice(region[0].start, last.start + last.s.length);
        p.ratings.push({ kind: 'self', label: `評価（${doc.fy === 2018 ? 'Ｈ３０' : 'Ｒ１'}）`, value: last.s.trim(), scale: RATING_SCALE, evidence: evidence(input, raw, region[0].start) });
      } else p.warnings.push('評価欄の記号の個数が年度数と一致しないため、評価記号は収録していません。');
    }
    // 方向性: 評価欄以降で単独行の Ⅰ〜Ⅳ がちょうど1つ
    const dirs = sheetLines.slice(yearAt).filter(l => /^[ⅠⅡⅢⅣ]$/.test(l.s.trim())); // 評価欄より後（前シートのはみ出しを除く）
    if (dirs.length === 1) p.ratings.push({ kind: 'self', label: '方向性', value: dirs[0].s.trim(), scale: DIRECTION_SCALE, evidence: evidence(input, dirs[0].s, dirs[0].start) });
    p.warnings.push(`教育委員会の点検及び評価報告書（${title[0].split('\n')[0]}・${doc.fy === 2018 ? '平成３０年度' : doc.fy === 2019 ? '令和元年度' : '令和３年度'}分）の事務事業シート。評価年度は報告書の年度、評価対象年度は「（…年度分）」の表記による。`
      + (doc.ratingColumns ? `評価欄は H29 からの年度別の記号が年度順に並ぶ前提で、記号数が${doc.ratingColumns}個のときのみ最後の値を評価対象年度の評価として収録（前年度報告書の同一事業の値と照合済み）。` : '評価欄（H29〜R3の5年度分）は抽出テキスト上の並び順が年度順と一致しないため収録せず、方向性のみ収録。')
      + '金額・指標の記載はない様式。事業番号は位置が一定しないため事業名を識別子に使用。');
    out.push(p);
  }
  return mergeReprints(out, p => `${p.projectName}|${p.evaluatedFiscalYear}`);
}

export const akirunoEntries: Record<string, Entry> = {
  '13228': { extract: extractOne, scope: 'あきる野市教育委員会の点検及び評価報告書（平成30年度分・令和元年度分・令和3年度分）の事務事業シートの事業名・主管課・評価対象年度の評価記号（A〜E、平成30年度分・令和元年度分のみ）・今後の方向性（Ⅰ〜Ⅳ）。基本施策（中期ビジョン）評価、コロナ禍対応の一覧、有識者意見、取組状況・課題の文章、令和3年度分の評価記号（年度列の並びが崩れる）は対象外。' },
};
