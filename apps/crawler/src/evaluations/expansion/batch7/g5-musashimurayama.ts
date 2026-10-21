import type { EvaluationAmount, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project, stableId } from '../shared';

/** 武蔵村山市 令和７年度 事務事業評価調書・補助金等評価調書（1事業1枚、外部評価調書つきのものあり）。 */
const HEAD = /(?:^|\n)(事務事業名|補助金等名) ([^\n]+)\n施策名称/g;
const YEARS = '\n令和5年度決算 令和6年度決算 令和7年度予算\n\n';
// 事業費(交付金額), 一般財源, 国都支出金, その他, 職員人件費, 所要人員, 会計年度任用職員人件費, 所要人員, 合計 の9行（1列分）。
const BLOCK = /^(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(-?[\d,]+)\n(\d+\.\d+)\n(-?[\d,]+)\n(\d+\.\d+)\n(-?[\d,]+)\n/;
const DIRECTIONS = '拡充|現状維持|縮小・見直し|廃止・休止・終了';
const num = (s: string) => Number(s.replace(/,/g, ''));
const REPORT = /\/r7houkokusho\.pdf$/;

interface Sheet { input: CachedInput; start: number; raw: string; key: string; values: string; p: ProjectEvaluation }

function sheets(input: CachedInput): Sheet[] {
  if (input.municipalityCode !== '13223' || input.format !== 'pdf' || REPORT.test(input.sourceUrl) || !/\/r7[a-z_0-9]+\.pdf$/.test(input.sourceUrl)) return [];
  const text = input.text, out: Sheet[] = [];
  const heads = [...text.matchAll(HEAD)];
  heads.forEach((h, k) => {
    const s = h.index! + (h[0].startsWith('\n') ? 1 : 0), end = heads[k + 1]?.index ?? text.length, seg = text.slice(s, end);
    const kind = h[1], name = h[2].trim(), raw = h[0].replace(/^\n/, '').replace(/\n施策名称$/, '');
    const title = kind === '事務事業名' ? '令和７年度事務事業評価調書' : '令和７年度補助金等評価調書';
    const titleAt = text.lastIndexOf(title, s);
    if (titleAt < 0 || (k > 0 && titleAt < heads[k - 1].index!) || s - titleAt > 400) return;
    const p = project(input, `${kind === '事務事業名' ? '事務事業' : '補助金等'}:${name}`, name, 2025, raw, s);
    p.evaluatedFiscalYear = 2024;
    p.evidence.push(evidence(input, title, titleAt));
    // 所管部署欄は「〇〇 部」「〇〇 課」の空白区切りで出力される。課の行が離れて出力される票は票内で一意な場合のみ採用。
    const main = seg.slice(0, seg.indexOf('外部評価調書（') >= 0 ? seg.indexOf('外部評価調書（') : seg.length);
    const deptLines = [...main.matchAll(/\n(\S+) 課(?=[ \n])/g)];
    const dept = seg.match(/^[^]{0,200}?\n所管部署\n\S+ 部\n(\S+) 課[ \n]/) ?? (deptLines.length === 1 ? deptLines[0] : null) ?? seg.match(/外部評価調書（(?:事務事業|補助金等)）\n事務事業名\n\n[^]*?\n\n所管部署\n\n\S+部\n\n(\S+課)\n/) ?? seg.match(/^[^]{0,200}?\n所管部署\n(\S+(?:局|室))\n/);
    if (dept) p.department = dept[1].endsWith('課') || /(局|室)$/.test(dept[1]) ? dept[1] : `${dept[1]}課`;
    // 同名事業を複数課が別調書で評価しているため、識別子に所管課を含める。
    if (p.department) { p.projectCode = `${p.projectCode!.split(':')[0]}:${p.department}:${name}`; p.id = stableId(input, p.projectCode, 2025); }
    const y = seg.indexOf(YEARS);
    if (y >= 0 && seg.indexOf(YEARS, y + 1) < 0) {
      const cols: RegExpMatchArray[] = [];
      let at = y + YEARS.length;
      while (cols.length < 3) {
        const m = seg.slice(at).match(BLOCK);
        if (!m) break;
        const v = m.slice(1).map(num);
        if (v[0] !== v[1] + v[2] + v[3] || v[8] !== v[0] + v[4] + v[6]) break;
        cols.push(Object.assign(m, { index: at }));
        at += m[0].length;
        if (seg.startsWith('\n', at)) at += 1; else break;
      }
      if (cols.length >= 2) {
        const label = kind === '事務事業名' ? '事業費（千円）' : '交付金額（千円）';
        const evStart = s + y + 1, evRaw = seg.slice(y + 1, cols[cols.length - 1].index! + cols[cols.length - 1][0].length);
        const ev = evidence(input, evRaw, evStart);
        const add = (k: EvaluationAmount['kind'], fy: number, rawValue: string) => p.amounts.push({ kind: k, fiscalYear: fy, amountYen: num(rawValue) * 1000, rawValue, rawUnit: '千円', evidence: ev });
        add('actual', 2023, cols[0][1]); add('fullCost', 2023, cols[0][9]);
        add('actual', 2024, cols[1][1]); add('fullCost', 2024, cols[1][9]);
        if (cols[2]) add('budget', 2025, cols[2][1]);
        p.warnings.push(`金額は「令和5年度決算 令和6年度決算 令和7年度予算」見出し直後に連続する列ブロックを左から順に対応付け、${label}＝財源内訳合計、合計＝${label}＋人件費（職員・会計年度任用職員）が一致した列のみ収録。令和7年度予算の列が離れた位置に抽出されている票は令和7年度を未収録。人件費は2区分のため単独では未収録。`);
      } else p.warnings.push('事業経費表の列対応を確定できないため金額は未収録。');
    } else p.warnings.push('事業経費表の見出しを特定できないため金額は未収録。');
    const ext = seg.indexOf('外部評価調書（');
    if (ext >= 0) {
      const choices = [...seg.slice(ext).matchAll(new RegExp(`\\n✓ (${DIRECTIONS})\\n`, 'g'))];
      if (choices.length === 1) {
        const c = choices[0];
        p.ratings.push({ kind: 'external', label: '外部評価 今後の方向性', value: c[1], scale: DIRECTIONS.replaceAll('|', '／'), evidence: evidence(input, c[0].slice(1, -1), s + ext + c.index! + 1) });
      } else p.warnings.push('外部評価調書の今後の方向性はチェック記号と選択肢の対応が抽出テキストで確定できないため未収録。');
    }
    p.warnings.push('評価指標表（目標・実績・達成率）は抽出テキストで指標名と値の行対応が崩れているため未収録。所管課評価の今後の方向性は調書の選択記号（○）が抽出テキストで選択肢と対応しないため未収録。');
    out.push({ input, start: s, raw, key: `${kind}\n${name}\n${p.department ?? ''}`, values: JSON.stringify(p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen])), p });
  });
  return out;
}

let cache: { inputs: CachedInput[]; byInput: Map<string, ProjectEvaluation[]> } | null = null;

export function extractMusashimurayama(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '13223') return [];
  if (!cache || cache.inputs !== inputs) {
    const groups = new Map<string, Sheet[]>();
    for (const i of inputs) for (const s of sheets(i)) groups.set(s.key, [...(groups.get(s.key) ?? []), s]);
    const byInput = new Map<string, ProjectEvaluation[]>();
    for (const list of groups.values()) {
      // 金額が再掲間で食い違う場合、外部評価の方向性が食い違う場合は除外。金額・外部評価の有無だけの差は記載のある票を優先して統合。
      const withAmounts = list.filter(x => x.p.amounts.length), ratingValues = new Set(list.flatMap(x => x.p.ratings.map(r => r.value)));
      if (new Set(withAmounts.map(x => x.values)).size > 1 || ratingValues.size > 1) continue;
      list.sort((a, b) => b.p.amounts.length - a.p.amounts.length || b.p.ratings.length - a.p.ratings.length);
      const [first, ...rest] = list;
      if (!first.p.ratings.length) { const rated = rest.find(x => x.p.ratings.length); if (rated) first.p.ratings.push(...rated.p.ratings); }
      for (const r of rest) first.p.evidence.push(evidence(r.input, r.raw, r.start));
      if (rest.length) first.p.warnings.push('同一の評価調書が分野別資料・外部評価資料等に再掲されているため1件に統合。');
      byInput.set(first.input.sourceId, [...(byInput.get(first.input.sourceId) ?? []), first.p]);
    }
    cache = { inputs, byInput };
  }
  return cache.byInput.get(input.sourceId) ?? [];
}

export const entries = {
  '13223': { extract: extractMusashimurayama, scope: '令和７年度事務事業評価調書・補助金等評価調書（1事業1枚）から事業名・所管課・決算/予算と総コスト（検算一致列のみ）・外部評価の今後の方向性（チェックが一意な場合）を構造化。評価指標表・所管課評価の選択、行政評価報告書（調書の再掲・一覧）、令和6年度の案内ページは対象外。' },
};
