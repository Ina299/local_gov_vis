import type { EvaluationAmount, EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/**
 * 西宮市 事務事業評価結果報告書（Ⅰ〜Ⅴ）の「西宮市事務事業評価シート」（1事業2ページ）。
 * - 令和6年度（令和5年度実施事務事業）・令和7年度（令和6年度実施事務事業）の各5冊。
 * - 保存済み本文は各冊先頭120,000文字までのため、途中で切れたシートは対象外。
 * 措置状況（R7/R8）は事業ごとの評価結果ではなく外部評価の指摘への対応状況のため対象外。案内HTMLも対象外。
 */
const R6_SOURCES = ['1157728c019b791c8364feeb', '30ba9703e084806b5a3be3ed', '127a9e89395f56dca9e4b98e', '33b1564bb7b9adfbce5467e5', '2d2c360739016f8ef325f1bb'];
const R7_SOURCES = ['f21b4fdfdeef64aec63aca9f', '7851c8365072735da6559877', '6157a41414423916159390ed', '7f0f61b255b27291fb9ff998', 'dab7a9a488971dabada339bc'];
const SOURCES = new Set([...R6_SOURCES, ...R7_SOURCES]);

type Sheet = { code: string; record: ProjectEvaluation; signature: string };

const SHEET_START = /令和(\d+)年度\n\n令和(\d+)年度実施事業\nⅠ\.\n\n西宮市事務事業評価シート\n\n事務事業に関する基礎情報/g;
const PAGE2 = /西宮市事務事業評価シート\n\n(\d{6})\n\n事務事業の指標（ＣＨＥＣＫ）/g;
const VALUE = /^(?:−|\d{1,3}(?:,\d{3})*(?:\.\d+)?)$/;

const RATING_ITEMS: [string, string[]][] = [
  ['事業の社会的ニーズ', ['社会的ニーズはかなりある', '社会的ニーズがある', '社会的ニーズがややある', '社会的ニーズはあまりない', '社会的ニーズはない']],
  ['市の関与の妥当性', ['法定受託事務である', '市が直接関与するよう法令や県条例で定めている', '市が直接関与するよう市条例で定めている', '法令・条例の根拠は無い（市規則等の場合など）']],
  ['成果の達成状況', ['目標を大きく上回った', '目標を概ね達成できている', '目標をやや達成できなかった', '目標を大きく下回った', '目標の設定が困難である']],
  ['市民ニーズの傾向', ['かなり増えることが予想される', '増えることが予想される', 'やや増えることが予想される', 'あまり変わらない', 'やや減ることが予想される', '減ることが予想される', 'かなり減ることが予想される', '事業の性質上、把握は困難である']],
  ['市民満足度', ['非常に高い', '高い', 'やや高い', 'やや低い', '低い', 'かなり低い', 'データなし（アンケート調査等を実施していない）']],
  ['コストの節減度', ['かなり節減されている', '節減されている', 'やや節減されている', 'ほとんど変わらない', 'あまり節減されていない', '節減されていない']],
  ['将来コスト増減見込み', ['現在より大幅に低減する', '現在より低減する', '現在よりやや低減する', '現状どおりで推移', '現在よりやや増える可能性がある', '現在より増える可能性がある', '現在より大幅に増える可能性がある']],
  ['受益者負担の適正度', ['受益者負担を求めるべきものではない', '負担を求める余地はあるが、負担されていない', '負担されているが、負担割合を増加すべきである', '負担割合を見直す（減少、廃止等）べきである', '既に現時点で適切な割合が負担されている']],
  ['外部委託の可能性', ['外部委託が不可能な事業である', '既に委託しており、範囲等の拡大はできない', '既に委託しており、範囲等の見直しが必要である', '既に委託しており、更に範囲等の拡大が可能である', 'まだ委託を実施していないが、一部可能である', 'まだ委託を実施していないが、全部可能である']],
  ['実施方法の効率性', ['業務改善を既に実施し、効果が十分表れている', '業務改善を既に実施し、効果が一部表れている', '業務改善を実施しているが、効果が表れていない', '業務改善を既に実施しているが、効果が表れていない', '業務改善をほとんど行っていない']],
];
const NOT_EVALUATED = '評価対象外';
/** 資料３「事務事業の今後の方針」のコードと方針。 */
const POLICIES: Record<string, string> = {
  '10': '拡充', '11': '現状どおり継続', '12': '縮小', '13': '手法・内容の見直し', '21': '他事業との整理・統合',
  '31': '休・廃止の方向で検討', '32': '次年度より休止', '33': '次年度より廃止', '41': '完了',
};
const POLICY_SCALE = Object.entries(POLICIES).map(([k, v]) => `${k} ${v}`).join('／');

const toNum = (s: string) => Number(s.replaceAll(',', ''));
const ROWS = ['A', 'うち会計年度', 'その他事業費', 'B', '従事者数', 'C', '国庫', '県', '地方債', 'その他財源', '一般財源', 'D', '減価償却', '退職給与', '対象外', 'E'] as const;

type Tok = { raw: string; start: number; end: number };

/** Cost table tokens → rows (16×4). Two token orders observed; accept only the one whose every column satisfies the sheet's identities. */
function costRows(input: CachedInput, from: number, to: number): Tok[][] | null {
  const t = input.text, toks: Tok[] = [];
  let pos = from;
  for (const line of t.slice(from, to).split('\n')) {
    if (VALUE.test(line)) toks.push({ raw: line, start: pos, end: pos + line.length });
    pos += line.length + 1;
  }
  // 末尾のページ番号を除く。
  const last = toks.at(-1);
  if (!last || !/^\n\n\n令和\d+年度\nⅣ\.\n\n$/.test(t.slice(last.end, to)) || last.raw.includes('.') || last.raw.includes(',')) return null;
  toks.pop();
  if (toks.length !== 64) return null;
  const orders = [toks, [toks[0], ...toks.slice(61), ...toks.slice(1, 61)]];
  const hits: Tok[][][] = [];
  for (const order of orders) {
    const rows = ROWS.map((_, r) => order.slice(r * 4, r * 4 + 4));
    let numericCols = 0, ok = true;
    for (let c = 0; c < 4 && ok; c++) {
      const col = rows.map(r => r[c].raw);
      if (col.every(v => v === '−')) continue;
      if (col.some(v => v === '−')) { ok = false; break; }
      const v = col.map(toNum), [A, U, O, B, , C, k1, k2, k3, k4, G, D, d1, d2, d3, E] = v;
      const ints = v.filter((_, i) => i !== 4).every(Number.isInteger);
      ok = ints && A === U + O && C === A + B && C === k1 + k2 + k3 + k4 + G && D === d1 + d2 - d3 && E === C + D;
      numericCols++;
    }
    if (ok && numericCols > 0) hits.push(rows);
  }
  return hits.length === 1 ? hits[0] : null;
}

function ratingsFor(input: CachedInput, from: number, to: number): { ratings: EvaluationRating[]; note: string | null } {
  const t = input.text, ratings: EvaluationRating[] = [];
  const sec = t.indexOf('事務事業の点検（ＣＨＥＣＫ）', from), end = t.indexOf('成果の達成状況及び', sec);
  let checksOk = sec >= 0 && end > sec && end < to;
  const found: EvaluationRating[] = [];
  let prev = -1;
  if (checksOk) for (const [label, values] of RATING_ITEMS) {
    const ms = [...t.slice(sec, end).matchAll(new RegExp(`${label}(?:\\n\\n| )([^\\n]+)`, 'g'))];
    const m = ms.length === 1 ? ms[0] : null;
    if (!m || !(values.includes(m[1]) || m[1] === NOT_EVALUATED) || sec + m.index! < prev) { checksOk = false; break; }
    prev = sec + m.index!;
    found.push({ kind: 'self', label, value: m[1], scale: `${values.join('／')}／（${NOT_EVALUATED}）`, evidence: evidence(input, m[0], prev) });
  }
  if (checksOk) ratings.push(...found);
  const pm = [...t.slice(from, to).matchAll(/基本方針\n(\d{2}) ([^\n]+)\n/g)];
  let policyOk = false, split = false;
  if (pm.length === 1) {
    const [raw, code, label] = pm[0];
    const name = POLICIES[code];
    if (name && (label === name || (name.startsWith(label) && label.length < name.length))) {
      split = label !== name;
      ratings.push({ kind: 'self', label: '事務事業の今後の方針（基本方針）', value: `${code} ${name}`, scale: POLICY_SCALE,
        evidence: evidence(input, raw.trimEnd(), from + pm[0].index!) });
      policyOk = true;
    }
  }
  const notes: string[] = [];
  if (!checksOk) notes.push('事務事業の点検（10項目）は抽出テキストで項目名と評価が隣接しない（段組み崩れ）ため転記していません。');
  if (!policyOk) notes.push('基本方針は抽出テキストで位置が確定できないため転記していません。');
  if (split) notes.push('基本方針の方針名は抽出テキストで改行により分断されているため、方針コードと報告書（資料３）のコード定義から方針名を表記。');
  return { ratings, note: notes.length ? notes.join('') : null };
}

function parseSheet(input: CachedInput, from: number, to: number, evalYear: number, evaluatedYear: number): Sheet | null {
  const t = input.text, slice = t.slice(from, to);
  const pages = [...slice.matchAll(PAGE2)];
  if (pages.length !== 1) return null;
  const code = pages[0][1], p2start = from + pages[0].index!;
  // 切れたシート（保存本文の末尾）は除外。
  if (!slice.includes('今後の改善策（ＡＣＴＩＯＮ）') || !slice.includes('注意事項')) return null;
  const names = [...t.slice(from, p2start).matchAll(/\n事務事業名\n\n([^\n]+)\n\n担当部署\n/g)];
  if (names.length !== 1) return null;
  const dated = [...t.slice(from, p2start).matchAll(new RegExp(`令和 ?${evalYear - 2018}年 ?\\d{1,2}月 ?\\d{1,2}日\\n(\\d{6})\\n`, 'g'))];
  if (dated.length !== 1 || dated[0][1] !== code) return null;

  const nameStart = from + names[0].index! + 1;
  const p = project(input, code, names[0][1], evalYear, names[0][0].slice(1, -1), nameStart);
  p.evaluatedFiscalYear = evaluatedYear;
  p.evidence.push(evidence(input, t.slice(from, from + slice.indexOf('事務事業に関する基礎情報') + '事務事業に関する基礎情報'.length), from));
  p.evidence.push(evidence(input, dated[0][0].trimEnd(), from + dated[0].index!));

  // 所管: 「担当部署」欄の局（単独行の場合のみ）＋事業番号直後の「○○室 ○○課」行。
  const bureau = [...t.slice(from, p2start).matchAll(/\n担当部署\n\n([^\n]+(?:局|事務局|会計室))\n\n/g)];
  const afterCode = t.slice(from + dated[0].index! + dated[0][0].length).match(/^\n([^\n／]+(?:室|部) [^\n／]+?(?:課|室|所|センター|館)(?:（[^）\n]*）|\([^)\n]*\))?)\n/);
  const fullDept = [...t.slice(from, p2start).matchAll(/\n担当部署\n\n([^\n／]+局 [^\n／]+室 [^\n／]+?(?:課|室|所|センター|館)(?:（[^）\n]*）|\([^)\n]*\))?)\n\n主管課長等\n/g)];
  if (fullDept.length === 1) {
    p.department = fullDept[0][1];
    p.evidence.push(evidence(input, fullDept[0][1], from + fullDept[0].index! + '\n担当部署\n\n'.length));
  } else if (bureau.length === 1) {
    const b = bureau[0][1];
    p.evidence.push(evidence(input, bureau[0][0].trim(), from + bureau[0].index! + 1));
    if (afterCode) {
      p.department = `${b} ${afterCode[1]}`;
      p.evidence.push(evidence(input, afterCode[1], from + dated[0].index! + dated[0][0].length + 1));
    } else {
      p.department = b;
      p.warnings.push('担当部署の課名が抽出テキストで分断されているため、所管は局名のみ転記。');
    }
  } else p.warnings.push('担当部署欄が抽出テキストで崩れているため、所管は転記していません。');

  // 事業費（コスト）の推移（単位：千円）
  const tbl = t.indexOf('事業費（コスト）の推移（ＰＬＡＮ・ＤＯ）', from);
  const tblEnd = tbl >= 0 ? t.lastIndexOf('西宮市事務事業評価シート', p2start) : -1;
  const ey = evalYear - 2018, labels = [`令和${ey - 3}年度決算`, `令和${ey - 2}年度決算`, `令和${ey - 1}年度決算`, `令和${ey}年度予算`];
  let amountNote = '事業費の表は列（年度）の対応が抽出テキストで確定できないため金額を転記していません。';
  if (tbl > 0 && tbl < p2start && tblEnd > tbl) {
    const region = t.slice(tbl, tblEnd);
    const rows = labels.every(l => region.split(l).length === 2) && region.includes('単 位 （千 円') ? costRows(input, tbl, tblEnd) : null;
    if (rows) {
      const amounts: EvaluationAmount[] = [];
      const years = [evaluatedYear - 2, evaluatedYear - 1, evaluatedYear, evaluatedYear + 1];
      const push = (kind: EvaluationAmount['kind'], tok: Tok, fy: number) => {
        if (tok.raw === '−') return;
        amounts.push({ kind, fiscalYear: fy, amountYen: toNum(tok.raw) * 1000, rawValue: tok.raw, rawUnit: '千円', evidence: evidence(input, t.slice(tbl, tok.end), tbl) });
      };
      const r = (name: typeof ROWS[number]) => rows[ROWS.indexOf(name)];
      for (let c = 0; c < 3; c++) {
        push('actual', r('A')[c], years[c]);
        push('personnel', r('B')[c], years[c]);
        push('fullCost', r('E')[c], years[c]);
      }
      push('budget', r('A')[3], years[3]);
      p.amounts.push(...amounts);
      amountNote = `金額は「事業費（コスト）の推移」（単位：千円）から、列ごとに 事業費Ａ＝会計年度任用職員人件費＋その他事業費、Ｃ＝Ａ＋正規職員人件費Ｂ＝財源5区分の合計、コスト調整額Ｄ＝減価償却費＋退職給与引当−コスト対象外、トータルコストＥ＝Ｃ＋Ｄ がすべて成立する並びが一意に定まった場合のみ転記。令和${ey - 3}〜${ey - 1}年度決算の事業費Ａ(actual)・正規職員人件費Ｂ(personnel)・トータルコストＥ(fullCost)と、令和${ey}年度予算の事業費Ａ(budget)。「−」の年度は転記していません。`;
    }
  }
  const { ratings, note } = ratingsFor(input, from, to);
  p.ratings.push(...ratings);
  p.warnings.push(
    `令和${ey}年度事務事業評価シート（令和${ey - 1}年度実施事業）。評価年度・評価対象年度はシート見出しの表記による。点検10項目は報告書（資料２）の選択肢または「評価対象外」と一致し、項目名と隣接して読める場合のみ原文ラベルのまま転記。`,
    amountNote,
    '活動指標・成果指標は抽出テキストで指標名が折り返し・分断され、目標・実績の列対応が確定できないため転記していません。事業概要・意図は段組み崩れのため転記していません。',
  );
  if (note) p.warnings.push(note);
  if (ratings.length || p.amounts.length) p.extractionStatus = ratings.length === 11 && p.amounts.length ? 'extracted' : 'partial';
  const signature = JSON.stringify([p.projectName, p.department, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(x => [x.label, x.value])]);
  return { code, record: p, signature };
}

function parseDocument(input: CachedInput): Sheet[] {
  const t = input.text;
  const isR6 = R6_SOURCES.includes(input.sourceId);
  const [evalYear, evaluatedYear] = isR6 ? [2024, 2023] : [2025, 2024];
  const head = isR6 ? '令和６年度\n\n事務事業評価結果報告書(' : '令和７年度\n\n事務事業評価結果報告書(';
  if (!t.startsWith(head)) return [];
  const starts = [...t.matchAll(SHEET_START)].filter(m => Number(m[1]) === evalYear - 2018 && Number(m[2]) === evaluatedYear - 2018);
  const out: Sheet[] = [];
  starts.forEach((m, k) => {
    const to = k + 1 < starts.length ? starts[k + 1].index! : t.length;
    const s = parseSheet(input, m.index!, to, evalYear, evaluatedYear);
    if (s) out.push(s);
  });
  return out;
}

const cache = new Map<string, Map<string, ProjectEvaluation>>();
/** Group by 事業番号 and year across the five volumes; identical reprints merge, conflicts are dropped. */
function resolveAll(inputs: CachedInput[]) {
  const key = inputs.map(i => i.sourceId).join();
  const hit = cache.get(key);
  if (hit) return hit;
  const groups = new Map<string, { owner: string; sheets: Sheet[] }>();
  for (const input of [...inputs].filter(i => i.municipalityCode === '28204' && SOURCES.has(i.sourceId)).sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
    for (const s of parseDocument(input)) {
      const k = `${s.code}\n${s.record.evaluationYear}`;
      const g = groups.get(k) ?? { owner: input.sourceId, sheets: [] };
      g.sheets.push(s); groups.set(k, g);
    }
  const byOwner = new Map<string, ProjectEvaluation>();
  for (const [k, g] of groups) {
    if (EXCLUDED.has(k) || !g.sheets.every(s => s.signature === g.sheets[0].signature)) continue;
    const p = g.sheets[0].record;
    for (const s of g.sheets.slice(1)) p.evidence.push(...s.record.evidence);
    if (g.sheets.length > 1) p.warnings.push('同一年度・同一事業番号の再掲シートを、名称・所管・金額・評価が一致したため1件に統合。');
    byOwner.set(`${g.owner}\n${k}`, p);
  }
  cache.set(key, byOwner);
  return byOwner;
}
/** Collides with an already structured record of the same business and year; the new side is excluded. */
const EXCLUDED = new Set<string>([]);

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '28204' || !SOURCES.has(input.sourceId)) return [];
  const all = resolveAll(inputs.some(i => i.sourceId === input.sourceId) ? inputs : [input]);
  return [...all].filter(([k]) => k.startsWith(input.sourceId + '\n')).map(([, p]) => p);
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '28204': {
    extract,
    scope: '西宮市の事務事業評価結果報告書（令和6年度＝令和5年度実施事業、令和7年度＝令和6年度実施事業の各Ⅰ〜Ⅴ冊）の事務事業評価シートを1事業1件で構造化。事業名・事業番号・担当部署、表の列対応を算術で確認できた事業費・正規職員人件費・トータルコスト（決算）と当年度予算の事業費、点検10項目と基本方針を原文ラベルで収録。保存本文が各冊先頭12万字までのため以降のシートは未収録。活動・成果指標、措置状況報告、案内ページは対象外。',
  },
};
