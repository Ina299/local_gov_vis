import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 広島県（令和7年度 主要施策の成果に関する説明書「主要事業の成果」）
const HEAD = '令和７年度主要事業の成果\n';
const N = String.raw`\d{1,3}(?:,\d{3})*`;
const NAME = /(?:^|\n)((?:[^\n]+\n)?[^\n]*（(?:単県|一部国庫|国庫)）(?:\n?【[^】\n]+】)?)(?=\n|$)/g;
const DEPT = /(?:課|担当|チーム|センター|本部)$/;

function extractHiroshima(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '34000' || input.format !== 'pdf') return [];
  const t = input.text;
  const starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) if (i === 0 || t[i - 1] === '\n') starts.push(i);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const block = t.slice(s, starts[k + 1] ?? t.length);
    const hEnd = block.indexOf('\n目的\n');
    if (hEnd < 0) return;
    const head = block.slice(0, hEnd);
    // 事業名: 末尾が（単県）（一部国庫）（国庫）で終わる行（2行に折り返す場合あり）。候補が1つの場合のみ。
    const names = [...head.matchAll(NAME)];
    if (names.length !== 1) return;
    const lines = head.split('\n');
    // 担当課: 款・項・目の行または空行の直後にある、課・担当・チーム等で終わる行が1つだけの場合のみ。
    const depts = lines.map((l, i) => ({ l, i })).filter(({ l, i }) => DEPT.test(l) && !/^(款|項|目|領域|支出科目|担 当 課)/.test(l)
      && (i === 0 || lines[i - 1] === '' || /^(款|項|目)：/.test(lines[i - 1]) || lines[i - 1] === '担 当 課'));
    const candidates = lines.filter(l => DEPT.test(l) && !/^(款|項|目|領域|支出科目|担 当 課)/.test(l) || /ほか$/.test(l));
    let dept = depts.length === 1 && candidates.length === 1 ? depts[0].l.trim() : null;
    let nameLines = names[0][1].split('\n');
    if (nameLines.length > 1 && dept && nameLines[0] === dept) nameLines = nameLines.slice(1);
    if (nameLines.length > 1 && DEPT.test(nameLines[0])) return; // 担当課の行が事業名に混ざる
    const name = nameLines.join('');
    const nameRaw = nameLines.join('\n');
    const nameOff = s + names[0].index! + names[0][0].indexOf(nameRaw);
    const p = project(input, `${k}|${nfkc(name)}`, name, null, nameRaw, nameOff);
    p.evidence.push(evidence(input, HEAD.trim(), s));
    p.evaluatedFiscalYear = 2025;
    if (dept) {
      p.department = dept;
      p.evidence.push(evidence(input, dept, s + lines.slice(0, depts[0].i).join('\n').length + (depts[0].i ? 1 : 0)));
    } else p.warnings.push('担当課の欄が抽出テキストで事業名・支出科目と分離できない（または複数行に折り返す）ため担当課は未収録。');
    // 予算執行額: 「[繰越額]」の括弧行の直前の数値行。最大値（合計）が他の値の和（小計がある場合は和の半分）と一致する場合のみ合計を決算として収録。
    const t0 = block.indexOf('事業内容'), t1 = block.indexOf('の成果目標と実績');
    if (t0 < 0 || t1 < t0) { p.warnings.push('事業内容の表が見つからないため金額は未収録。'); out.push(p); return; }
    const table = block.slice(t0, t1);
    const execs: { v: number; raw: string; off: number }[] = [];
    for (const m of table.matchAll(new RegExp(`(?<=\\n)(${N})\\n+([\\[［][^\\]］\\n]*[\\]］])(?=\\n)`, 'g')))
      execs.push({ v: Number(m[1].replace(/,/g, '')), raw: m[0], off: s + t0 + m.index! });
    const max = Math.max(...execs.map(e => e.v));
    const rest = execs.reduce((a, e) => a + e.v, 0) - max;
    if (execs.length >= 2 && max > 0 && (rest === max || rest === 2 * max)) {
      const tot = execs.filter(e => e.v === max).at(-1)!;
      const raw = tot.raw.slice(0, tot.raw.search(/\n/));
      p.amounts.push(amount(input, 'actual', 2025, raw, '千円', tot.raw, tot.off));
      p.warnings.push('金額は事業内容の表（単位：千円）の合計行の予算執行額（令和7年度）。予算執行額（[繰越額]の直前の値）の最大値が他の予算執行額の和（小計を含む場合はその半分）と一致する場合のみ合計として収録。当初予算額・最終予算額は列の並びが抽出テキストで崩れるため未収録。');
    } else p.warnings.push('予算執行額の合計が内訳の和と照合できない（表の列が抽出テキストで崩れている）ため金額は未収録。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '34000': {
    // 「人口減少対策」等の重点施策と「中山間地域」等の分冊で同じ事業が再掲されるため、事業名で統合（値が食い違えば除外）。
    extract: (input, inputs) => acrossDocuments(input, inputs, extractHiroshima, p => nfkc(p.projectName)),
    scope: '令和7年度 主要施策の成果に関する説明書「主要事業の成果」（分冊 PDF）の事業名・担当課・事業内容の表の合計の予算執行額（内訳の和と一致するもののみ）。当初予算額・最終予算額、成果目標と実績の文章、施策領域別の取組状況（金額なし）、公共事業等の総括ページは対象外。',
  },
};
