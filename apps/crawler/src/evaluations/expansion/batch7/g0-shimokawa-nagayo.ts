import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 既存の構造化レコード（同じ令和７年度調書の別取得分）と同名・同年度になる事業は新規側を除外する（既存「奨学金返還支援制度」と同一事業とみられる「奨学金返還支援事業」も除外）。 */
const SHIMOKAWA_EXISTING = new Set(['医療給付事業', '総合福祉センター管理事業', '歯科診療所誘致事業', '高齢者見守り事業', '通学援助事業', '学校教材費等助成事業',
  '町営住宅維持管理事業', '快適住まいづくり促進事業', '民間賃貸住宅建設等促進事業', '空き家対策総合支援事業', '空き家対策総合コーディネート事業', '奨学金返還支援制度', '奨学金返還支援事業',
  'Ｊアラート連携屋外拡声器運用設備構築事業', 'スマホ役場構築事業', '農業振興事業', '新中核的農業担い手対策事業', '林業・林産業振興事業', '林業林産業人材確保支援事業']);

/** 下川町 資料４「令和７年度事務事業評価調書（令和６年度決算）」: 1ページ2事業の調書。 */
function extractShimokawa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01468' || input.sourceId !== 'eda9b37629bd735ec6fca2e3') return [];
  const t = input.text;
  const title = /令和[７7]年度事務事業評価調書（令和[６6]年度決算）/;
  if (!title.test(t)) return [];
  const titles = [...t.matchAll(new RegExp(title.source, 'g'))];
  const starts = [...t.matchAll(/(?<!務)事業名\n/g)].map(m => m.index!);
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i], block = t.slice(start, starts[i + 1] ?? t.length);
    // 1事業目は「事業名\n名称\n施 策」、2事業目は「事業名\n施 策\n\n名称\n施策名」と崩れる。
    const nm = block.match(/^事業名\n施 策\n\n([^\n]+)\n/) ?? block.match(/^事業名\n([^\n]+)\n施 策\n/);
    if (!nm || /施 策|事業の目的/.test(nm[1])) continue;
    const name = nm[1].trim();
    // 段組み崩れで名称位置に金額・本文が入る事業は除外（名称らしい語尾の行だけ採用）。
    if (!/^[^\d※■・（(][^\s]*(事業|補助金|制度)$/.test(name) || SHIMOKAWA_EXISTING.has(name)) continue;
    const nameRaw = nm[0];
    const p = project(input, name, name, 2025, nameRaw, start);
    p.evaluatedFiscalYear = 2024;
    const head = titles.filter(h => h.index! < start).at(-1);
    if (head) p.evidence.push(evidence(input, head[0], head.index!));
    const dep = block.match(/担当課 ([^\s]+課)\n/) ?? block.match(/担当課\n推進施策\n\n([^\s]+課)\n/);
    if (dep) { p.department = dep[1]; p.evidence.push(evidence(input, dep[0], start + dep.index!)); }
    const pur = block.match(/事業の目的\n([^]*?)\n事業の概要\n/);
    if (pur && pur[1].length < 400) { p.purpose = pur[1].replace(/\n/g, ''); p.evidence.push(evidence(input, pur[0], start + pur.index!)); }
    // 決算額の行が「令和５年度 令和６年度」の直後に2値そろって並ぶ場合だけ年度を対応づける。
    const amt = block.match(/令和[５5]年度[ \n]令和[６6]年度\n(?:評 価\n[^\n]+\n)?決算額\n([\d,]+)\n([\d,]+)\n/);
    if (amt && block.includes('決算額（単位：千円）')) {
      const as = start + amt.index!;
      [[amt[1], 2023], [amt[2], 2024]].forEach(([raw, fy]) => {
        p.amounts.push({ kind: 'actual', fiscalYear: fy as number, amountYen: Number((raw as string).replaceAll(',', '')) * 1000, rawValue: raw as string, rawUnit: '千円', evidence: evidence(input, amt[0], as) });
      });
    }
    const ratings = [...block.matchAll(/\n([A-D]\.[^\n]*成果[^\n]*)\n/g)];
    if (ratings.length === 1) {
      const r = ratings[0];
      p.ratings.push({ kind: 'self', label: '事務事業の評価', value: r[1], scale: null, evidence: evidence(input, r[0], start + r.index!) });
    }
    p.warnings.push('令和７年度事務事業評価調書（令和６年度決算）。決算額は表頭「令和５年度 令和６年度」直後に2値が並ぶ場合のみ採用（財源内訳は列崩れのため不採用）。今後の方向性（拡充・現状維持・縮小・廃止・休止）は選択印が抽出テキストに残らないため不採用。');
    const key = name, old = out.get(key);
    if (old) {
      const same = JSON.stringify(old.amounts.map(a => a.rawValue)) === JSON.stringify(p.amounts.map(a => a.rawValue)) && old.ratings[0]?.value === p.ratings[0]?.value;
      if (!same) conflicts.add(key); else old.evidence.push(evidence(input, nameRaw, start));
    } else out.set(key, p);
  }
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

/** 長与町「令和７年度事務事業評価結果一覧表」: 段組み崩れが大きいため №＋事業名のみ。 */
function extractNagayo(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42307' || input.sourceId !== '6aee67275a4943b7d226525c') return [];
  const t = input.text, header = '令和７年度事務事業評価結果一覧表';
  if (!t.startsWith(header)) return [];
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  // 事業名列は5文字幅で折り返す。1行目がちょうど5文字で、2行目が5文字未満か「事業/事務」で終わる行だけ採用（縦書きの課名が混入した行を除く）。
  for (const m of t.matchAll(/^(\d{1,3})(?: |\n\n)([^\n]+)\n([^\n]+)\n\n([^\n]{5})\n([^\n]{1,5})\n\n/gm)) {
    const [, no, , , l1, l2] = m;
    if (!(l2.length < 5 || /(事業|事務)$/.test(l2))) continue;
    if (/[\s　]/.test(l1 + l2)) continue;
    const name = l1 + l2;
    const p = project(input, no, name, 2025, m[0].replace(/\n\n$/, ''), m.index!);
    p.evidence.push(evidence(input, header, 0));
    p.warnings.push('一覧表のPDF抽出テキストは段組みが大きく崩れているため、№と事業名（5文字幅の折り返しを連結）のみ構造化。課名（縦書き）・評価・今後の方針・方向性は行との対応が確定できないため不採用。');
    const old = out.get(no);
    if (old) { if (old.projectName !== name) conflicts.add(no); continue; }
    out.set(no, p);
  }
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

export const shimokawaNagayoEntries: Record<string, Entry> = {
  '01468': { extract: extractShimokawa, scope: '令和７年度事務事業評価調書（令和６年度決算）の各事業：事業名・担当課・目的・令和５/６年度決算額・評価（A〜D原文）。総合計画実施事業調書（計画）・財政計画・答申・会議録は対象外。' },
  '42307': { extract: extractNagayo, scope: '令和７年度事務事業評価結果一覧表の№と事業名のみ（段組み崩れで名称が確定できる行に限る）。課・評価・方針・方向性は列対応が確定できないため構造化しない。' },
};
