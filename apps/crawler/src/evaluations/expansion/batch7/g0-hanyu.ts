import type { EvaluationEvidence, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

/** 羽生市 事務事業評価（総点検）評価結果一覧表（資料６）。金額の種別は同じ整理番号の評価シート（総経費が一致するもの）の列見出しで確定する。 */
const LIST_ID = '82995fb9a82a5c96a9306d12';
const SHEET_HEAD = '事務事業評価シート（令和6・7年度総点検）';
const YEAR_LABELS = ['令和５年度（決算額）', '令和６年度（決算額）', '令和７年度（予算額）', '令和８年度（予算要求額）'];
const LIST_HEADER = '令和５年度（千円）\n\n令和６年度（千円）\n\n令和７年度（千円）';
const num = String.raw`(-?\d+\.\d\d)`;
const ROW = new RegExp(String.raw`^(\d+)(?: |\n\n)([^\n]+)\n\n([A-C]-\d+)\n\n([^\n]+)\n\n` + Array(12).fill(num).join('\n\n') + '\n\n'
  + Array(6).fill(String.raw`(\d+)`).join('\n\n') + '\n\n' + Array(14).fill('([□☑])').join('\n\n') + '$', 'gm');
const SCORES = ['上位計画（総合振興計画等）への必要性', '行政関与の必要性', '事業目的及び施策等への有効性', '必要な経費に対する実績及び成果', '受益と負担の公平性', '総合評価（点数合計）'];
const GROUPS: [string, number, string[]][] = [
  ['総合評価結果及び事業継続方針', 23, ['①事業継続（廃止・中止検討の余地有）', '②事業継続（廃止・中止検討の余地無）', '③事業廃止', '④事業中止', '⑤類似事業との統合']],
  ['今後の展開 実施内容', 28, ['全体の見直しが必要', '一部改善の余地あり', '現状維持']],
  ['今後の展開 事業規模', 31, ['拡大', '縮小', '現状維持']],
  ['今後の展開 予算', 34, ['増額', '減額', '現状維持']],
];

// 既存の構造化レコード（評価年度2025）と同じ整理番号・事業名は新規側を除外する。
const EXISTING = new Set(['B-107', 'A-255', 'A-256', 'A-404', 'A-405', 'B-36', 'B-3', 'B-1', 'B-2', 'A-276', 'A-65', 'B-50', 'A-74', 'A-383', 'B-213', 'B-126', 'A-334', 'A-424', 'C-13', 'A-304', 'A-89', 'A-371', 'A-330', 'B-29', 'B-142', 'A-381', 'B-22', 'A-382', 'B-109', 'B-23']);
const EXISTING_NAMES = new Set(['県営農地防災事業', '消費生活センター相談事業', '消費生活センター相談連携事業', '中期財政計画の策定', '公債費管理計画の策定', '生涯学習出前講座事業', '出張講座事業', 'ふるさと講座事業', '体験講座事業', '市民プラザ管理運営事業', '障がい児保育事業', 'グループホーム「もくせいの里」指定管理事業', '子ども医療費・ひとり親家庭等医療費・未熟児養育医療費助成事業', '適切なし尿・汚泥処理', '公共工事における施設等の耐震化', 'ふるさと応援寄附事業', 'のりあいタクシー運行事業', '窓口・相談業務事業', '郵便事務', '「企業立地優遇制度」の充実', '学力アップ羽生塾事業', '行田市とのごみ処理施設共同整備事業', '橋梁補修工事の計画的な推進', 'ＧＩＧＡスクール構想に係る整備に関する事務', 'グループウェア機器更改事業', '公共用水域の観測調査', '児童遊園地管理事業', '合併処理浄化槽の整備促進事業', '手子林第三土地改良区参画事業', '子育てファミリー応援ギフト事業']);

interface Sheet { input: CachedInput; totals: number[]; totalRaw: string; totalStart: number; labelStarts: number[] }
function sheets(inputs: CachedInput[]): Map<string, Sheet[]> {
  const out = new Map<string, Sheet[]>();
  for (const input of inputs) {
    const t = input.text, starts = [...t.matchAll(new RegExp(SHEET_HEAD.replace(/[()（）]/g, '\\$&'), 'g'))].map(m => m.index!);
    starts.forEach((start, k) => {
      // 文字数上限で切れた最終シートは使わない。
      if (k + 1 === starts.length && input.truncated) return;
      const end = starts[k + 1] ?? t.length, seg = t.slice(start, end);
      const code = seg.match(/^[A-C]-\d+$/m), tot = seg.match(/総 経 費（A＋B）\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/);
      if (!code || !tot || !YEAR_LABELS.every(l => seg.includes(l))) return;
      // 一枚のシートに整理番号が複数あれば対応を確定できない。
      if ((seg.match(/^[A-C]-\d+$/gm) ?? []).length !== 1) return;
      const labelStarts = YEAR_LABELS.map(l => start + seg.indexOf(l));
      const s: Sheet = { input, totals: tot.slice(1, 5).map(v => Number(v.replaceAll(',', ''))), totalRaw: tot[0].trimEnd(), totalStart: start + tot.index!, labelStarts };
      out.set(code[0], [...(out.get(code[0]) ?? []), s]);
    });
  }
  return out;
}

function extract(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '11216' || input.sourceId !== LIST_ID || !input.text.includes(LIST_HEADER)) return [];
  const bySheet = sheets(inputs), seen = new Map<string, number>(), out: ProjectEvaluation[] = [];
  const rows = [...input.text.matchAll(ROW)];
  for (const m of rows) seen.set(m[3], (seen.get(m[3]) ?? 0) + 1);
  for (const m of rows) {
    if (seen.get(m[3])! > 1 || EXISTING.has(m[3]) || EXISTING_NAMES.has(m[4])) continue;
    const raw = m[0], start = m.index!, v = m.slice(5, 17), vals = v.map(Number), scores = m.slice(17, 23).map(Number);
    // 事業費(A)+人件費(B)=総経費、5項目の合計=総合点 が成り立たない行は列ずれの疑いがあるため除外。
    if ([0, 1, 2, 3].some(y => Math.round((vals[3 * y] + vals[3 * y + 1]) * 100) !== Math.round(vals[3 * y + 2] * 100))) continue;
    if (scores.slice(0, 5).reduce((a, b) => a + b, 0) !== scores[5]) continue;
    const listTotals = [2, 5, 8, 11].map(i => Math.round(vals[i]));
    const sheetList = bySheet.get(m[3]) ?? [];
    const agreeing = sheetList.filter(s => s.totals.every((x, i) => x === listTotals[i]));
    // 評価シートと総経費が食い違う事業は除外。
    if (sheetList.length && agreeing.length !== sheetList.length) continue;
    const p = project(input, m[3], m[4], null, raw, start);
    p.department = m[2];
    const ev = (): EvaluationEvidence => evidence(input, raw, start);
    m.slice(17, 23).forEach((value, i) => p.ratings.push({ kind: 'self', label: SCORES[i], value, scale: null, evidence: ev() }));
    for (const [label, offset, options] of GROUPS) {
      const marks = m.slice(offset, offset + options.length);
      if (marks.filter(x => x === '☑').length === 1) p.ratings.push({ kind: 'self', label, value: options[marks.indexOf('☑')], scale: null, evidence: ev() });
    }
    p.warnings.push('評価結果一覧表（資料６）の行。点数・選択肢の列名は評価シート様式の項目名で、列順は一覧表見出しと拡大・増額等の一覧表①〜④との対応で確認。評価年度は「令和6・7年度総点検」とのみ記載のため evaluationYear は null。');
    p.evidence.push(evidence(input, LIST_HEADER));
    const sheet = agreeing[0];
    if (sheet) {
      // 一覧表の列順（令和5/6/7/8年度）と評価シートの列見出し（決算額/決算額/予算額/予算要求額）で種別を確定。予算要求額は入れない。
      const amount = (kind: 'budget' | 'actual' | 'personnel' | 'fullCost', fiscalYear: number, i: number) =>
        p.amounts.push({ kind, fiscalYear, amountYen: Math.round(vals[i] * 1000), rawValue: v[i], rawUnit: '千円', evidence: ev() });
      amount('actual', 2023, 0); amount('personnel', 2023, 1); amount('fullCost', 2023, 2);
      amount('actual', 2024, 3); amount('personnel', 2024, 4); amount('fullCost', 2024, 5);
      amount('budget', 2025, 6);
      // 統合処理は根拠資料を1件に限るため、照合した評価シートは証拠ではなく注記（URL・文字位置）で残す。
      p.warnings.push(`金額は一覧表の小数付き千円値。令和5・6年度を決算、令和7年度事業費を予算とする種別は、総経費が一致する同じ整理番号の評価シート（${sheet.input.sourceUrl} 抽出テキスト文字位置 ${sheet.totalStart}「${sheet.totalRaw.replaceAll('\n\n', ' ')}」、列見出し「${YEAR_LABELS.join('／')}」は文字位置 ${sheet.labelStarts.join('／')}）による。令和7年度の人件費・総経費と令和8年度予算要求額は入れていない。`);
    } else {
      p.warnings.push('対応する完全な評価シート（取得本文の文字数上限で切れたもの・本文が崩れたものを除く）がなく決算・予算の別が確定できないため、金額は入れていない。');
    }
    out.push(p);
  }
  return out;
}

export const hanyuEntries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '11216': { extract, scope: '令和6・7年度総点検の評価結果一覧表（資料６）の各事務事業行（課名・整理番号・5項目点数と合計・事業継続方針・今後の展開）を構造化。金額は同じ整理番号の評価シートと総経費が一致する事業だけ、令和5・6年度決算と令和7年度予算を入れる。段組みが崩れた行、評価シート単体、一覧表①〜④・目次は対象外。' },
};
