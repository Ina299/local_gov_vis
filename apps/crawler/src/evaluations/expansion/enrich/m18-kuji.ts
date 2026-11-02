import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { joinWrapped } from './m10-util';

// ---------------------------------------------------------------- 久慈市（教育委員会事務点検評価報告書 令和4・5・7年度版）
// 公開済みレコードは同じ報告書の【令和○年度の取組】の「（n）事業名〔款項目〕」ごとの事業（予算額・決算額は収録済み）。
// 事業ごとに見出しのない説明文（取組の文）と「《事業内容》」欄があり、目的の欄はない。ここでは《事業内容》欄（見出しの直後から
// 金額表の「単位：円」の手前まで）を事業内容として足す。説明文は目的と取組が混ざった文で欄の見出しがないため採らない。
// 年度は表紙の「令和N年度（令和M年度事業対象）」（公開済みレコードと同じ: 評価年度N・事業年度M）。
const IDS = new Set(['0456d97473806b0f200b2d6d', '51d92ba0098c94cd73efa351', 'bb331ac2800d4a494daeccd8']);
const TITLE = /令和([０-９\d]+)年度（令和([０-９\d]+)年度事業対象）\s*\n\s*教育委員会事務点検評価報告書/;
const nfkc = (s: string) => s.normalize('NFKC');

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '03207' || !IDS.has(input.sourceId)) return [];
  const t = input.text, title = TITLE.exec(t);
  if (!title) return [];
  const evaluationYear = 2018 + Number(nfkc(title[1])), fy = 2018 + Number(nfkc(title[2]));
  const heads = [...t.matchAll(/^（(\d+)）([^\n〔]+?)〔([^〕\n]+)〕/gm)];
  // 同じ報告書に同名の事業が2回出る場合は対応が決まらないため採らない。
  const count = new Map<string, number>();
  for (const h of heads) count.set(h[2].trim(), (count.get(h[2].trim()) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const start = h.index!, end = heads[i + 1]?.index ?? t.length, seg = t.slice(start, end), name = h[2].trim();
    if (count.get(name) !== 1) return;
    const m = /\n《事業内容》\n([\s\S]+?)\n単位：円\n/.exec(seg);
    if (!m) return;
    const raw = m[1];
    // 欄が頁の区切り（-n-）や別の見出しをまたぐもの、長すぎるもの（区切りの読み違い）、表の数値だけの行（列が分かれて並ぶ表）を含むものは採らない。
    if (/^-\s*\d+\s*-$|^【|^（\d+）|《|^\s*[\d,.]+\s*(円|人|件|回|校|％|%)?\s*$/m.test(raw) || raw.length > 600) return;
    const p = project(input, `${name}〔${h[3]}〕:activities`, name, evaluationYear, h[0], start);
    p.evaluatedFiscalYear = fy;
    p.activities = joinWrapped(raw.split('\n').map(l => l.trim()).filter(Boolean).join('\n'), 30);
    p.evidence.push(evidence(input, raw, start + m.index! + '\n《事業内容》\n'.length));
    p.warnings.push('教育委員会事務点検評価報告書の事業ごとの「《事業内容》」欄（空行と欄の幅での折り返しだけを除いてつないだ）。目的の欄はない。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '久慈市 教育委員会事務点検評価報告書（令和4・5・7年度版）: 事業ごとの《事業内容》欄（事業内容）。目的の欄はなく、見出しのない説明文は目的と取組が混ざるため対象外。',
};
