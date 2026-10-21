import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, mergeReprints, nfkc, num, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- 久慈市（教育委員会事務点検評価報告書、事業ごとの予算額・決算額）
const KUJI_IDS = new Set(['0456d97473806b0f200b2d6d', '51d92ba0098c94cd73efa351', 'bb331ac2800d4a494daeccd8']);
const KUJI_TITLE = /令和([０-９\d]+)年度（令和([０-９\d]+)年度事業対象）\s*\n\s*教育委員会事務点検評価報告書/;
const N = '([\\d,]+)';
// 列見出しと値の並びが一意に読める3パターンのみ採用する（見出しと値が交互に崩れたものは採らない）。
const KUJI_SIMPLE = new RegExp(`単位：円\\s+予算額\\s+決算額\\s+${N}\\s+${N}(?=\\s+[^\\d\\s])`);
const KUJI_ALTERNATE = new RegExp(`単位：円\\s+予算額\\s+${N}\\s+決算額\\s+${N}(?=\\s+[^\\d\\s])`);
const KUJI_FULL = new RegExp(`単位：円\\s+財\\s+源\\s+内\\s+訳\\s+予算額\\s+決算額\\s+国県支出金\\s+市\\s+債\\s+その他\\s+一般財源\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${N}(?=\\s)`);

function extractKuji(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03207' || !KUJI_IDS.has(input.sourceId)) return [];
  const title = KUJI_TITLE.exec(input.text);
  if (!title) return [];
  const evaluationYear = 2018 + num(title[1]), fy = 2018 + num(title[2]);
  const heads = [...input.text.matchAll(/^（(\d+)）([^\n〔]+?)〔([^〕\n]+)〕/gm)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const start = h.index!;
    let end = heads[i + 1]?.index ?? input.text.length;
    const cut = input.text.indexOf('【施策の評価】', start);
    if (cut >= 0 && cut < end) end = cut;
    const seg = input.text.slice(start, end);
    const name = h[2].trim();
    const p = project(input, `${name}〔${h[3]}〕`, name, evaluationYear, h[0], start);
    p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, title[0], title.index));
    let budget: RegExpExecArray | null = null, actualIdx = 2;
    for (const re of [KUJI_SIMPLE, KUJI_ALTERNATE]) { budget = re.exec(seg); if (budget) break; }
    const full = budget ? null : KUJI_FULL.exec(seg);
    if (full && [3, 4, 5, 6].reduce((s, k) => s + num(full[k]), 0) !== num(full[2])) {
      p.warnings.push('予算額・決算額の表で財源内訳の合計が決算額と一致しないため金額は未収録。');
    } else if (full) { budget = full; actualIdx = 2; }
    if (budget && num(budget[1]) < num(budget[actualIdx])) {
      p.warnings.push('予算額が決算額を下回り列の対応を確認できないため金額は未収録。'); budget = null;
    }
    if (budget) {
      const off = start + budget.index;
      p.amounts.push(amount(input, 'budget', fy, budget[1], '円', budget[0], off));
      p.amounts.push(amount(input, 'actual', fy, budget[actualIdx], '円', budget[0], off));
      p.warnings.push(`金額は事業ごとの表（単位：円）の予算額・決算額で、令和${nfkc(title[2])}年度事業対象の報告書の値として当該年度に計上。`);
    } else if (!p.warnings.some(w => w.includes('未収録'))) {
      p.warnings.push('予算額・決算額の表は抽出テキストで見出しと値の並びが崩れており列の対応が確定しないため金額は未収録。');
    }
    p.warnings.push('教育委員会事務点検評価報告書の【令和○年度の取組】に掲げられた事業。評価（【施策の評価】・指標）は施策単位で記載され事業単位の評価ではないため未収録。');
    out.push(p);
  });
  return mergeReprints(out, p => `${nfkc(p.projectCode!)}|${p.evaluatedFiscalYear}`);
}

export const eduEntries: Record<string, Entry> = {
  '03207': { extract: extractKuji, scope: '久慈市教育委員会事務点検評価報告書（令和4・5・7年度版）の【取組】に掲げられた個別事業の事業名・款項目・予算額・決算額（円、列の並びが一意な表のみ）。施策の評価・指標は施策単位のため未収録。部長マニフェストは対象外。' },
};
