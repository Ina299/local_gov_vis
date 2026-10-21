import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { type Extract, amount, eraYear, municipality, rating } from './h6-util';

/* ---------- 15222 上越市 事務事業評価の結果について（平成31年2月） ---------- */

const JOETSU_SECTIONS: [string, string][] = [['⑴ 廃止する事業', '廃止'], ['⑵ 一部廃止する事業', '一部廃止'], ['⑶ 見直しする事業', '見直し'], ['⑷ 拡充する事業', '拡充']];
const JOETSU_ROW = /\n\n(\d{1,3})\n\n((?:[^\n・]+\n)*?[^\n・]+)\n\n・/g;

/** 評価結果一覧の行のうち、番号の直後に事業名だけの行（折返し可）が続き、事業概要「・」が始まる行。 */
function joetsu(input: CachedInput): ProjectEvaluation[] {
  const text = input.text, base = text.indexOf('２ 評価結果一覧\n⑴ 廃止する事業');
  if (!text.startsWith('事務事業評価の結果について') || base < 0) return [];
  const sections = JOETSU_SECTIONS.map(([head, label]) => ({ head, label, at: text.indexOf(`\n${head}\n`, base) + 1 }));
  if (sections.some(s => s.at <= 0) || sections.some((s, i) => i && s.at < sections[i - 1].at)) return [];
  const rows = [...text.slice(base).matchAll(JOETSU_ROW)].map(m => ({ m, at: base + m.index! }));
  const out: ProjectEvaluation[] = [];
  let last = 0;
  rows.forEach(({ m, at }, i) => {
    const n = Number(m[1]);
    if (n <= last) return;
    last = n;
    const lines = m[2].split('\n');
    // 事業名の列は全角7〜8字で折り返す。担当課の行・空白を含む行（他列と連結）・語の切れ目で終わる途中行は列の混在とみなす。
    if (lines.some(l => /\s/.test(l) || /(課|室|局)$/.test(l) || /^\d+$/.test(l))) return;
    if (lines.slice(0, -1).some((l, k) => /(費|事業|事務|金)$/.test(l) && !/^[（(]/.test(lines[k + 1]))) return;
    const name = lines.join(''), nameAt = at + 2 + m[1].length + 2;
    const section = [...sections].reverse().find(s => s.at < at);
    if (!section) return;
    const end = Math.min(rows[i + 1]?.at ?? text.length, ...sections.map(s => s.at).filter(a => a > at));
    const block = text.slice(at, end);
    const own = /\n(廃止|一部廃止|見直し|拡充)\n\n・/.exec(block);
    if (own && own[1] !== section.label) return;
    const p = project(input, m[1], name, null, m[2], nameAt);
    p.projectCode = m[1];
    p.ratings.push(own ? rating(input, 'self', '評価結果（区分）', own[1], null, own[1], at + own.index + 1)
      : rating(input, 'self', '評価結果（区分）', section.label, null, section.head, section.at));
    p.warnings.push('上越市「事務事業評価の結果について」（平成31年2月）の評価結果一覧。第6次総合計画に基づき平成31〜34年度に実施予定の事務事業を評価したもので、評価年度・評価対象年度の明示がないため未設定。№を projectCode に記録。',
      '評価結果の区分は行内の区分欄（同じ節の区分と一致する場合）、欄が読めない行は節見出し（⑴廃止〜⑷拡充）から記録。事業名・事業概要・担当課の列が混在する行、語の切れ目で改行された事業名、「・」を含む事業名の行は対象外。担当課は列の対応が確定できないため未設定。');
    out.push(p);
  });
  return out;
}

/* ---------- 20430 大桑村 令和２年度事務事業評価（令和元年度事業） ---------- */

/** 資料２「評価事業一覧」の全200事業（番号＋事務事業名）。件数が本文の「全200事業」と一致する場合だけ。 */
function okuwa(input: CachedInput): ProjectEvaluation[] {
  const title = /^令和(\S+)年度事務事業評価（令和(\S+)年度事業）の結果について/.exec(input.text);
  const a = input.text.indexOf('資料２\n令和２年度【令和元年度事業に対する事務事業評価】評価事業一覧'), b = input.text.indexOf('資料3', a);
  if (!title || a < 0 || b < 0 || !input.text.includes('※全200事業')) return [];
  const rows = [...input.text.slice(a, b).matchAll(/^(\d+) (.+)$/gm)];
  if (rows.length !== 200) return [];
  return rows.map(r => {
    const p = project(input, r[2], r[2], eraYear('令和', title[1]), r[0], a + r.index!);
    p.projectCode = null; p.evaluatedFiscalYear = eraYear('令和', title[2]);
    p.evidence.push(evidence(input, title[0], 0));
    p.warnings.push('大桑村 令和２年度事務事業評価（令和元年度事業）の資料２「評価事業一覧」の行。番号は係ごとの通し番号のため projectCode には記録しない。',
      '係の列は抽出テキストで事業名との対応が確定できないため担当未設定。資料３（任意事務の一覧表）の成果指標・評価・今後の方向性は列の対応が確定できないため未構造化。');
    return p;
  });
}

/* ---------- 43215 天草市 市政だより 事務事業評価（外部評価・最終評価） ---------- */

const AMAKUSA_ROW = /\n\n([^\n]+(?:事業|大会|補助金|奨励金|交付金))\n\n(改善|縮小|拡充|廃止)\n\n(?:今後の市の方針\n\n)?(改善|縮小|拡充|廃止)\n\n/g;
const AMAKUSA_SCALE = '縮小：対象や事業量が減少するもの／拡充：対象や事業量が増大するもの／改善：事業内容・実施方法などの見直しを行うもの／廃止：成果が出ないなどの理由で、今後行わないもの／そのまま継続：今後もこれまで同様に行うもの';

function amakusa(input: CachedInput): ProjectEvaluation[] {
  if (!input.text.startsWith('行 財 政 改 革 事務事業評価を行いました') || !input.text.includes('外部評価 最終評価')) return [];
  return [...input.text.matchAll(AMAKUSA_ROW)].map(m => {
    const at = m.index! + 2, raw = m[0].slice(2).replace(/\n+$/, '');
    const p = project(input, m[1], m[1], null, raw, at);
    p.projectCode = null;
    p.ratings.push(rating(input, 'external', '外部評価', m[2], AMAKUSA_SCALE, raw, at), rating(input, 'self', '最終評価', m[3], AMAKUSA_SCALE, raw, at));
    p.warnings.push('天草市 市政だより（No.188）掲載の事務事業評価結果一覧（外部評価委員会が選定した20事業）。評価年度・評価対象年度の明示がないため未設定。',
      '一覧の列順は「外部評価 最終評価」。評価が「そのまま継続」の行と列が崩れた行は対象外。scale は本文の評価基準（区分の説明）を転記。');
    return p;
  });
}

/* ---------- 30427 北山村 電源立地地域対策交付金 事業評価個表（令和5年度） ---------- */

function kitayama(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, head = /Ⅱ．事業評価個表\n番号\n1\n\n措置名\n\n交付金事業の名称\n\n公共用施設に係る整備、維持\n(消防用軽積載車購入事業)\n/.exec(t);
  const start = /事業開始年度\n\n令和５年度 事業終了年度\n\n令和５年度/.exec(t);
  const cost = /交付金事業の総事業費等\n\n活動実績\n\n件\n\n1\n\n活動見込\n\n件\n\n1\n\n達成度\n\n%\n\n100\n\n令和５年度\n\n年度\n\n年度\n\n総事業費\n\n(6,985,000)\n/.exec(t);
  const dept = /交付金事業の評価課室\n\n(総務課)\n/.exec(t);
  if (!head || !start || !cost || !dept || !t.startsWith('別紙\nⅠ．事業評価総括表\n（単位：円）')) return [];
  const p = project(input, head[1], head[1], null, head[0].trimEnd(), head.index);
  p.projectCode = null; p.evaluatedFiscalYear = 2023; p.department = dept[1];
  p.evidence.push(evidence(input, start[0], start.index), evidence(input, dept[0].trimEnd(), dept.index));
  const costRaw = cost[0].slice(cost[0].indexOf('令和５年度')).trimEnd();
  p.amounts.push(amount(input, 'actual', 2023, cost[1], '円', costRaw, cost.index + cost[0].indexOf('令和５年度')));
  const ind = /成果指標\n(月１回以上の定期的な) 成果実績\n(作動訓練の実施)\n目標値\n（導入：令和５年度2月\n以降）\n達成度\n\n単位\n\n評価年度\n\n件\n\n1\n\n件\n\n1\n\n%\n\n100/.exec(t);
  if (ind) p.indicators.push({ name: `${ind[1]}${ind[2]}（成果指標）`, fiscalYear: null, target: '1', actual: '1', unit: '件', evidence: evidence(input, ind[0], ind.index) });
  p.warnings.push('北山村 電源立地地域対策交付金 事業評価報告書（令和5年度実施事業）の事業評価個表。事業開始・終了年度（令和５年度）を評価対象年度とし、評価実施年度は明示がないため未設定。総括表では事業名が「消防軽積載車購入事業」と表記。',
    '総事業費（交付金事業に要した経費）は単位円の令和５年度列を決算（実績）として記録。交付金充当額は未構造化。成果指標は成果実績・目標値がいずれも1件（達成度100%）で列の対応に依存しないため記録し、評価年度欄の年度は空欄のため未設定。');
  return [p];
}

export const entries: Record<string, { extract: Extract; scope: string }> = {
  '15222': { extract: municipality('15222', joetsu), scope: '上越市「事務事業評価の結果について」（平成31年2月）評価結果一覧のうち、事業名の列が他列と混在しない行の№・事業名・評価結果区分（廃止・一部廃止・見直し・拡充）。事業概要・担当課・評価内容の文章と評価の実施方法の説明は対象外。' },
  '20430': { extract: municipality('20430', okuwa), scope: '大桑村 令和２年度事務事業評価（令和元年度事業）資料２「評価事業一覧」の全200事業の事務事業名。係・事業種類・資料３の成果指標・評価記号・今後の方向性は列の対応が確定できないため対象外。' },
  '43215': { extract: municipality('43215', amakusa), scope: '天草市 市政だより掲載の事務事業評価結果一覧（外部評価20事業）のうち列が読める行の事業名・外部評価・最終評価。「そのまま継続」の行・今後の市の方針の文章・評価の流れの説明は対象外。' },
  '30427': { extract: municipality('30427', kitayama), scope: '北山村 電源立地地域対策交付金 事業評価個表（令和5年度・消防用軽積載車購入事業）の事業名・評価課室・総事業費・成果指標。交付金充当額・契約の概要・定性的評価の文章と、交付金一覧ページ（html）は対象外。' },
};
