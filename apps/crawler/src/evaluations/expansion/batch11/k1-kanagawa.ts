import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

// ---------------------------------------------------------------- 14363 松田町 事業進捗評価シート集計表（資料２-１〜２-６）
/** 第６次総合計画 まちづくりアクションプログラムの取組（資料１「取組（事務事業：302事業）」）単位の進捗評価。 */
const MATSUDA_DOCS: Record<string, { year: number; chapter: string }> = {
  // 令和７年度 年度末評価（令和８年度第１回総合計画審議会）。
  a315d7281ccad653817a8980: { year: 2025, chapter: '資料２-１' },
  '6487fbc538f16ad7d1d8c1be': { year: 2025, chapter: '資料２-２' },
  '74ac356cb0b26950282a97c8': { year: 2025, chapter: '資料２-３' },
  '2072eb6dfd2c0b3cac4ba5ae': { year: 2025, chapter: '資料２-４' },
  '685d70ffd4c27ab8b1d7d7ab': { year: 2025, chapter: '資料２-５' },
  '9cd0af3b35067541134a0b1d': { year: 2025, chapter: '資料２-６' },
  // 令和５年度 年度末評価（令和６年度第１回総合計画審議会）の第１章のみ。
  d073d757f6d70699e851a7b6: { year: 2023, chapter: '資料２-１' },
};
const MATSUDA_DIRECTION_SCALE = 'Ａ 重点化・拡大して継続／Ｂ 現状のまま継続（１ 大幅な見直しは必要ない、２ 見直しには法令等の改正が必要、３ 見直しの必要性はあるが時期尚早）／Ｃ 見直して継続（１ 見直し・縮小、２ 他事業との整理・統合）／Ｄ 休止・廃止・完了（１ 休止、２ 廃止、３ 完了）';
const MATSUDA_DIRECTION_SOURCE = '92941c3d9fd57bb82b091aa5';
const MATSUDA_PROGRESS_SCALE = 'A【100％又は100％以上】…事業が完了 又は 目標以上成果があった／B【70％～100％未満】…検討課題がほぼなく 又は 検討課題があるものの事業を実施中／C【50％～70％未満】…事業の実施準備が完了 又は 実施準備が完了し事業に着手／D【20％～50％未満】…課題等への対応中 又は 事業の実施準備がほぼ完了／Ｅ【0％～20％未満】…未着手 又は 着手に向けて検討中';

/** 各ページの列見出し末尾（「…の方向性」「評価」）の直後に、行順で「方向性／事業総合評価／担当課」の3値が並び、「担当課」で閉じる。 */
const BLOCK = /\n評価\n\n((?:(?:[A-DＡ-Ｄ][1-3１-３]?|―|ー)\n\n(?:[A-EＡ-Ｅ]|―|ー)\n\n[^\n\d]{1,12}?(?:課|室|局)\n\n)+)担当課\n/g;
const TRIPLE = /([A-DＡ-Ｄ][1-3１-３]?|―|ー)\n\n([A-EＡ-Ｅ]|―|ー)\n\n([^\n]+)\n\n/g;
const NUMBERED = /^(\d{1,2})(?: ([^\n]+))?$/gm;
const PROGRESS = /^([A-EＡ-Ｅ])$/gm;
const PAGE_BREAK = '\n\n\n';
const width = (s: string) => [...s].reduce((w, c) => w + (/[\x20-\x7e]/.test(c) ? 0.5 : 1), 0);

interface Line { n: number; name: string | null; at: number; page: number; chapter: boolean }

function extractMatsuda(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const doc = MATSUDA_DOCS[input.sourceId];
  if (input.municipalityCode !== '14363' || !doc) return [];
  const t = input.text;
  if (!t.startsWith(doc.chapter)) return [];
  const fy = doc.year, label = fy === 2025 ? '令和７年度' : '令和５年度', nextLabel = fy === 2025 ? '令和８年度' : '令和６年度';
  const head = `${label}評価`, headAt = t.indexOf(head);
  if (headAt < 0 || headAt > 200) return [];
  const blocks = [...t.matchAll(BLOCK)];
  if (!blocks.length) return [];
  // Page bodies: from the closing 「担当課」 to the next page header (or the end); a trailing page number line is cut.
  const pages = blocks.map((b, k) => {
    const start = b.index! + b[0].length;
    // Pages are separated by a blank-line triple in the extracted text.
    const brk = t.indexOf(PAGE_BREAK, start);
    let end = brk < 0 ? t.length : brk;
    const tail = t.slice(start, end).match(/\n\d{1,2}\s*$/);
    if (tail) end -= tail[0].length;
    const triples = [...b[1].matchAll(TRIPLE)].map(m => ({ dir: m[1], total: m[2], dept: m[3], raw: m[0].trimEnd(), at: b.index! + '\n評価\n\n'.length + m.index! }));
    return { k, start, end, triples, blockRaw: b[0], blockAt: b.index! };
  });
  const lines: Line[] = [];
  for (const p of pages) {
    const body = t.slice(p.start, p.end);
    for (const m of body.matchAll(NUMBERED)) lines.push({ n: Number(m[1]), name: m[2] ?? null, at: p.start + m.index!, page: p.k, chapter: /[【［]/.test(m[2] ?? '') });
  }
  // A numbered line whose next numbered line is 「1」 opens a level (chapter/項目/施策); the others are 取組 rows.
  // Validation is per page: under each heading rows run 1,2,3…; rows continuing a 施策 from the previous page must
  // continue its numbering when that page was valid and directly precedes (no unmatched page in between).
  const rows: Line[] = [], valid = new Set<number>();
  let expect = 0;
  for (const p of pages) {
    const own = lines.filter(l => l.page === p.k);
    // The previous valid page must be the physically preceding page (no page without a matched block in between).
    const prevBreak = p.k > 0 ? t.indexOf(PAGE_BREAK, pages[p.k - 1].start) : -1;
    const nextBreak = prevBreak >= 0 ? t.indexOf(PAGE_BREAK, prevBreak + PAGE_BREAK.length) : -1;
    const contiguous = valid.has(p.k - 1) && prevBreak >= 0 && prevBreak < p.blockAt && (nextBreak < 0 || nextBreak > p.blockAt);
    let e = contiguous ? expect : -1, ok = true;
    const pageRows: Line[] = [];
    own.forEach((l, i) => {
      const next = own[i + 1] ?? lines.find(x => x.page > p.k);
      if (l.chapter || (next && next.n === 1 && !next.chapter)) { e = 1; return; }
      if (e === -1) e = l.n; // continuation rows of a 施策 whose heading is on an unchecked page
      if (l.n !== e) ok = false;
      pageRows.push(l); e++;
    });
    if (ok && pageRows.length === p.triples.length) { valid.add(p.k); rows.push(...pageRows); expect = e; }
  }
  const out: ProjectEvaluation[] = [];
  const dirInput = inputs.find(i => i.sourceId === MATSUDA_DIRECTION_SOURCE && i.municipalityCode === '14363');
  const dirRaw = '【方向性】\n事業の方向性区分\nＡ 重点化・拡大して継続';
  for (const p of pages) {
    if (!valid.has(p.k)) continue;
    const pageRows = rows.filter(r => r.page === p.k);
    // 進捗度 letters: exactly one standalone letter between each row and the next row on the page.
    const body = t.slice(p.start, p.end), letters = [...body.matchAll(PROGRESS)].map(m => ({ v: m[1], at: p.start + m.index! }));
    const progressOk = letters.length === pageRows.length && letters.every((l, i) => l.at > pageRows[i].at && l.at < (pageRows[i + 1]?.at ?? p.end));
    pageRows.forEach((r, i) => {
      const tr = p.triples[i];
      // 取組名称が折り返されて他列と混在する行は名称を確定できないため未収録。列幅は全角約19字で、折り返し行の1行目は
      // 全角18〜19字になるため、全角換算17字以上の名称も折り返しの可能性があるとして除外する。
      if (!r.name || width(r.name) >= 17) return;
      const raw = `${r.n} ${r.name}`;
      const rec = project(input, `${doc.chapter}:${raw}`, r.name, fy, raw, r.at);
      rec.projectCode = null;
      rec.evaluatedFiscalYear = fy;
      rec.department = tr.dept;
      rec.evidence.push(evidence(input, head, headAt), evidence(input, tr.raw, tr.at));
      const ratings: EvaluationRating[] = [];
      if (progressOk) ratings.push({ kind: 'self', label: `${label}評価（進捗度）`, value: letters[i].v, scale: MATSUDA_PROGRESS_SCALE, evidence: evidence(input, letters[i].v, letters[i].at) });
      if (!/^[―ー]$/.test(tr.total)) ratings.push({ kind: 'self', label: '事業総合評価（アクションプログラム期間における評価）', value: tr.total, scale: MATSUDA_PROGRESS_SCALE, evidence: evidence(input, tr.raw, tr.at) });
      if (!/^[―ー]$/.test(tr.dir)) ratings.push({ kind: 'self', label: `${nextLabel}の方向性`, value: tr.dir, scale: fy === 2025 && dirInput?.text.includes(dirRaw) ? MATSUDA_DIRECTION_SCALE : null, evidence: evidence(input, tr.raw, tr.at) });
      rec.ratings = ratings;
      rec.warnings.push(`松田町 第６次総合計画 事業進捗評価シート集計表（${doc.chapter}、${label} 年度末評価）の取組（資料１で「取組（事務事業）」と定義）1行。担当課による自己評価。`);
      rec.warnings.push('抽出テキストでは各ページの「方向性・事業総合評価・担当課」が行順にまとめて並ぶため、ページ内の取組行数（番号の連番で判定）と3値の組数が一致するページのみ行順で対応付け。取組名称が折り返されて番号だけが独立した行、名称が全角換算17字以上で折り返しの可能性がある行、組数が一致しないページの行は未収録。');
      if (!progressOk) rec.warnings.push(`${label}評価（進捗度）はページ内の記号の位置と行の対応が確定できないため未収録。`);
      else rec.warnings.push(`${label}評価（進捗度）は、当該取組番号から次の取組番号までの間にある独立した記号1つを採用（ページ内で記号数と行数が一致し全行で位置が整合する場合のみ）。`);
      if (fy === 2023) rec.warnings.push('令和５年度はアクションプログラム初年度のため事業総合評価は「―」（原文）で未収録。方向性区分の定義は同年度の資料１が未取得のため scale 未設定。');
      rec.warnings.push('事業費・指標はこの集計表に記載がないため未収録。事業内容・実績の文章は列が混在するため未収録。');
      out.push(rec);
    });
  }
  // Same 取組 name printed twice in one document cannot be told apart.
  const names = out.map(p => p.projectName);
  return out.filter(p => names.filter(n => n === p.projectName).length === 1);
}

// ---------------------------------------------------------------- 14402 清川村 令和６年度実施計画 実績評価（施策評価シートの実施計画事業表）
const KIYOKAWA_SOURCE = '8c20af961b1f36b3c07b9bd9';
const KIYOKAWA_TITLE = '第４次清川村総合計画前期基本計画\n令和６年度実施計画 実績評価';
/** 列見出しが正規の順（事業名・担当課・当初予算額・予算現額・決算額・方向性・評価）で1行ずつ並ぶ表。 */
const KIYOKAWA_HEAD = '＜実施計画事業＞\nNo.\n\n事業名\n\n担当課\n\n事業費（円）\n当初予算額\n\n予算現額\n\n決算額\n\n方向性\n\n評価\n\n';
const KIYOKAWA_ROW = /^(\d{1,2})\n\n([^\n]+)\n\n([^\n]+?(?:課|局|室))\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n(継続|拡大|縮小|見直し|統合|廃止|休止|完了)\n\n([ＡＢＣＤ])\n\n/;
const KIYOKAWA_TOTAL = /^([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n\d{1,2}\n(?:\d{1,2}\n)*計\n/;
/** 事業が1件だけの表は名称・担当課の後に金額が事業行と計で2回並ぶ。 */
const KIYOKAWA_SINGLE = /＜実施計画事業＞\nNo\.\n1\n\n事業名\n\n担当課\n\n([^\n]+)\n\n([^\n]+?(?:課|局|室))\n\n事業費（円）\n当初予算額\n\n予算現額\n\n決算額\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n\3\n\n\4\n\n\5\n\n2\n(?:\d{1,2}\n)*計\n\n\d{1,2}\n\n方向性\n\n評価\n\n(継続|拡大|縮小|見直し|統合|廃止|休止|完了)\n\n([ＡＢＣＤ])\n/g;

const yenNum = (s: string) => Number(s.replace(/,/g, ''));

function kiyokawaRecord(input: CachedInput, titleAt: number, f: { no: string; name: string; dept: string; budget: string; current: string; actual: string; dir: string; rating: string }, raw: string, at: number): ProjectEvaluation {
  const rec = project(input, `${f.no}:${f.name}`, f.name, null, raw, at);
  rec.projectCode = null;
  rec.evaluatedFiscalYear = 2024;
  rec.department = f.dept;
  rec.evidence.push(evidence(input, KIYOKAWA_TITLE, titleAt));
  const ev = rec.evidence[0];
  rec.amounts.push({ kind: 'budget', fiscalYear: 2024, amountYen: yenNum(f.budget), rawValue: f.budget, rawUnit: '円', evidence: ev });
  rec.amounts.push({ kind: 'actual', fiscalYear: 2024, amountYen: yenNum(f.actual), rawValue: f.actual, rawUnit: '円', evidence: ev });
  rec.ratings.push({ kind: 'self', label: '事業評価（事業所管課の自己評価）', value: f.rating, scale: 'Ａ～Ｄ（自己評価の結果を勘案した事業全体の評価。各記号の定義は本文に記載なし）', evidence: ev });
  rec.ratings.push({ kind: 'self', label: '方向性', value: f.dir, scale: null, evidence: ev });
  rec.warnings.push('清川村 第４次総合計画 令和６年度実施計画 実績評価の施策評価シート「＜実施計画事業＞」表の1行（No.は基本方針ごとの番号）。事業費の列見出し「事業費（円）」により円単位。当初予算額を予算、決算額を令和６年度決算として収録し、予算現額（補正後）は種別が重複するため未収録。');
  rec.warnings.push('評価年度（評価実施年度）は本文に明示がないため未設定、評価対象年度は表題「令和６年度実施計画 実績評価」による。実績評価シートの項目別評価（必要性・有効性等）と事業の成果・課題は列が混在するため未収録。成果指標は基本施策単位のため未収録。');
  return rec;
}

function extractKiyokawa(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14402' || input.sourceId !== KIYOKAWA_SOURCE) return [];
  const t = input.text, titleAt = t.indexOf(KIYOKAWA_TITLE);
  if (titleAt !== 0) return [];
  const out: ProjectEvaluation[] = [];
  for (let h = t.indexOf(KIYOKAWA_HEAD); h >= 0; h = t.indexOf(KIYOKAWA_HEAD, h + 1)) {
    let pos = h + KIYOKAWA_HEAD.length;
    const rows: { m: RegExpMatchArray; at: number }[] = [];
    for (let m = t.slice(pos).match(KIYOKAWA_ROW); m; m = t.slice(pos).match(KIYOKAWA_ROW)) {
      if (Number(m[1]) !== rows.length + 1) break;
      rows.push({ m, at: pos }); pos += m[0].length;
    }
    const total = t.slice(pos).match(KIYOKAWA_TOTAL);
    if (!rows.length || !total) continue;
    // Column correspondence is confirmed when each amount column sums to the printed 計 row.
    const sums = [4, 5, 6].map(g => rows.reduce((s, r) => s + yenNum(r.m[g]), 0));
    if (sums.some((s, i) => s !== yenNum(total[i + 1]))) continue;
    for (const { m, at } of rows) {
      const raw = m[0].trimEnd();
      const rec = kiyokawaRecord(input, titleAt, { no: m[1], name: m[2], dept: m[3], budget: m[4], current: m[5], actual: m[6], dir: m[7], rating: m[8] }, raw, at);
      rec.warnings.push('同じ表の金額列の合計が「計」行と一致することを確認して列を対応付け。');
      out.push(rec);
    }
  }
  for (const m of t.matchAll(KIYOKAWA_SINGLE)) {
    const raw = m[0].trimEnd();
    const rec = kiyokawaRecord(input, titleAt, { no: '1', name: m[1], dept: m[2], budget: m[3], current: m[4], actual: m[5], dir: m[6], rating: m[7] }, raw, m.index!);
    rec.warnings.push('事業1件の表で、事業行と「計」行の金額3列が同順で一致することを確認して列を対応付け。');
    out.push(rec);
  }
  const names = out.map(p => p.projectName);
  return out.filter(p => names.filter(n => n === p.projectName).length === 1);
}

export const entries: Record<string, Entry> = {
  '14402': {
    extract: extractKiyokawa,
    scope: '清川村 第４次総合計画 令和６年度実施計画 実績評価の施策評価シート「実施計画事業」表のうち、列見出しが正規順で金額列の合計が計と一致する表の事業ごとの名称・担当課・当初予算額・決算額・方向性・事業評価。列が崩れた表、実績評価シートの項目別評価、成果指標（基本施策単位）、実施計画書本体・総合戦略評価シートは対象外。',
  },
  '14363': {
    extract: extractMatsuda,
    scope: '松田町 第６次総合計画 事業進捗評価シート集計表（令和７年度 年度末評価の第１〜６章、令和５年度 年度末評価の第１章）の取組（事務事業）ごとの名称・担当課・進捗度・事業総合評価・次年度の方向性。列の対応が確定できるページの行のみ。資料１（総括）・資料３/４・審議会ページ、事業内容の文章、施策・項目単位の集計は対象外。',
  },
};
