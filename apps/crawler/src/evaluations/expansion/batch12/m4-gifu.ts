import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

// ---------------------------------------------------------------- 岐阜市（事業評価シート(R3年度事業評価用)・課別PDF）
const HEAD = '事業評価シート(R3年度事業評価用)';
const NUM = /^-?[\d,]+(?:\.\d+)?$/;
const EMPTY = '―';
const DEPT = /^[^\s\d]+(?:課|室|所|館|校|センター|局|園|署|部|会|場|病院|学園|プラント|大学)(?:（[^）]+）)?$/;
const YEARS: [string, number][] = [['令和元年度', 2019], ['令和2年度', 2020], ['令和3年度', 2021]];

type Line = { text: string; start: number; end: number; gapBefore: boolean };
/** Non-empty lines of [from, to) with absolute offsets; gapBefore = preceded by a blank line. */
function lines(t: string, from: number, to: number): Line[] {
  const out: Line[] = [];
  let pos = from, blank = false;
  for (const raw of t.slice(from, to).split('\n')) {
    const s = raw.trim();
    if (s) out.push({ text: s, start: pos + raw.indexOf(s), end: pos + raw.indexOf(s) + s.length, gapBefore: blank || !out.length });
    blank = !s;
    pos += raw.length + 1;
  }
  return out;
}
/** Paragraph (text between blank lines) that ends right before `at`; null when it spans several lines. */
function paragraphBefore(t: string, at: number, floor: number): { text: string; start: number } | null {
  const s = t.lastIndexOf('\n\n', at - 1);
  if (s < floor) return null;
  const text = t.slice(s + 2, at);
  if (!text.trim() || text.includes('\n')) return null;
  return { text, start: s + 2 };
}
const joinWrapped = (s: string) => s.split('\n').map(x => x.trim()).join('');

function indicatorsOf(input: CachedInput, p: ProjectEvaluation, from: number, to: number, nameLabel: string) {
  const t = input.text, ls = lines(t, from, to);
  const labels = new Set(['令和元年度', '令和2年度', '令和3年度', '単位', '目標値', '実績値', '達成状況', '活動指標名', '成果指標名']);
  if (!YEARS.every(([y]) => ls.some(l => l.text === y))) return false;
  const free: number[] = [];
  ls.forEach((l, i) => {
    if (labels.has(l.text) || NUM.test(l.text) || l.text === EMPTY || /^[○×△]（.+）$/.test(l.text)) return;
    free.push(i);
  });
  if (free.length !== 2) return false;
  const near = (i: number, label: string) => ls[i - 1]?.text === label || ls[i + 1]?.text === label;
  const named = free.filter(i => near(i, nameLabel));
  if (named.length !== 1) return false;
  // The other free cell is the unit; it must be short and not the line right next to the name (a wrapped name).
  const unitAt = free.filter(i => i !== named[0]);
  if (Math.abs(unitAt[0] - named[0]) === 1 || [...ls[unitAt[0]].text].length > 10) return false;
  const name = ls[named[0]].text, unit = ls[unitAt[0]].text;
  if (name === EMPTY) return false;
  // Value cells: runs of value lines separated by single newlines (target above actual in one cell).
  const runs: Line[][] = [];
  ls.forEach((l, i) => {
    if (!(NUM.test(l.text) || l.text === EMPTY)) return;
    const prev = ls[i - 1], prevValue = prev && (NUM.test(prev.text) || prev.text === EMPTY) && !l.gapBefore;
    if (prevValue && runs.length) runs[runs.length - 1].push(l); else runs.push([l]);
  });
  if (runs.length !== 3 || runs.some(r => r.length !== 2)) return false;
  if (!runs.some(r => r.some(l => NUM.test(l.text)))) return false;
  const raw = t.slice(ls[0].start, ls[ls.length - 1].end);
  runs.forEach((r, k) => {
    const v = (l: Line) => (l.text === EMPTY ? null : l.text);
    p.indicators.push({ name, fiscalYear: YEARS[k][1], target: v(r[0]), actual: v(r[1]), unit, evidence: evidence(input, raw, ls[0].start) });
  });
  return true;
}

function sheetsOf(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '21201' || !input.sourceUrl.includes('/001/019/043/') || !input.text.includes(HEAD)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const starts: number[] = [];
  for (let i = t.indexOf(HEAD); i >= 0; i = t.indexOf(HEAD, i + 1)) starts.push(i);
  starts.forEach((s, k) => {
    const end = starts[k + 1] ?? t.length, sheet = t.slice(s, end);
    const rel = (needle: string, from = 0) => { const i = sheet.indexOf(needle, from); return i < 0 ? -1 : s + i; };
    const basic = rel('【１.基本情報】'), overview = rel('【２.事業概要】'), cost = rel('【３.支出（行政コスト）】'), income = rel('【４.収入】'),
      ind = rel('【７.指標】'), ev = rel('【８.評価】'), total = rel('〔総合評価〕');
    if ([basic, overview, cost, income, ind, ev, total].some(i => i < 0) || !(basic < overview && overview < cost && cost < income && income < ind && ind < ev && ev < total)) return;
    // 事業名：「【１.基本情報】…<事業名>\n\n事業名」（通常）または「【１.基本情報】\n事業名\n\n<事業名>\n\n担当部名」。折り返した事業名は採らない。
    const basicEnd = basic + '【１.基本情報】\n'.length;
    let nm: { text: string; start: number } | null = null, layoutB = false;
    const b2 = /^【１\.基本情報】\n事業名\n\n([^\n]+)\n\n担当部名\n/.exec(t.slice(basic, overview));
    let nameLabel = t.indexOf('\n\n事業名\n', basic);
    if (b2) { nm = { text: b2[1], start: basic + b2[0].indexOf(b2[1], '【１.基本情報】\n事業名'.length) }; layoutB = true; nameLabel = basic; }
    else {
      if (nameLabel < 0 || nameLabel > overview) return;
      const from = Math.max(t.lastIndexOf('\n\n', nameLabel - 1) + 2, basicEnd);
      if (from < nameLabel && !t.slice(from, nameLabel).includes('\n')) nm = { text: t.slice(from, nameLabel), start: from };
    }
    if (!nm || !nm.text.trim() || /^\d+$|^\d{7}|番号|＿|^_|^【|^[-.]$/.test(nm.text.trim())) return;
    const name = nm.text.trim();
    const codeM = /(\d{7})\n+(?:番号\n+)?[＿_]\s*(\d{3})\n/.exec(t.slice(s, nameLabel));
    const code = codeM ? `${codeM[1]}_${codeM[2]}` : null;
    const p = project(input, code ?? name, name, null, HEAD, s);
    p.projectCode = code;
    p.evidence.push(evidence(input, name, nm.start + nm.text.indexOf(name)));
    if (codeM) p.evidence.push(evidence(input, codeM[0].trimEnd(), s + codeM.index));
    p.evaluatedFiscalYear = 2021;
    const ka = t.indexOf('\n\n担当課名\n', basic);
    const kaP = !layoutB && ka >= 0 && ka < overview ? paragraphBefore(t, ka, basic) : null;
    if (kaP && DEPT.test(kaP.text.trim())) { p.department = kaP.text.trim(); p.evidence.push(evidence(input, kaP.text.trim(), kaP.start + kaP.text.indexOf(kaP.text.trim()))); }
    const purp = /事業の目的\n\n([^]*?)\n\n事業の内容\n\n([^]*?)\n\n事\n業\n/.exec(t.slice(overview, cost));
    if (purp) {
      p.purpose = joinWrapped(purp[1]);
      p.activities = joinWrapped(purp[2]);
      p.evidence.push(evidence(input, purp[0].trimEnd(), overview + purp.index));
    }
    const notes: string[] = ['岐阜市「事業評価シート(R3年度事業評価用)」。評価対象年度は見出しと「令和３年度（実施内容）」欄・令和３年度決算列による（令和3年度）。評価を行った年度は本文に明記がないため未設定。「令和３年度（実施内容）」欄は「どのくらい」欄と行が混ざるため未収録。'];

    // 総事業費（E）=A+D：令和元〜3年度決算額（千円）。人件費A＝E−D が人件費欄の数値に現れることで列順を検算。
    const eBlockAt = t.lastIndexOf('令和元年度決算額（千円）', income);
    const eHead = t.lastIndexOf('総事業費（E）=A+D', income);
    let costOk = false;
    if (eBlockAt > eHead && eHead > cost) {
      const block = lines(t, eBlockAt, income);
      const nums = block.filter(l => NUM.test(l.text)), others = block.filter(l => !NUM.test(l.text)).map(l => l.text);
      const before = lines(t, cost, eBlockAt), beforeNums = before.filter(l => NUM.test(l.text));
      const d = before.slice(-3);
      if (nums.length === 3 && others.join('|') === '令和元年度決算額（千円）|令和２年度決算額（千円）|令和３年度決算額（千円）' && d.length === 3 && d.every(l => NUM.test(l.text))) {
        const val = (l: Line) => Number(l.text.replace(/,/g, ''));
        const pool = new Set(beforeNums.slice(0, -3).map(val));
        if (nums.every((e, j) => val(e) >= val(d[j]) && pool.has(val(e) - val(d[j])))) {
          const raw = t.slice(eBlockAt, nums[2].end);
          nums.forEach((e, j) => p.amounts.push(amount(input, 'fullCost', 2019 + j, e.text, '千円', raw, eBlockAt)));
          costOk = true;
          notes.push('金額は「総事業費（E）=A+D」行の令和元〜3年度決算額（千円、人件費＋直接事業費＋減価償却費）を fullCost として収録。抽出テキストで数値の位置が崩れるため、直前の計（D）との差（人件費A）が人件費欄の数値に現れる票のみ収録。人件費・直接事業費・収入・一般財源は未収録。');
        }
      }
    }
    if (!costOk) notes.push('総事業費の列と年度の対応が抽出テキストで確定できないため金額は未収録。');

    const outcomeAt = t.indexOf('アウトカム評価', ind);
    let indOk = 0;
    if (outcomeAt > ind && outcomeAt < ev) {
      if (indicatorsOf(input, p, t.indexOf('\n', t.indexOf('アウトプット評価', ind)) + 1, outcomeAt, '活動指標名')) indOk++;
      if (indicatorsOf(input, p, t.indexOf('\n', outcomeAt) + 1, ev, '成果指標名')) indOk++;
    }
    notes.push(indOk === 2 ? '活動指標・成果指標は目標値/実績値の組（令和元〜3年度）を列順どおりに収録。達成状況は未収録。'
      : '指標は指標名・単位・目標値/実績値の組が抽出テキストで一意に対応づけられたもののみ収録（対応が確定しない指標は未収録）。達成状況は未収録。');

    // 評価（必要性・効率性・有効性・公平性）：高/中/低。値の行が各項目の見出し範囲内に順に並ぶ票、または4項目とも同じ値の票のみ。
    const ls = lines(t, ev, total);
    const crit = ['必要性', '効率性', '有効性', '公平性'].map(c => ls.find(l => l.text === c));
    const vals = ls.filter(l => /^[高中低]$/.test(l.text));
    if (crit.every(Boolean) && vals.length === 4) {
      const pos = crit.map(c => c!.start), win = (j: number) => [j ? pos[j - 1] : ev, j < 3 ? pos[j + 1] : total];
      const ordered = vals.every((v, j) => v.start > win(j)[0] && v.start < win(j)[1]);
      if (ordered || vals.every(v => v.text === vals[0].text)) {
        vals.forEach((v, j) => p.ratings.push({ kind: 'self', label: ['必要性', '効率性', '有効性', '公平性'][j], value: v.text, scale: null, evidence: evidence(input, v.text, v.start) }));
        p.ratings.forEach((r, j) => p.evidence.push(evidence(input, crit[j]!.text, crit[j]!.start)));
      }
    }
    // 総合評価（現状維持・改善（統合・縮小含む。）・廃止）
    const tl = lines(t, total, end);
    const tok = tl.map(l => ({ l, m: /^(現状|維持|改善|廃止)(?:\s|$)/.exec(l.text) })).filter(x => x.m);
    const scale = '現状維持・改善（統合・縮小含む。）・廃止';
    const labelLine = tl.find(l => l.text === `（${scale}）`);
    if (labelLine) {
      const ts = tok.map(x => x.m![1]).join('|');
      let value: string | null = null, raw: string | null = null, at = 0;
      if (ts === '現状|維持') { value = '現状維持'; at = tok[0].l.start; raw = t.slice(at, tok[1].l.start + 2); }
      else if (ts === '改善' || ts === '廃止') { value = ts; at = tok[0].l.start; raw = ts; }
      if (value && raw) p.ratings.push({ kind: 'self', label: '総合評価', value, scale, evidence: evidence(input, raw, at) });
    }
    if (p.ratings.length < 5) notes.push('評価（必要性・効率性・有効性・公平性の高/中/低、総合評価）は値と項目の対応が抽出テキストで確定できたもののみ収録。');
    else notes.push('評価（必要性・効率性・有効性・公平性）は高/中/低、総合評価は原文の区分（現状維持・改善・廃止）のまま収録。総合評価の「現状」「維持」は理由欄と行が交互に抽出されるため、根拠は両語を含む範囲。');
    p.warnings.push(...notes);
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '21201': {
    extract: (input, inputs) => municipalityRecords(input, inputs, sheetsOf, p => `${p.projectCode ?? p.projectName}:${p.evaluatedFiscalYear}`),
    scope: '課別の事業評価シート(R3年度事業評価用)から、事務事業名・番号・担当課・目的・内容、総事業費（令和元〜3年度決算、千円、列順を検算できた票のみ）、活動・成果指標の目標値/実績値（対応が一意な票のみ）、必要性・効率性・有効性・公平性と総合評価を構造化。人件費・収入・一般財源・受益者負担・達成状況・評価理由文は対象外。評価結果概要（集計表）は対象外。',
  },
};
