import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';
import { municipality } from './m2-util';

// ---------------------------------------------------------------- 小松島市 議会評価意見書（1事業1枚）
const KOMATSUSHIMA = [
  /^議会評価意見書([①-⑳])\n事\n\n業\n\n名\n\n議 会 評 価\n\n([^\n]+)\n\n([^\n]+)\n\n【評価説明】\n/,
  /^議会評価意見書([①-⑳])\n名\n\n([^\n]+)\n\n議 会 評 価\n\n([^\n]+)\n\n事\n\n業\n\n【評価説明】\n/,
];
export function komatsushimaOpinion(input: CachedInput): ProjectEvaluation[] {
  const m = KOMATSUSHIMA.map(re => re.exec(input.text)).find(x => x);
  if (!m || !/継続$|廃止|休止|縮小|拡充/.test(m[3]) || !/事業$/.test(m[2])) return [];
  const p = project(input, `議会評価意見書${m[1]}`, m[2].trim(), null, m[0].slice(0, -1), 0);
  p.projectCode = null;
  p.ratings.push({ kind: 'external', label: '議会評価', value: m[3].trim(), scale: null, evidence: evidence(input, m[0].slice(0, -1), 0) });
  p.warnings.push('小松島市議会の議会評価意見書（1事業1枚）。評価は議会による外部評価で、原文の区分のまま収録。評価年度・対象年度は意見書本文に明記がないため未設定。評価説明（文章）は未収録。');
  return [p];
}

// ---------------------------------------------------------------- 琴浦町 令和元年度 事業レビュー（町民評価員による外部評価）
const KOTOURA_DAY2 = '令和元年度 琴浦町事業レビュー（２日目） 評価結果及び意見一覧\n';
const KOTOURA_DAY1 = /^実 施 日\n事業番号\n\n令和 元 年 ９月 ２３日（月）秋分の日\n(１)\n\n事業名称\n\n評価区分\n（１）不要凍結\n（２）見直し\n（２）−１ 抜本的見直し\n\n([^\n]+)\n\n町民評価員\n/;
export function kotouraReview(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, out: ProjectEvaluation[] = [];
  const note = '令和元年度 琴浦町事業レビュー（町民評価員・審議員による外部評価）の対象事業名のみ。評価年度は表題「令和元年度」による。区分別の票数は抽出テキストで区分欄と数値の対応が確定しないため、評価に添えられた意見は文章のため未収録。';
  if (t.startsWith(KOTOURA_DAY2)) {
    for (const m of t.matchAll(/\n([⑤-⑨]) ([^\n]+)\n評 価\n/g)) {
      const p = project(input, `R1-${m[1]}`, m[2].trim(), 2019, m[0].slice(1, -1), m.index! + 1);
      p.evidence.push(evidence(input, KOTOURA_DAY2.slice(0, -1), 0));
      p.warnings.push(note);
      out.push(p);
    }
  }
  const d1 = KOTOURA_DAY1.exec(t);
  if (d1) {
    const p = project(input, 'R1-①', d1[2].trim(), 2019, d1[0].slice(0, -1), 0);
    p.warnings.push(note);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 洋野町 復興交付金事業計画の個別事業の実績に関する評価様式（町事業分）
const HIRONO = '【復興交付金事業計画の個別事業の実績に関する評価様式】\n';
export function hironoSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  // 県が事業主体の個別事業（ken）は別資料で、事業名欄の様式も異なるため対象外。
  if (!t.startsWith(HIRONO) || !t.startsWith(`${HIRONO}事業番号 C－2－1\n事 業 名 水産物加工開発複合施設整備事業\n`)) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/\n事業番号 (\S+)\n事 業 名 ([^\n]+)\n/g)) {
    const sheetAt = t.lastIndexOf(HIRONO, m.index!);
    if (sheetAt < 0 || m.index! - sheetAt !== HIRONO.length - 1) continue;
    const p = project(input, m[1], m[2].trim(), null, m[0].slice(1, -1), m.index! + 1);
    p.evidence.push(evidence(input, HIRONO.slice(0, -1), sheetAt));
    p.warnings.push('洋野町 復興交付金事業計画の個別事業の実績に関する評価様式（1事業1様式）の事業番号・事業名のみ。交付金事業の事後評価であり事務事業評価ではない。事業費は事業期間（複数年度）の総額で年度が確定しないため、評価年度は本文に明記がないため未収録。目標・実績の表と評価の文章は未収録。');
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 東金市 第２期総合戦略 総合戦略事業に係る令和６年度の実績（実施計画・令和6年度実績報告からの引用）
const TOGANE = '資料－２の参考資料②\n\n東金市第２期まち・ひと・しごと創生総合戦略\n\n《 総合戦略事業に係る令和６年度の実績 》\n';
export function toganeSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(TOGANE)) return [];
  const heads = [...t.matchAll(/\n(\d+)\n\n事 業 名\n\n([^\n]+)\n/g)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const s = h.index!, body = t.slice(s, heads[k + 1]?.index ?? t.length), name = h[2].trim();
    // 再掲は原掲と値が異なる例があるため除外。1見出しに複数事業の表が続く票（決算額・円額・評価が1つに定まらない）も除外。
    const yen = [...body.matchAll(/\n([\d,]+) 円\n/g)], rating = [...body.matchAll(/\n([１２])\n\n○「評価１」/g)];
    if (name.startsWith('【再掲】') || body.split('\n決算額\n').length !== 2 || yen.length !== 1 || rating.length !== 1) return;
    const p = project(input, `R6:${h[1]}:${name}`, name, null, h[0].slice(1, -1), s + 1);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, TOGANE.trim(), 0), evidence(input, '決算額', s + body.indexOf('\n決算額\n') + 1));
    p.amounts.push(amount(input, 'actual', 2024, yen[0][1], '円', yen[0][0].slice(1, -1), s + yen[0].index! + 1));
    p.ratings.push({ kind: 'self', label: '事業評価', value: rating[0][1], scale: '「評価１」計画どおりの実績に至ったもの／「評価２」計画どおりの実績に至らなかったもの', evidence: evidence(input, rating[0][0].slice(1), s + rating[0].index! + 1) });
    p.warnings.push('東金市第２期総合戦略の総合戦略事業に係る令和６年度の実績（第４次総合計画 実施計画・令和6年度実績報告からの引用）の事業シート。評価対象年度は表題「令和６年度の実績」による。決算額は票内で唯一の「円」額のみ、事業評価（１／２）は票内で1つに定まるもののみ収録。目標指標は実績値・目標値の列の対応が抽出テキストで確定しないため、担当課は欄の位置が確定しないため未収録。');
    out.push(p);
  });
  return out;
}

// ---------------------------------------------------------------- 日光市 物価高騰対応重点支援地方創生臨時交付金事業における評価検証結果概要（R5・R6）
const NIKKO = /^物価高騰対応重点支援地方創生臨時交付金事業における評価検証結果概要（(R[56])）\n/;
export function nikkoSummary(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, title = NIKKO.exec(t);
  if (!title) return [];
  const out: ProjectEvaluation[] = [];
  // 事業名欄: 「NO」の数字行と実施期間（R…月～R…月）の間の行。セル内の折返しは改行を除いて連結する（折返し以外の文字は加えない）。
  for (const m of t.matchAll(/\n(\d)\n\n((?:[^\n]+\n){1,5})\n(R[\d０-９５６７]+\.[\d０-９．.]+月\n～\nR[\d０-９]+\.[\d０-９．.]+月)\n/g)) {
    const name = m[2].split('\n').filter(Boolean).join('');
    if (!/(事業|補助金|交付事業|給付金)(【[^】]+】)?$/.test(name)) continue;
    const p = project(input, `${title[1]}-${m[1]}`, name, null, `${m[1]}\n\n${m[2].slice(0, -1)}`, m.index! + 1);
    p.evidence.push(evidence(input, title[0].slice(0, -1), 0), evidence(input, m[3], m.index! + m[0].indexOf(m[3])));
    p.warnings.push(`日光市 物価高騰対応重点支援地方創生臨時交付金事業の評価検証結果概要（${title[1]}）の事業名のみ（事業名欄の折返しを連結）。交付金の効果検証であり事務事業評価ではない。事業期間が年度をまたぐため評価年度・対象年度は未設定。総事業費は見込み額のため、全体評価（①〜⑤）は表の列と行の対応が抽出テキストで確定しないため未収録。`);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 国頭村 特定防衛施設周辺整備調整交付金等の補助事業 事業評価書（沖縄防衛局公表分のうち補助事業者が国頭村長の票）
const KUNIGAMI = [/\n名\n\n([^\n]+)\n\n者\n\n名\n\n国頭村長\n/g, /\n名 ([^\n]+)\n\n者\n\n名 国頭村長\n/g, /\n補 助 事 業 名 ([^\n]+)\n補 助 事 業 者 名 国頭村長\n/g];
export function kunigamiSheets(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!input.sourceUrl.startsWith('https://www.mod.go.jp/rdb/okinawa/effort/plan/evaluation/images/')) return [];
  const out: ProjectEvaluation[] = [];
  for (const re of KUNIGAMI) for (const m of t.matchAll(re)) {
    const p = project(input, m[1].trim(), m[1].trim(), null, m[0].slice(1, -1), m.index! + 1);
    p.projectCode = null;
    // 補助事業の始期及び終期が単年度（「令和N年度」の1行のみで「から」「繰越」を伴わない）の票だけ、その年度を評価対象年度とする。
    const next = t.indexOf('\n', m.index! + m[0].length + 1), after = t.slice(m.index! + m[0].length, Math.max(next, m.index! + m[0].length + 2000));
    const period = /始期及び終期\n\n((?:令和|平成)(?:[\d０-９]+|元)年度)\n\n(?!から|（繰越）)(?:[\d０-９]+名\n\n)?(?!から)/.exec(after);
    const nextSheet = KUNIGAMI.map(r => new RegExp(r.source).exec(after)?.index ?? Infinity).reduce((a, b) => Math.min(a, b), Infinity);
    if (period && period.index < nextSheet) {
      const fy = /^(平成|令和)([\d０-９]+|元)年度$/.exec(period[1].normalize('NFKC'));
      if (fy) {
        p.evaluatedFiscalYear = (fy[1] === '平成' ? 1988 : 2018) + (fy[2] === '元' ? 1 : Number(fy[2]));
        p.evidence.push(evidence(input, `始期及び終期\n\n${period[1]}`, m.index! + m[0].length + period.index));
      }
    }
    p.warnings.push('沖縄防衛局が公表する補助事業の事業評価書のうち、補助事業者名が「国頭村長」の票の補助事業名（交付金事業の事後評価であり事務事業評価ではない）。評価対象年度は補助事業の始期及び終期が単年度の票のみその年度を設定し、複数年度にわたる票は未設定。評価年度は本文に明記がないため未設定。事業費・交付金額の表は列の対応が抽出テキストで確定しないため、成果及び評価の文章は未収録。');
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 西伊豆町 デジタル田園都市国家構想交付金事業の達成状況（令和5・6年度）
const NISHIIZU = 'デジタル田園都市国家構想交付金事業\n町では、国の';
export function nishiizuGrant(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(NISHIIZU)) return [];
  const out: ProjectEvaluation[] = [];
  // 事業の見出し行（空行の後の1行）→ 事業概要 → 「●…」→「◎令和N年度（実績）」→「N 千円」の並びが見出しごとに1回だけのもの。
  for (const m of t.matchAll(/\n\n((?:[①②③] )?[^\n（]+事業(?:（広域連携）)?)\n((?:[^\n]+\n){1,8})\n●[^\n]+\n(◎令和([\d０-９]+)年度（実績）\n([\d０-９,，]+) ?千円)\n/g)) {
    const fy = 2018 + Number(m[4].normalize('NFKC'));
    const name = m[1].replace(/^[①②③] /, '').trim();
    const p = project(input, `${fy}:${name}`, name, null, m[1], m.index! + 2);
    p.projectCode = null;
    p.evaluatedFiscalYear = fy;
    const at = m.index! + m[0].indexOf(m[3]);
    p.amounts.push(amount(input, 'actual', fy, m[5], '千円', m[3], at));
    p.evidence.push(evidence(input, NISHIIZU.split('\n')[0], 0));
    p.warnings.push('西伊豆町 デジタル田園都市国家構想交付金事業の実施状況（交付金の効果検証であり事務事業評価ではない）。評価対象年度・金額は「◎令和N年度（実績）」欄の千円額（交付金事業の実績額。事業費・交付金充当額の別は本文で区別されない）。KPIの目標値・実績値は表の列が抽出テキストで分離しているため、外部有識者の採点表は年度・項目の対応が確定しないため未収録。');
    out.push(p);
  }
  return out;
}

export const smallEntries: Record<string, Entry> = {
  '22306': {
    extract: municipality(nishiizuGrant, p => `${p.evaluatedFiscalYear}:${p.projectName}`),
    scope: '西伊豆町 デジタル田園都市国家構想交付金事業の実施状況（令和5・6年度）の交付金事業名と「令和N年度（実績）」の千円額。KPI表・外部委員の採点表・事業経費内訳報告書は対象外。',
  },
  '47301': {
    // 年度が定まらない票は資料ごとに別キーとし、同名が複数資料にあれば相互衝突として除外する（各年の評価書の再掲を1件にまとめない）。
    extract: municipality(kunigamiSheets, p => `${p.evaluatedFiscalYear ?? p.evidence[0].sourceUrl}:${p.projectName}`),
    scope: '国頭村 補助事業の事業評価書（沖縄防衛局公表、補助事業者名が国頭村長の票のみ）の補助事業名と、単年度事業の評価対象年度。事業費・交付金額・成果と評価の文章、他市町村の票は対象外。年度で区別できない同名の複数年度事業（各年の再掲）は除外。',
  },
  '09206': {
    extract: municipality(nikkoSummary, p => p.projectCode ?? p.projectName),
    scope: '日光市 物価高騰対応重点支援地方創生臨時交付金事業の評価検証結果概要（R5・R6）の交付金事業名のみ（交付金の効果検証）。総事業費（見込み）・実績と効果・全体評価・評価の理由は対象外。',
  },
  '12213': {
    extract: municipality(toganeSheets, p => p.projectName),
    scope: '東金市 第２期総合戦略「総合戦略事業に係る令和６年度の実績」（実施計画・令和6年度実績報告からの引用）の事業シートのうち、決算額（円）と事業評価（１／２）が票内で1つに定まる事業の事業名・令和6年度決算額・事業評価。再掲・複数事業の票、目標指標・担当課、施策の効果検証（評価書・資料２）、計上事業の整理資料は対象外。',
  },
  '03507': {
    extract: municipality(hironoSheets, p => p.projectCode ?? p.projectName),
    scope: '洋野町 復興交付金事業計画の個別事業の実績に関する評価様式（町実施分）の事業番号・事業名のみ。事業費（複数年度の総額）・目標と実績・評価文、県実施分の様式、総合的な実績に関する評価様式（計画全体）は対象外。同名の効果促進事業など年度で区別できない同名事業は除外。',
  },
  '31371': {
    extract: municipality(kotouraReview, p => p.projectName),
    scope: '琴浦町 令和元年度 事業レビュー（町民評価員による外部評価）の評価結果資料に載る対象事業名（２日目の5事業と１日目の評価結果票1事業）のみ。区分別票数・意見、研修資料・候補一覧・対応方針（行財政改革プラン）は対象外。',
  },
  '36203': {
    extract: municipality(komatsushimaOpinion, p => p.projectName),
    scope: '小松島市 議会評価意見書（1事業1枚）の事業名と議会評価（原文区分）。評価説明の文章、年度（本文に明記なし）は対象外。既に構造化済みの同名事業（主要施策の成果・事務事業評価等に関する説明書）と年度で区別できないものは除外。',
  },
};
