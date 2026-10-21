/** Batch-11 (k1) extractor for 20384 飯島町: 行政評価書（内部評価）の課別「事務事業評価／実施計画（施策）評価」総括表の事務事業行。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, type CachedInput } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 令和４〜７年度 行政評価書（内部評価）. The 令和３年度 report (f11ddfd5…) prints a two-column list whose rows interleave, so it is excluded. */
const REPORTS = new Set(['6311e3a822a1b2fce4a3d545', '2b3a5ca5ebd4032f0d2a4650', 'a544f56b778257a6b1462b6e', 'bedfce21ecb4317408da1eee']);
const TITLE = /^令和([４-７4-7])年度\n行政評価書（内部評価）\n/;
const TABLE = '事業コード・事業名称';
const TABLE_END = ['事務事業評価\n基本情報', '\n基本\n'];
const SCALE = '１.目標を大きく上回って達成／２.目標を上回って達成／３.ほぼ目標どおり／４.目標を下回った／５.目標を大きく下回った（─ 当該年度の評価なし）';
const VALUE = '([1-5１-５]|─)';
const VERTICAL = /^\n\n(?:[^\n]\n)*[^\n]$/;

function iijima(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '20384' || !REPORTS.has(input.sourceId)) return [];
  const t = input.text, title = t.match(TITLE);
  if (!title) return [];
  const reiwa = Number(title[1].normalize('NFKC')), year = 2018 + reiwa;
  // 達成状況 columns run 令和３年度…令和７年度; a report fills the columns up to its own year.
  const columns = reiwa - 2;
  // A row is printed as code, name, optional ●, one value per year, 事業終了 for later years, page. Rows whose cells were
  // displaced by the PDF text layer (values detached from the name, missing page) do not match and are skipped.
  const row = new RegExp(`(?<=\\n)(\\d{4})\\n\\n([^\\n●]+)\\n\\n(?:●\\n\\n)?${Array(columns).fill(VALUE).join('\\n\\n')}(?:\\n\\n事業終了){0,4}\\n\\n(\\d{1,3}|─)(?=\\n)`, 'g');
  // Table headings printed within a few hundred characters of each other share one run of rows (labels stacked on one page).
  const starts = [...t.matchAll(new RegExp(TABLE, 'g'))].map(m => m.index!);
  const clusters: number[][] = [];
  for (const s of starts) {
    const last = clusters[clusters.length - 1];
    if (last && s - last[last.length - 1] < 300) last.push(s); else clusters.push([s]);
  }
  const found: ProjectEvaluation[] = [];
  clusters.forEach((cluster, k) => {
    const at = cluster[0];
    const end = Math.min(clusters[k + 1]?.[0] ?? t.length, ...TABLE_END.map(s => { const i = t.indexOf(s, at); return i < 0 ? t.length : i; }));
    const region = t.slice(at, end);
    if (!region.includes('令和３年度') || !region.includes('令和７年度')) return;
    const labelEnd = region.indexOf('\n\n実施計画と');
    const label = labelEnd < 0 ? '' : region.slice(TABLE.length, labelEnd);
    // A vertical label is one character per line; only an isolated table with a single 課/事務局 sets the department.
    const name = VERTICAL.test(label) ? label.replace(/\s/g, '') : '';
    const department = cluster.length === 1 && /^[^・]+(?:課|事務局)$/.test(name) ? name : null;
    const rows = [...region.matchAll(row)];
    // Page numbers rise through the report; a row out of order with both neighbours is treated as misaligned.
    const page = (m: RegExpMatchArray | undefined) => (m && /^\d+$/.test(m[3 + columns]) ? Number(m[3 + columns]) : null);
    rows.forEach((m, i) => {
      const own = m[2 + columns], pg = page(m), prev = page(rows[i - 1]), next = page(rows[i + 1]);
      if (own === '─' || pg === null || (prev !== null && pg <= prev) || (next !== null && pg >= next)) return;
      const raw = m[0], start = at + m.index!;
      const p = project(input, m[1], m[2], year, raw, start);
      p.department = department;
      p.evaluatedFiscalYear = year;
      p.evidence.push(evidence(input, title[0].trimEnd(), 0));
      p.ratings.push({ kind: 'self', label: `達成状況（令和${reiwa}年度）`, value: own, scale: SCALE, evidence: p.evidence[0] });
      p.warnings.push(`飯島町 令和${reiwa}年度 行政評価書（内部評価）の課別総括表「事務事業評価／実施計画（施策）評価」の1行。達成状況は表の最終列（令和${reiwa}年度）の値のみ採用（前年度以前の列は過去の評価書の再掲のため未収録）。`);
      p.warnings.push(department ? `担当課は総括表の縦書き課名「${department}」。` : '総括表の課名欄が複数課の連名、または複数の表見出しが同じ位置に重なって出力されているため担当課は未設定。');
      p.warnings.push('事務事業評価シートの予算額・決算額・今後の方向性・評価項目（a/b/c）は抽出テキストで列の並びがシートごとに崩れ、年度・種別の対応を確定できないため未収録。「実施計画と連動なし（●）」の印は行からずれて出力される箇所があるため未収録。');
      found.push(p);
    });
  });
  // The same code printed twice in one report: keep one copy when the rows agree, drop all when they disagree.
  const byCode = new Map<string, ProjectEvaluation[]>();
  for (const p of found) byCode.set(p.projectCode!, [...(byCode.get(p.projectCode!) ?? []), p]);
  const out: ProjectEvaluation[] = [];
  for (const group of byCode.values()) {
    const sig = (p: ProjectEvaluation) => JSON.stringify([p.projectName, p.department, p.ratings[0].value]);
    if (group.some(p => sig(p) !== sig(group[0]))) continue;
    const [keep, ...rest] = group;
    keep.evidence.push(...rest.map(p => p.evidence[0]));
    out.push(keep);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '20384': {
    extract: input => iijima(input),
    scope: '令和４〜７年度 行政評価書（内部評価）の課別総括表に載る事務事業ごとの事業コード・事業名・担当課（単一課の表のみ）と当該年度の達成状況（５段階、原文の数字）。事業費・今後の方向性・評価項目、施策評価、外部評価（施策）、令和３年度評価書（2段組の一覧が崩れるため）は対象外。',
  },
};
