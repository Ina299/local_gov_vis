/** 藤沢市 (14205): 令和7・8年度 事務事業評価表（部局別 *-ji.pdf）の「事業概要」「指標の達成状況」欄。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// 公開済みレコードは同じ評価表の事業（batch7/g6-14205.ts: 令和7年度表・令和6年度実施、batch12/m5-fujisawa.ts: 令和8年度表・令和7年度実施）。
// 事務事業名はそれぞれと同じ取り方。所管課は照合に使わない（同名の事業が同じ年度に2つあれば補強しない）。
// 評価表に「目的」の欄はなく、「事業概要」の欄（実施内容の要約と取組の箇条書き）を事業内容、
// 「指標の達成状況」の欄（指標が設定できない場合の理由・実施したことの効果等）を成果とする。
//  事業概要: 令和8年度表は「事業概要」の見出しの次の行から「２．事業の成果」の手前まで（空行のないもの）。
//   令和7年度表は見出しが表の上部にまとまって出るため、所管課の欄の後の、句点を含む文章の段落から「２．事業の成果」の手前まで。
//  指標の達成状況: 見出し（※の注記を含む1行）の次の段落から「3.行政コスト」の手前まで（空行のないもの）。
const VARIANTS = [
  { head: '令和７年度 事務事業評価表', fy: 2024, year: 2025, sub: '（令和６年度実施事務事業）',
    name: /事務事業名\n事業期間\n(?:対象\n対象数\n根拠法令等\n事業概要\n)?\n*(?:（令和６年度実施事務事業）\n\n)?([^\n]+)(?=\n(?:(?:平成|令和|昭和)\S*年|～|\n対象\n|所管課\n))/ },
  { head: '令和８年度 事務事業評価表\n\n（令和７年度実施事務事業）\n', fy: 2025, year: 2026, sub: '（令和７年度実施事務事業）',
    name: /^[^\n]+\n\n[^\n]+\n\n１．基本情報\n事務事業名\n(?:\n([^\n]+)\n\n事業期間\n|事業期間\n(?:対象\n)?\n([^\n]+)\n(?:令和|平成|昭和)[元\d０-９]+年度\n)/ },
] as const;
const RESULT = '２．事業の成果\n';
const STATUS = /\n指標の達成状況 ※[^\n]*記載\n\n?/;
const COST = /\n\n?3\.行政コスト\n/;
// 欄の本文に表の見出し・欄名が混ざっていないこと。
const FOREIGN = /^(?:事務事業名|事業期間|対象|対象数|根拠法令等|事業概要|所管課|単位|区分|指標の内容|\(指標の補足\)|活動|成果|指標|２．事業の成果|3\.行政コスト|人|件|回|～)$|指標 \(指標の補足\)/m;

function overview(sheet: string, fy: number): { text: string; at: number } | null {
  const r = sheet.indexOf(RESULT);
  if (r < 0 || sheet.indexOf(RESULT, r + 1) >= 0) return null;
  const end = sheet[r - 1] === '\n' && sheet[r - 2] === '\n' ? r - 2 : r - 1;
  let from: number;
  if (fy === 2025) {
    const h = sheet.indexOf('\n事業概要\n');
    if (h < 0 || h > r) return null;
    from = h + '\n事業概要\n'.length;
  } else {
    // 所管課の欄の後の段落のうち、句点を含む最初の段落から。
    const d = sheet.indexOf('(旧所管課）\n');
    if (d < 0 || d > r) return null;
    let at = d + '(旧所管課）\n'.length, found = -1;
    for (const block of sheet.slice(at, end).split('\n\n')) {
      if (block.includes('。')) { found = at; break; }
      at += block.length + 2;
    }
    if (found < 0) return null;
    from = found;
  }
  const text = sheet.slice(from, end);
  const blocks = text.split('\n\n');
  if (!text.trim() || FOREIGN.test(text) || blocks.length > (fy === 2025 ? 1 : 2) || !blocks.every(b => b.includes('。'))) return null;
  return { text, at: from };
}

function status(sheet: string): { text: string; at: number } | null {
  const s = STATUS.exec(sheet);
  if (!s) return null;
  const from = s.index + s[0].length, c = COST.exec(sheet.slice(from));
  if (!c) return null;
  const text = sheet.slice(from, from + c.index);
  if (!text.trim() || text.includes('\n\n') || FOREIGN.test(text) || !text.includes('。')) return null;
  // 指標を設定しない理由だけで、実施の結果・効果を述べていない欄は成果としない。
  if (/設定|なじま|馴染ま|難しい|困難/.test(text) && !/図られ|図った|できた|達成|増加|減少|向上|推移|寄与|確保|につなが/.test(text)) return null;
  return { text, at: from };
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '14205' || !/[-_]ji(?:_\d)?\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  for (const v of VARIANTS) {
    const starts = [...t.matchAll(new RegExp(v.head, 'g'))].map(m => m.index!);
    starts.forEach((start, i) => {
      if (input.truncated && i === starts.length - 1) return;
      const sheet = t.slice(start, starts[i + 1] ?? t.length);
      if (!sheet.includes(v.sub)) return;
      const n = v.name.exec(sheet);
      const rawName = n?.[1] ?? n?.[2];
      if (!n || !rawName || /^(事業期間|対象|所管課|単位|～)/.test(rawName)) return;
      const name = rawName.trim();
      const ov = overview(sheet, v.fy), st = status(sheet);
      if (!ov && !st) return;
      const p = project(input, `補強:${name}`, name, v.year, rawName, start + n.index + n[0].indexOf(rawName));
      p.projectCode = null;
      p.evaluatedFiscalYear = v.fy;
      p.evidence.push(evidence(input, v.head.split('\n')[0], start));
      if (ov) { p.activities = ov.text; p.evidence.push(evidence(input, ov.text, start + ov.at)); }
      if (st) { p.outcomes = st.text; p.evidence.push(evidence(input, st.text, start + st.at)); }
      p.warnings.push('事務事業評価表の「事業概要」欄を事業内容、「指標の達成状況」欄（指標が設定できない場合の理由・実施したことの効果等）を成果として収録（改行も原文のまま）。評価表に目的の欄はない。'
        + '欄の本文に表の見出しが混ざる票、段落の区切りが確定しない票は対象外。');
      out.push(p);
    });
  }
  return out;
}

export const entry = {
  extract,
  scope: '藤沢市 令和7・8年度 事務事業評価表（部局別 *-ji.pdf）から、事業概要（事業内容として）と指標の達成状況（成果として）の欄。目的の欄は評価表にない。',
};
