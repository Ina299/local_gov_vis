import type { EvaluationRating, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const OKINAWA_SOURCE = '712c11aed4bb7665ac3d97a3';
const KAINAN_SOURCE = '4eb245cc230b13eaec9dd397';
const toAscii = (s: string) => s.normalize('NFKC');

/**
 * 沖縄市 教育行政の事務の点検及び評価 報告書（令和７年度・令和６年度実施事業）。
 * 目次「（８）点検及び評価の結果」の事業名・所管課を正とし、本文の各事業シート（事務事業名…有識者による提言）から
 * 目的・総合評価（S/A/B/C）・内容評価点・最終評価点を取る。目標値表は列崩れのため指標は転記しない。
 */
const OKINAWA_SCALE = 'S＝十分達成した(12 点）／A＝達成した(10～11 点)／B＝一部達成した(8～9 点)／C=未達成(3～7 点)';
const POINT_AXES = ['妥当性', '効率性', '有効性', '合計点'];
const flexible = (name: string) => [...name].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\n?');

function okinawa(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== OKINAWA_SOURCE) return [];
  const t = input.text;
  const header = '令和７年度\n沖縄市教育行政の事務の点検及び評価\n（令和６年度実施事業）';
  if (!t.startsWith(header)) return [];
  const tocStart = t.indexOf('（８）点検及び評価の結果\n【事業名】'), tocEnd = t.indexOf('２．教育委員会の総評', tocStart);
  const bodyStart = t.indexOf('（８）点検及び評価の結果\n\n6\n'), bodyEnd = t.indexOf('\n２．教育委員会の総評\n', bodyStart);
  if (tocStart < 0 || tocEnd < 0 || bodyStart < 0 || bodyEnd < 0) return [];
  // 目次: 「①\n\n事業名\n\n所管課\n\n頁」。所管課は改行を含む場合がある。
  const toc = [...t.slice(tocStart, tocEnd).matchAll(/([①-⑩])\n\n([^\n]+)\n\n([^\n]+(?:\n[（(][^\n]+[）)])?)\n\n(\d+)\n/g)];
  if (toc.length !== 10) return [];
  const located = toc.map(m => {
    const hits = [...t.slice(bodyStart, bodyEnd).matchAll(new RegExp(`(?<=\n\n)${flexible(m[2])}(?=\n\n)`, 'g'))];
    return { m, start: hits.length === 1 ? bodyStart + hits[0].index! : -1 };
  });
  if (located.some(l => l.start < 0)) return [];
  const ordered = [...located].sort((a, b) => a.start - b.start);
  const out: ProjectEvaluation[] = [];
  ordered.forEach((l, k) => {
    // 各シートは改ページ（空行2つ）の直後から始まり、事業名の前後どちらかに「事務事業名」見出しが来る。
    const from = t.lastIndexOf('\n\n\n', l.start);
    const to = k + 1 < ordered.length ? t.lastIndexOf('\n\n\n', ordered[k + 1].start) : bodyEnd;
    const sheet = t.slice(from, to);
    if (sheet.split('事務事業名').length !== 2 || sheet.split('◆').length < 2) return;
    const name = l.m[2], tocRaw = l.m[0], tocAt = tocStart + l.m.index!;
    const nameRaw = t.slice(l.start).match(new RegExp(`^${flexible(name)}`))![0];
    const p = project(input, name, name, 2025, nameRaw, l.start);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2024;
    p.department = l.m[3].replace(/\n/g, '');
    p.evidence.push(evidence(input, tocRaw, tocAt), evidence(input, header, 0));
    const purpose = sheet.match(/\(1\) 目 的\n\n([\s\S]+?)\n\n\(2\) 対 象/);
    if (purpose) { p.purpose = purpose[1].replace(/\n/g, ''); p.evidence.push(evidence(input, purpose[0], from + purpose.index!)); }
    const ratings: EvaluationRating[] = [];
    const overall = [...sheet.matchAll(/総合評価\n\n([SABC])\n(十分達成した|達成した|一部達成した|未達成)\n/g)];
    if (overall.length === 1) {
      const m = overall[0], raw = `${m[1]}\n${m[2]}`;
      ratings.push({ kind: 'external', label: '総合評価', value: `${m[1]} ${m[2]}`, scale: OKINAWA_SCALE, evidence: evidence(input, raw, from + m.index! + m[0].indexOf(raw)) });
    }
    for (const [label, kind] of [['内容評価点', 'self'], ['最終評価点', 'external']] as const) {
      const rows = [...sheet.matchAll(new RegExp(`${label}\\n\\n([0-9０-９]+)\\n\\n([0-9０-９]+)\\n\\n([0-9０-９]+)\\n\\n([0-9０-９]+)\\n`, 'g'))];
      if (rows.length !== 1) continue;
      const m = rows[0], v = m.slice(1, 5).map(x => Number(toAscii(x)));
      if (v[0] + v[1] + v[2] !== v[3]) continue;
      const ev = evidence(input, m[0].trimEnd(), from + m.index!);
      v.forEach((x, i) => ratings.push({ kind, label: `${label} ${POINT_AXES[i]}`, value: String(x), scale: i === 3 ? '3～12 点' : '点数（各項目）', evidence: ev }));
    }
    p.ratings = ratings;
    p.warnings.push('総合評価・最終評価点は内部評価（内容評価点）に有識者の外部評価点を加えた教育委員会の評価。目標値・実績表は段組み崩れのため指標として転記していません。所管課は目次の記載です。');
    out.push(p);
  });
  return out.length === 10 ? out : [];
}

/**
 * 海南市 教育委員会の点検・評価報告書（令和８年度・令和７年度対象）。
 * 「Ⅱ 成果 点検・評価委員の意見及び今後の方針・目標」の 20 事業の 事業目的・事業内容・令和７年度の成果 を文章で転記。
 * 評価区分・金額・所管課の記載はない。
 */
function kainan(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== KAINAN_SOURCE) return [];
  const t = input.text;
  const header = '令和８年度\n教育委員会の点検・評価報告書\n（令和７年度対象）';
  if (!t.startsWith(header)) return [];
  const heads = [...t.matchAll(/^(\d{1,2}|[０-９]{1,2})．([^\n]+)\n\n?【事業目的】/gm)];
  if (heads.length !== 20) return [];
  const end = t.indexOf('\nⅢ\n', heads[19].index!);
  if (end < 0) return [];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    if (Number(toAscii(h[1])) !== k + 1) return;
    const from = h.index!, to = k + 1 < heads.length ? heads[k + 1].index! : end, sec = t.slice(from, to);
    const labels = ['【事業目的】', '【事業内容】', '【令和７年度の成果】', '【点検・評価委員の意見】', '【今後の方針・目標】'];
    const at = labels.map(l => sec.indexOf(l));
    if (at.some((x, i) => x < 0 || (i > 0 && x <= at[i - 1])) || labels.some(l => sec.split(l).length !== 2)) return;
    const name = h[2].trim();
    const headRaw = h[0];
    const p = project(input, name, name, 2026, headRaw, from);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, header, 0));
    const field = (i: number) => {
      const raw = sec.slice(at[i], at[i + 1]).replace(/\n+$/, '');
      return { raw, body: raw.slice(labels[i].length).replace(/^\n+/, ''), start: from + at[i] };
    };
    const purpose = field(0), activities = field(1), outcomes = field(2);
    p.purpose = purpose.body.replace(/\n/g, '');
    p.activities = activities.body;
    p.evidence.push(evidence(input, purpose.raw, purpose.start), evidence(input, activities.raw, activities.start));
    // 成果欄に実績表（数値だけの行）がある場合は、表の手前の文章までを成果とする。
    const lines = outcomes.body.split('\n'), firstNum = lines.findIndex(l => /^[\d,０-９]+$/.test(l.trim()));
    let body = outcomes.body;
    if (firstNum >= 0) {
      const prose = lines.slice(0, firstNum).join('\n'), cut = prose.lastIndexOf('。');
      body = cut >= 0 ? prose.slice(0, cut + 1) : '';
      p.warnings.push('成果欄の実績表は列対応を確定できないため、表の手前の文章のみ成果として転記しています。');
    }
    if (body) {
      p.outcomes = body;
      const raw = labels[2] + outcomes.raw.slice(labels[2].length, labels[2].length + outcomes.raw.slice(labels[2].length).indexOf(body) + body.length);
      p.evidence.push(evidence(input, raw, outcomes.start));
    }
    const opinion = field(3);
    p.evidence.push(evidence(input, opinion.raw, opinion.start));
    p.warnings.push('報告書は評価区分・事業費・所管課を記載していないため、事業目的・内容・成果の文章のみ転記。点検・評価委員の意見は根拠として保持しています。');
    out.push(p);
  });
  return out;
}

export const okinawaKainanEntries: Record<string, Entry> = {
  '47211': { extract: okinawa, scope: '沖縄市教育委員会 点検・評価報告書（令和７年度・令和６年度実施事業）の10事業シート。事業名・所管課・目的・総合評価・内容評価点・最終評価点を構造化。目標値表（指標）と有識者提言本文、施策・総評は対象外。' },
  '30202': { extract: kainan, scope: '海南市教育委員会 点検・評価報告書（令和８年度提出・令和７年度対象）の20事業。事業目的・事業内容・令和７年度の成果を文章で転記。評価区分・金額は原文になく、実績表・運営状況・会議資料は対象外。' },
};
export const entries = okinawaKainanEntries;
