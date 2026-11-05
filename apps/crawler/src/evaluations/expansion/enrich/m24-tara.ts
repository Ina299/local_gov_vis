/**
 * 41441 太良町: 物価高騰対応重点支援地方創生臨時交付金を活用した事業の実施状況及び効果検証（令和６・７年度）。
 * 公開済みレコードは batch12/m6-small の抽出（事業名・担当課・総事業費）。表の「事業の概要」列は「①目的 ②交付金を充当する経費内容
 * ③事業の対象」の3項目で、抽出テキストでは各行の概要が表の行の順に「①…」から始まるまとまりとして出力される（事業名・所管課の
 * 列が混ざる行もある）。概要のまとまりの数が表の行数と一致し、事業名が表の行の順に現れる場合だけ、i 番目のまとまりの
 * 「①」から「②」の手前までを i 行目の目的とする。①の行に事業名・所管課・補助/単独の列が混ざるもの、句点で終わらないものは採らない。
 * 「効果・検証」「課題等」の列は2列が交互に出力されるため採らない。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import type { CachedInput } from '../shared';
import { sheetRecord } from './m24-util';

interface Doc { title: string; fiscalYear: number; rows: { name: string; raw: string }[] }
const DOCS: Record<string, Doc> = {
  '527492baac8a3f71d8b00547': {
    title: '令和７年度 物価高騰対応重点支援地方創生臨時交付金を活用した事業の実施状況及び効果検証', fiscalYear: 2025,
    rows: [
      { name: '電力・ガス・食料品等価格高騰重点支援給付金（5次分）', raw: '単独 価格高騰重点支援給 町民福祉課 等）\n付金（5次分）' },
      { name: '電力・ガス・食料品等価格高騰重点支援給付金（こども加算2次分）', raw: '付金（こども加算2次' },
      { name: '定額減税補足給付金（不足額給付）', raw: '定額減税補足給付金\n（不足額給付）' },
      { name: '物価高騰対策地域共通商品券配布事業', raw: '物価高騰対策地域共\n単独\n商工観光課 ③全町民\n通商品券配布事業' },
      { name: '物価高騰対応行政区運営支援事業', raw: '物価高騰対応行政区\n単独\n企画政策課 ③55行政区\n運営支援事業' },
      { name: '物価高騰対応小中学校学校給食費支援事業', raw: '単独 校学校給食費支援事 学校教育課' },
    ],
  },
  'd065766a41c214710a12d84e': {
    title: '令和６年度 物価高騰対応重点支援地方創生臨時交付金を活用した事業の実施状況及び効果検証', fiscalYear: 2024,
    rows: [
      { name: '物価高騰対策地域共通商品券配布事業', raw: '物価高騰対策地域共\n企画商工課\n通商品券配布事業' },
      { name: '電力・ガス・食料品等価格高騰重点支援給付金（2次分）', raw: '単独 価格高騰重点支援給 町民福祉課\n付金（2次分）' },
      { name: '電力・ガス・食料品等価格高騰重点支援給付金（3次分）', raw: '単独 価格高騰重点支援給 町民福祉課\n付金（3次分）' },
      // 同名の「（こども加算分）」の2行は公開済みレコードがない（区別できないため除外済み）。行の数合わせにだけ使う。
      { name: '', raw: '' },
      { name: '電力・ガス・食料品等価格高騰重点支援給付金（4次分）', raw: '単独 価格高騰重点支援給 町民福祉課\n付金（4次分）' },
      { name: '', raw: '' },
      { name: '定額減税補足給付金（調整給付）', raw: '定額減税補足給付金\n税務課\n（調整給付）' },
    ],
  },
};
const HEADER = '③事業の対象（交付対象者、対象施設等）\n';
const MIXED = /単独|補助|[^\s]課( |$)|^付金|^分）/;

function extract(input: CachedInput): ProjectEvaluation[] {
  const doc = DOCS[input.sourceId], t = input.text;
  if (input.municipalityCode !== '41441' || !doc || !t.startsWith(doc.title) || input.truncated) return [];
  const from = t.indexOf(HEADER), to = t.indexOf('\n合計\n', from);
  if (from < 0 || to < 0 || t.indexOf(HEADER, from + 1) >= 0) return [];
  // 概要のまとまり（「①」で始まる行の位置）
  const starts: number[] = [];
  for (const m of t.slice(from, to).matchAll(/(?<=\n)①/g)) starts.push(from + m.index!);
  if (starts.length !== doc.rows.length) return [];
  // 事業名（の折り返し）が表の行の順に1回ずつ現れること。
  const pos = doc.rows.filter(r => r.raw).map(r => t.indexOf(r.raw));
  if (pos.some((p, i) => p < 0 || t.indexOf(doc.rows.filter(r => r.raw)[i].raw, p + 1) >= 0 || (i > 0 && p <= pos[i - 1]))) return [];
  const out: ProjectEvaluation[] = [];
  doc.rows.forEach((row, i) => {
    if (!row.name) return;
    const end = t.indexOf('\n②', starts[i]);
    if (end < 0 || end > (starts[i + 1] ?? to)) return;
    const raw = t.slice(starts[i], end), lines = raw.split('\n');
    if (lines.some(l => MIXED.test(l.trim())) || !/。$/.test(raw)) return;
    const p = sheetRecord(input, row.name, { value: row.name, raw: row.raw, at: t.indexOf(row.raw) }, { evaluationYear: null, evaluatedFiscalYear: doc.fiscalYear },
      [{ key: 'purpose', raw, at: starts[i] }],
      `太良町「${doc.title}」の「事業の概要」列の「①目的」。概要のまとまりは表の行の順に出力され、その数が表の行数と一致する場合に、`
      + '行の順で事業に対応づけた。「①」の記号と折り返しの改行を除いた。');
    p.purpose = raw.slice(1).split('\n').join('');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '太良町 物価高騰対応重点支援地方創生臨時交付金の効果検証（令和６・７年度）: 「事業の概要」の①目的（行の順で対応が決まり、他の列が混ざらないもの）。',
};
