import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, at, nfkc, num, sheets, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

// ---------------------------------------------------------------- 下野市（令和6年度 事務事業評価シート・部局別PDF）
const SHIMOTSUKE = new Set(['19b34067c0fcdc0c814c2025', '4a2815c9c32f0d11c3c7a1e3', '971ef799e543cbe6b66bdee8', 'ae9d257b85f94e9802c77b7d', 'e749bc6ca7f43f933c691c7a']);
const SHIMOTSUKE_HEAD = '令和6年度\n\n事務事業評価シート\n';
const SHIMOTSUKE_SCALE = '※必要性・有効性・効率性はA・B・Cの3段階評価とし、総合評価は継続・見直し・廃止で評価する。';

function shimotsukeOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '09216' || !SHIMOTSUKE.has(input.sourceId)) return [];
  const out: ProjectEvaluation[] = [];
  for (const s of sheets(input.text, SHIMOTSUKE_HEAD)) {
    const t = s.text;
    const a = /\n目\n\n([^\n]+)\n\d+\n\d+\n\d+\n/.exec(t), b = /\n事業名称\n\n([^\n]+)\n\n２．事業内容/.exec(t);
    const nameM = a && b ? (a[1] === b[1] ? a : null) : (a ?? b);
    if (!nameM) continue;
    const name = nameM[1].trim();
    if (!name || /^[\d,]+$/.test(name)) continue;
    const p = project(input, name, name, 2024, nameM[1], s.start + nameM.index! + nameM[0].indexOf(nameM[1]));
    p.projectCode = null;
    p.evidence.unshift(evidence(input, SHIMOTSUKE_HEAD.slice(0, -1), s.start));
    const dept = /\n([^\n]+)\n部名\n(?:ｸﾞﾙｰﾌﾟ名[^\n]*\n)?([^\n]+)\n課名\n/.exec(t);
    if (dept && !/ｸﾞﾙｰﾌﾟ名|担当者名|会計名/.test(dept[1] + dept[2]) && dept[1].length <= 15 && dept[2].length <= 15) {
      p.department = dept[1] === dept[2] ? dept[1] : `${dept[1]} ${dept[2]}`;
      p.evidence.push(at(input, s.start, dept));
    }
    // 事業費（単位：千円）: 計画額・予算現額・決算額・国県支出金・地方債その他・一般財源の6行。財源3行の和＝予算現額を確認できた年度のみ採用。
    if (t.includes('◎事業費\n（単位：千円）')) {
      for (const [label, fy] of [['令和4年度', 2022], ['令和5年度', 2023]] as const) {
        const ms = [...t.matchAll(new RegExp(`\\n${label}\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n([\\d,]+)\\n\\n`, 'g'))];
        if (ms.length !== 1) continue;
        const m = ms[0], v = m.slice(1, 7).map(num);
        if (v.every(x => x === 0) || v[3] + v[4] + v[5] !== v[1]) continue;
        const raw = m[0].slice(1, -2), off = s.start + m.index! + 1;
        p.amounts.push(amount(input, 'budget', fy, m[2], '千円', raw, off), amount(input, 'actual', fy, m[3], '千円', raw, off));
      }
      if (p.amounts.length) p.warnings.push('金額は事業費表（単位：千円）の令和4・5年度列の予算現額（budget）と決算額（actual）。列は計画額・予算現額・決算額・国県支出金・地方債その他・一般財源の順に6行並び、財源3行の合計が予算現額と一致する年度のみ採用。令和6年度以降は決算額がないため未収録。全項目0の年度は未収録。');
    }
    const r1 = /\n必要性\n\n([ＡＢＣ])\n\n有効性\n\n([ＡＢＣ])\n\n効率性\n\n([ＡＢＣ])\n/.exec(t);
    const first = t.indexOf('４．１次評価'), second = t.indexOf('５．２次評価');
    if (r1 && first >= 0 && r1.index! > first && (second < 0 || r1.index! < second)) {
      const e = at(input, s.start, r1);
      (['必要性', '有効性', '効率性'] as const).forEach((label, i) => p.ratings.push({ kind: 'self', label: `１次評価 ${label}`, value: r1[i + 1], scale: SHIMOTSUKE_SCALE, evidence: e }));
      const total = /\n([^\n]+)\n\n総合評価\n\n５．２次評価\n/.exec(t);
      if (total && /^(継続実施|見直し実施|廃止|休止|完了|終了|統合)/.test(total[1])) p.ratings.push({ kind: 'self', label: '１次評価 総合評価', value: total[1], scale: SHIMOTSUKE_SCALE, evidence: at(input, s.start, total) });
    }
    const fin = /６．評価結果\n総合評価\n\n□ 横出し嵩上げによる\n□ 全庁的観点から評価を希望\n市長判定\n\n([^\n]+)\n/.exec(t);
    if (fin && /^(継続実施|見直し実施|廃止|休止|完了|終了|統合)/.test(fin[1])) p.ratings.push({ kind: 'self', label: '評価結果 総合評価（市長判定）', value: fin[1], scale: SHIMOTSUKE_SCALE, evidence: at(input, s.start, fin) });
    p.warnings.push('令和6年度事務事業評価シート（部局別PDF）。評価年度は表題の令和6年度。評価対象年度は本文に明示がないため未設定。２次評価（委員会判定）と評価指標は抽出テキストで列が分離し対応が確定できないため未収録。同一課内の同名事業（会計・グループ違い）は値が異なるため除外。');
    out.push(p);
  }
  return out;
}
const shimotsukeKey = (p: ProjectEvaluation) => `${nfkc(p.projectName)}|${p.department}|${p.evaluationYear}`;

// ---------------------------------------------------------------- 勝浦町（総合戦略 事業の検証結果：事務事業マネージメントシートの事業分析点数）
const KATSUURA: Record<string, { title: string; fy: number }> = {
  '79c2ac8f67cbe6470d7cb0cc': { title: '令和3年度事業の検証結果について', fy: 2021 },
  '90e683fec94186af09d3a5d1': { title: '令和4年度事業（重点施策）の検証結果', fy: 2022 },
};
const KATSUURA_DICT = ['63994b5982ef4ca51cfd3a45', 'd9089f99d32254ea5c8675b5'];
const KATSUURA_LABELS = ['目的の妥当性', '事業有効性', '資源投入の効率性', 'サービス公平性', '効果の達成度'];
const KATSUURA_SCALE = '事業分析点数表：各評価項目 15点・10点・5点・0点の4段階（合計75点満点）';
const VALUE_LINE = /^(?:[\d,.０-９]+\s*(?:人|%|％|品|回|件|箇所|戸|基|社)?\s*)+$/;

function katsuuraDictionary(inputs: CachedInput[]): Set<string> {
  const d = new Set<string>();
  for (const i of inputs) if (KATSUURA_DICT.includes(i.sourceId)) for (const m of i.text.matchAll(/\n\((\d+)\)([^\n]+)/g)) d.add(nfkc(m[2]));
  return d;
}
/** Business name printed in a narrow column: lines up to a blank or value line, or a join confirmed by the 総合計画評価調書 business list. */
function katsuuraName(seg: string, dict: Set<string>): string | null {
  const lines = seg.slice(1).split('\n');
  for (const n of [3, 2, 1]) if (lines.slice(0, n).every(l => l.trim()) && dict.has(nfkc(lines.slice(0, n).join('')))) return lines.slice(0, n).join('\n');
  let k = 0;
  while (k < lines.length && k < 4 && lines[k].trim() && !(k > 0 && VALUE_LINE.test(lines[k].trim()))) k++;
  if (k >= 1 && k <= 3 && (!lines[k]?.trim() || VALUE_LINE.test(lines[k].trim()))) return lines.slice(0, k).join('\n');
  if (/事業$/.test(lines[0]) && lines[1] && !/^[（(]/.test(lines[1])) return lines[0];
  return null;
}
function katsuuraOne(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const doc = KATSUURA[input.sourceId];
  if (input.municipalityCode !== '36301' || !doc || !input.text.startsWith(doc.title)) return [];
  const dict = katsuuraDictionary(inputs), out: ProjectEvaluation[] = [];
  for (const s of sheets(input.text, '●')) {
    const g = s.text, rawName = katsuuraName(g, dict);
    if (!rawName) continue;
    const totals = [...g.matchAll(/(\d+)\/75/g)];
    const scores = [...g.matchAll(/\n(15|10|5|0)\n(15|10|5|0)\n(15|10|5|0)\n(15|10|5|0)\n(15|10|5|0)(?=[ \n])/g)];
    if (totals.length !== 1 || scores.length !== 1) continue;
    const sc = scores[0], tot = totals[0];
    if (sc.slice(1, 6).reduce((x, y) => x + Number(y), 0) !== Number(tot[1])) continue;
    const header = g.indexOf('妥当性');
    if (header < 0 || sc.index! < header) continue;
    const name = rawName.replace(/\n/g, '');
    const p = project(input, name, name, null, `●${rawName}`, s.start);
    p.projectCode = null;
    p.evaluatedFiscalYear = doc.fy;
    p.evidence.unshift(evidence(input, doc.title, 0));
    const se = evidence(input, sc[0].slice(1), s.start + sc.index! + 1);
    KATSUURA_LABELS.forEach((label, i) => p.ratings.push({ kind: 'self', label: `事業分析 ${label}`, value: sc[i + 1], scale: KATSUURA_SCALE, evidence: se }));
    p.ratings.push({ kind: 'self', label: '事業分析 合計', value: tot[0], scale: KATSUURA_SCALE, evidence: at(input, s.start, tot) });
    p.warnings.push(`総合戦略の事業検証（${doc.title}）の事業分析点数（事務事業マネージメントシート）。点数5項目は表見出しの並び（目的の妥当性・事業の有効性・資源投入の効率性・サービスの公平性・効果の達成度）で、5項目の和が合計（/75）と一致する事業のみ収録。事業名は狭い列で改行されており、改行を除いて連結（総合計画評価調書の事業名一覧と一致するもの、または空行・数値行で区切られるものに限る。確定できない事業は除外）。担当課・成果指標の目標/実績は列が分離し対応が確定できないため未収録。評価年度は本文に明記がないため未設定。`);
    out.push(p);
  }
  return out;
}
const katsuuraKey = (p: ProjectEvaluation) => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`;

export const entries: Record<string, Entry> = {
  '09216': {
    extract: (input, inputs) => municipalityRecords(input, inputs, shimotsukeOne, shimotsukeKey),
    scope: '令和6年度事務事業評価シート（会計課・行政委員会事務局・議会事務局・農業委員会事務局・総務部の部局別PDF）から事業名・所管部課・令和4/5年度の予算現額と決算額（千円、財源内訳と整合するもののみ）・１次評価（必要性/有効性/効率性/総合評価）・市長判定を構造化。２次評価・評価指標、事務事業評価一覧（列崩れの再掲）は対象外。',
  },
  '36301': {
    extract: (input, inputs) => municipalityRecords(input, inputs, i => katsuuraOne(i, inputs), katsuuraKey),
    scope: '総合戦略の令和3年度・令和4年度事業の検証結果から、事務事業マネージメントシートによる事業分析点数（5項目と合計/75）が確定する事業の事業名と点数を構造化。成果指標・担当課、総合計画の中間/前期評価調書（基本施策単位）、令和6年度総合計画評価、地域再生計画は対象外。',
  },
};
