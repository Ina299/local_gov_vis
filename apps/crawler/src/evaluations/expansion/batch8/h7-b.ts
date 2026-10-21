import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, dedupe } from '../batch7/g7-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const rating = (input: CachedInput, label: string, value: string, scale: string | null, raw: string, start: number): EvaluationRating =>
  ({ kind: 'self', label, value, scale, evidence: evidence(input, raw, start) });

/** ニセコ町 平成24年度 事業別点検評価調書（事業実績書）: one sheet per 事業コード. */
const NISEKO_POLICY_SCALE = 'A 拡大・発展 B 改善・変更 C 縮小・整理 D 縮小・廃止 E 完了 F その他';
function extractNiseko(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '0ed7bd4c6dd07083bef891b2') return [];
  const t = input.text;
  const heads = [...t.matchAll(/(?:(\d{6}-\d{2})\n+)?事業コード(?:\n+(\d{6}-\d{2}))?/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, end = heads[i + 1]?.index ?? t.length;
    const seg = t.slice(start, end), code = h[1] ?? h[2];
    if (!code) continue;
    const n = seg.match(/\n事業名 (\S+(?: \S+)*?)(?: 細事業名 (\S+(?: \S+)*?))? 事業期間 Ｈ\n|\n事業名 (\S+)\n細事業名(?: (\S+))?\n|\n事業名 (\S+) 細事業名(?: (\S+))?\n|\n事業名\n\n(\S+)\n\n- 事業期間 Ｈ\n\n細事業名\n\n24\n/);
    if (!n) continue;
    const main = n[1] ?? n[3] ?? n[5] ?? n[7], sub = n[2] ?? n[4] ?? n[6] ?? null;
    if (!main || /事業期間|細事業名/.test(main) || (sub && /事業期間/.test(sub))) continue;
    // The sheet's own period line is the only year statement; require the single-year form.
    const period = seg.match(/事業期間 Ｈ\n+24\n*\s*～\s*\n*24\n*\s*年度|24 ～ 24\n年度/);
    const name = sub ? `${main}（${sub}）` : main;
    const p = project(input, code, name, null, seg.slice(0, n.index! + n[0].length), start);
    const fy = period ? 2012 : null;
    p.evaluatedFiscalYear = fy;
    if (period) p.evidence.push(evidence(input, period[0], start + period.index!));
    const dept = seg.match(/担当課係名 (\S+課\S*係)/);
    if (dept) p.department = dept[1];
    const budget = seg.match(/当初予算額\n([\d,]+)\n/), actual = seg.match(/(?:決 算 額|決\n算\n額)\n([\d,]+)\n/);
    if (fy && budget && actual) {
      p.amounts.push(amount(input, 'budget', fy, budget[1], '千円', budget[0].trimEnd(), start + budget.index!));
      p.amounts.push(amount(input, 'actual', fy, actual[1], '千円', actual[0].trimEnd(), start + actual.index!));
    }
    const policy = seg.match(/今後の事業方針\n([Ａ-Ｆ])\n/);
    if (policy) p.ratings.push(rating(input, '今後の事業方針', policy[1], NISEKO_POLICY_SCALE, policy[0].trimEnd(), start + policy.index!));
    const ext = seg.match(/外部評価委員会評価\n\n評 価\n\n([Ａ-Ｅ])\n\n評 価 委 員 会 意 見/);
    if (ext) p.ratings.push({ ...rating(input, '外部評価委員会評価', ext[1], null, ext[0], start + ext.index!), kind: 'external' });
    p.warnings.push('ニセコ町 事業別点検評価調書（事業実績書）。評価年度は本文に表記がないため未設定。評価対象年度・金額年度は調書の「事業期間 Ｈ24～24年度」表記による。');
    p.warnings.push('金額（千円）は「当初予算額」「決算額」の直後に数値が並ぶ調書のみ収録。段組み崩れで値が離れた調書・財源内訳は未収録。今後の事業方針・外部評価委員会評価は記号が見出しに隣接する調書のみ収録。');
    out.push(p);
  }
  return dedupe(out, p => `${p.projectCode}`);
}

/** 更別村 令和6年度 点検・評価報告書（令和5年度対象）「事務・事業評価書」一覧のランク。 */
const SARABETSU_SCALE = 'Ａ＝最優先 － 最優先で施策として実施する（事務・事業） Ｂ＝上 位 － 効果は高くても継続要因の低いもの Ｃ＝中 位 － 効果は低くても継続要因の高いもの Ｄ＝下 位 － 廃止や統合など事務・事業の見直し対象';
function extractSarabetsu(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '1cb3470d2f655ed180dd2524') return [];
  const t = input.text;
  const title = t.match(/令 和 ６ 年 度\n\n更別村教育委員会の活動状況\nに関 する点 検 ・評 価 報 告 書\n（令和５年度対象）/);
  const sec = t.indexOf('（４）事務・事業ごとの評価\n〇 事務・事業評価書'), endSec = t.indexOf('９. 更別村教育委員会の活動状況に関する点検・評価等に対する指導・助言事項', sec);
  if (!title || sec < 0 || endSec < 0) return [];
  const body = t.slice(sec, endSec), social = body.indexOf('２）社会教育関係');
  const out: ProjectEvaluation[] = [];
  for (const m of body.matchAll(/\n([０-９]|[1-9]\d?)\n\n(\S+費)\n\n((?:[^\n]+\n){0,3}[^\n]+)\n\n([ＡＢＣＤ])\n\n(?=(?:[０-９]|\d{1,2})\n|- \d+ -\n)/g)) {
    const name = m[3].replaceAll('\n', '');
    if ((name.match(/事業/g) ?? []).length !== 1 || /^[０-９\d]+$|費$|ランク|事 業 名/.test(name) || m[3].split('\n').some(l => /費$/.test(l))) continue;
    const start = sec + m.index! + 1, raw = m[0].slice(1).trimEnd();
    const area = m.index! > social ? '社会教育関係' : '学校教育関係';
    const p = project(input, `${area}-${m[1]}`, name, 2024, raw, start);
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, title[0], title.index!));
    p.ratings.push(rating(input, 'ランク', m[4], SARABETSU_SCALE, raw, start));
    p.warnings.push(`教育委員会点検・評価報告書の事務・事業評価書一覧（${area}、予算科目「${m[2]}」）から事業名とランクを部分構造化。2列組みで番号・科目・事業名・ランクが連続しない行（列混在）は除外。一次評価・最終評価のどちらのランクかは表に明記がない。`);
    out.push(p);
  }
  return out;
}

/** 吉野川市 事務事業評価結果一覧（継続事業・新規拡大事業）。 */
function extractYoshinogawa(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  if (input.sourceId === 'f8a31eff134f5b629c719509') {
    const title = t.match(/令和６年度 事務事業評価（継続事業）結果一覧\n（令和7年度 継続事業）/);
    if (!title) return [];
    for (const m of t.matchAll(/\n(\d{1,3})\n\n([^\n]+)\n\n((?:[^\n]+\n)*?[^\n]+)\n\n([\d,]+|-)\n\n([ＡＢＣＤ])\n\n○\n\n((?:[^\n]+\n)*?[^\n]+)\n\n([ＡＢＣＤ])\n/g)) {
      if (m[3].includes('\n\n') || /^[\d,]+$|^-$/m.test(m[3])) continue;
      const start = m.index! + 1, raw = m[0].slice(1).trimEnd();
      const page = t.lastIndexOf('令和６年度 事務事業評価（継続事業）結果一覧', start);
      // A merged department cell can share the name line ("都市計画住宅課 市営住宅管理事業…").
      const p = project(input, `継続-${page}-${m[1]}`, m[2].replace(/^\S+課 /, ''), null, raw, start);
      p.projectCode = null;
      p.evaluatedFiscalYear = 2024;
      p.evidence.push(evidence(input, title[0], title.index!));
      p.activities = m[3];
      p.ratings.push(rating(input, '１次評価（担当課等評価）', m[5], null, raw, start));
      p.ratings.push(rating(input, '２次評価（部局内評価）', m[7], null, raw, start));
      p.warnings.push('継続事業の評価結果一覧から事業名・事業内容・１次評価・２次評価を部分構造化。評価対象年度は表題「令和６年度 事務事業評価」と「Ｒ6事業費」欄による。評価実施年度は表題の（令和7年度 継続事業）との関係が明記されていないため未設定。');
      p.warnings.push('「Ｒ6事業費(千円）」は予算・決算の別が表に明記されていないため金額は未収録。今後の方向性（○印）は列位置が抽出テキストで確定できないため未収録。部局名・課等名は結合セルで行番号と分離しているため未設定。');
      out.push(p);
    }
    return dedupe(out, p => `${p.projectName}`);
  }
  if (input.sourceId === '6575a0e0a713265cb847bf8f') {
    const heads = [...t.matchAll(/令和７年度 事務事業評価（新規拡大事業【(重点施策推進枠|その他事業枠)】）結果一覧/g)];
    for (const m of t.matchAll(/\n(\d{1,3})\n\n(\S+(?:部|局|委員会))\n\n(\S+)\n\n○\n\n([^\n]+)\n\n/g)) {
      const head = heads.filter(h => h.index! < m.index!).at(-1);
      if (!head) continue;
      const start = m.index! + 1, raw = m[0].slice(1).trimEnd();
      const p = project(input, `新規拡大-${head[1]}-${m[1]}`, m[4], 2025, raw, start);
      p.projectCode = null;
      p.department = `${m[2]} ${m[3]}`;
      p.evidence.push(evidence(input, head[0], head.index!));
      p.warnings.push(`令和７年度 新規拡大事業（${head[1]}）の事前評価結果一覧から事業名・部局名・担当課等名のみの部分レコード。部局内評価・最終評価の記号は抽出テキストで行から分離して集積しているため未収録。新規・拡大の区分（○の列）も未確定のため未設定。`);
      out.push(p);
    }
    return dedupe(out, p => `${p.department}/${p.projectName}`);
  }
  return [];
}

export const entries: Record<string, Entry> = {
  '01395': { extract: extractNiseko, scope: '平成24年度ニセコ町教育委員会 事業別点検評価調書（事業実績書）の事業コード・事業名（細事業名）・担当課係・当初予算額/決算額（数値が見出し直後にある調書のみ）・今後の事業方針・外部評価委員会評価。財源内訳・記述欄・点検評価の案内ページは対象外' },
  '01639': { extract: extractSarabetsu, scope: '令和6年度更別村教育委員会点検・評価報告書（令和5年度対象）の事務・事業評価書一覧のうち番号・予算科目・事業名・ランクが連続する行（事業名とランク）。総合計画に基づく施策評価・予算決算資料・活動状況・指導助言は対象外' },
  '36205': { extract: extractYoshinogawa, scope: '吉野川市 令和6年度事務事業評価（継続事業）結果一覧の事業名・事業内容・１次評価・２次評価と、令和7年度新規拡大事業評価結果一覧の事業名・部局・課（部分）。R6事業費（予算/決算の別が不明）・方向性の○印・新規拡大の評価記号・案内ページは対象外' },
};
