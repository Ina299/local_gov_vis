/** 10210 富岡市（行政評価結果報告書 令和3〜5年度の事務事業「今後の方向性」）と 11221 草加市（令和4年度ダイジェストシート）。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, type Entry, acrossInputs, toNum } from '../batch8/h3-util';

// ---------------------------------------------------------------- 富岡市
/**
 * 令和3〜5年度版は表が「事務事業名 → 今後の方向性 → 評価の理由 → 今後の対応」の行順で抽出されている。
 * 令和6〜8年度版は列の出現順が崩れ（事業名の後に別行の評価が続く等、要約一覧と食い違う例を確認）ため対象外。
 */
const TOMIOKA: Record<string, { evaluationYear: number; fiscalYear: number; title: string; fyText: string }> = {
  '50049593094e0648dcb37738': { evaluationYear: 2021, fiscalYear: 2020, title: '令和３年度\n行政評価結果報告書', fyText: '令和 2（2020）年度に実施した施策や事務事業' },
  'd12d2a80984d6b606c4d247c': { evaluationYear: 2022, fiscalYear: 2021, title: '令和４年度\n行政評価結果報告書', fyText: '令和３（202１）年度に実施した施策や事務事業' },
  'ce0ebb4460ce6ba4efc84e81': { evaluationYear: 2023, fiscalYear: 2022, title: '令和５年度\n行政評価結果報告書', fyText: '令和４（202２）年度に実施した施策や事務事業' },
};
const TOMIOKA_SCALE = '「維持・継続が適当」「事業の拡充が必要」「内容の見直し」「縮小・廃止」の４段階（一部の事業は「その他」）';
const T_RATING = '(?:維持・継続|要拡充|要見直し|縮小・廃止|その他)';
const T_NAME = '(?:[^\\n。、【】]{1,12}\\n){0,3}[^\\n。、【】]{0,12}(?:事業|繰出金|負担金|交付金)(?:（[^\\n）]{1,14}）)?';
const T_ROW = new RegExp(`\\n\\n(${T_NAME})\\n\\n(${T_RATING})\\n\\n([^\\n]+)`, 'g');

function extractTomioka(input: CachedInput): ProjectEvaluation[] {
  const cfg = TOMIOKA[input.sourceId], t = input.text;
  if (!cfg || !t.startsWith(cfg.title)) return [];
  const fyAt = t.indexOf(cfg.fyText);
  if (fyAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(T_ROW)) {
    const [, rawName, rating, next] = m, start = m.index! + 2;
    // 行の前後が評価列・事業名・ページ番号だと列の対応が崩れている可能性があるため採らない。
    const prev = t.slice(Math.max(0, m.index! - 60), m.index!).split('\n\n').at(-1)!.trim();
    if (new RegExp(`^${T_RATING}$`).test(prev) || new RegExp(`^${T_RATING}$`).test(next) || new RegExp(`^${T_NAME}$`).test(next) || /^\d+$/.test(next) || next.length < 8) continue;
    const name = rawName.replace(/\n/g, '');
    if (/^(?:令和|平成|・)|\d+事業$/.test(name)) continue;
    const raw = `${rawName}\n\n${rating}`;
    const p = project(input, `${cfg.evaluationYear}:${name}`, name, cfg.evaluationYear, raw, start);
    p.projectCode = null; p.evaluatedFiscalYear = cfg.fiscalYear;
    p.evidence.push(evidence(input, cfg.title, 0), evidence(input, cfg.fyText, fyAt));
    p.ratings.push({ kind: 'self', label: '今後の方向性', value: rating, scale: TOMIOKA_SCALE, evidence: evidence(input, raw, start) });
    p.warnings = [BASE_WARNING + '行政評価結果報告書の「該当する事務事業とその評価・今後の対応」表から、事務事業名の直後に今後の方向性、その後に評価の理由が続く行だけを採用。評価の前後が別の評価・事業名・ページ番号の行は列の対応が確定できないため除外。評価年度は報告書の年度、評価対象年度は本文「令和X（西暦）年度に実施した施策や事務事業」による。金額・指標は本報告書の表にないため未設定。'];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 草加市
const SOKA_ID = 'f6d4481d6deb21ec5676ffd8', SOKA_TITLE = '令和４年度\nダイジェストシート\n結果報告';
const SOKA_SCALE = '維持／拡大／見直し／縮小／廃止';
const SOKA_HEAD = /令和４年度ダイジェストシート\n施策名\n施策の柱\n事務事業名\n\n([^\n]+)\n\n所管課\n施策番号\n(\d+)\n\n([^\n]+)\n([^\n]+)\n([^\n]+)\n\n施策の柱番号/;
const DEPT = /(?:課|室|所|センター|館)$/;

function extractSoka(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (input.sourceId !== SOKA_ID || !t.startsWith(SOKA_TITLE)) return [];
  const toc = t.slice(0, t.indexOf('１ ダイジェストシートについて\n「事務事業」'));
  // 「ダイジェストシートの見方」の記入例は見出しの直後に「１」が入るため、この形の見出しから外れる。
  const heads = [...t.matchAll(/令和４年度ダイジェストシート\n施策名\n/g)].map(x => x.index!);
  const out: ProjectEvaluation[] = [];
  heads.forEach((at, i) => {
    const seg = t.slice(at, heads[i + 1] ?? t.length), hm = seg.match(SOKA_HEAD);
    if (!hm || hm.index !== 0) return;
    const [, dept, , policy, , name] = hm;
    // 施策名が目次の施策名と一致する（施策名・施策の柱・事業名が各1行で折り返していない）ものだけ。
    if (!toc.includes(`\n${policy}\n`) || !DEPT.test(dept) || name.length > 40) return;
    const rm = seg.match(/総合評価\n今後の方向性\n評価結果\n\n(維持|拡大|見直し|縮小|廃止)\n/);
    if (!rm) return;
    const nameAt = at + hm[0].indexOf(`\n${name}\n\n施策の柱番号`) + 1;
    const p = project(input, `2022:${name}`, name, 2022, name, nameAt);
    p.projectCode = null; p.department = dept; p.evaluatedFiscalYear = 2022;
    p.evidence.push(evidence(input, hm[0], at), evidence(input, SOKA_TITLE, 0));
    p.ratings.push({ kind: 'self', label: '総合評価（今後の方向性）', value: rm[1], scale: SOKA_SCALE, evidence: evidence(input, rm[0].trim(), at + rm.index!) });
    // ② 事業費の推移: 「金額 執行率%」が平成30〜令和4年度の順に5組、その直後が増減（H30→R4）。増減＝R4−H30で検算できる場合のみR4の決算（執行）額を採用。
    const a = seg.indexOf('② 事業費の推移'), b = seg.indexOf('③ 事業費の主な使途');
    if (a > 0 && b > a) {
      const block = seg.slice(a, b), pairs = [...block.matchAll(/([\d,]+)\s+(\d+\.\d)%/g)];
      if (pairs.length === 5) {
        const last = pairs[4], diff = block.slice(last.index! + last[0].length).match(/^\s+(-?[\d,]+)/);
        if (diff && toNum(last[1]) - toNum(pairs[0][1]) === toNum(diff[1])) {
          const raw = block.slice(last.index!, last.index! + last[0].length + diff[0].length);
          p.amounts.push({ kind: 'actual', fiscalYear: 2022, amountYen: toNum(last[1]) * 1000, rawValue: last[1], rawUnit: '千円', evidence: evidence(input, raw, at + a + last.index!) });
        }
      }
    }
    p.warnings = [BASE_WARNING + '令和4年度ダイジェストシートの施策名・事務事業名・所管課・総合評価（今後の方向性）。事業費は「② 事業費の推移」で「金額 執行率%」が5年度分そろい、直後の増減（H30→R4）が令和4年度額−平成30年度額と一致する場合のみ令和4年度の決算（執行）額として採用。人件費は年度の明示がないため、個別評価（○印）は列の対応が崩れているため構造化していません。評価年度はシート表題「令和４年度ダイジェストシート」による。本文は先頭120,000字で切れているため、それ以降のシートは未収録。'];
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '10210': {
    extract: acrossInputs(extractTomioka),
    scope: '行政評価結果報告書（令和3〜5年度版）の事務事業ごとの今後の方向性（4段階評価）を、事業名と評価が行順どおりに並ぶ行だけ構造化。施策評価・指標達成度・有識者意見、および列順が崩れている令和6〜8年度版は対象外。',
  },
  '11221': {
    extract: acrossInputs(extractSoka),
    scope: '令和4年度ダイジェストシート（事務事業評価）の事業名・所管課・総合評価と、検算できた令和4年度決算（執行）額を構造化。実施計画進捗管理（施策評価）・施策評価アンケート・令和6年度ダイジェスト一覧（列見出しなし）は対象外。',
  },
};
