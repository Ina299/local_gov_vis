/** Batch-7 extractors for 芦別市 (01216), 湧別町 (01559) and 美幌町 (01543). */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };
const BASE_WARNING = '保存済み抽出テキストから部分構造化。PDF原本との再照合は未実施。';
const toNum = (s: string) => Number(s.replaceAll(',', ''));
const kanjiDigits = (s: string) => Number(s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10)));

/** Merge same-key records when their structured values agree; drop keys whose re-listings disagree. */
function mergeRecords(items: { key: string; record: ProjectEvaluation }[], note: string): ProjectEvaluation[] {
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  const sig = (p: ProjectEvaluation) => JSON.stringify([p.department, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.ratings.map(r => [r.label, r.value]), p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual])]);
  for (const { key, record } of items) {
    const old = out.get(key);
    if (!old) { out.set(key, record); continue; }
    if (sig(old) !== sig(record)) { conflicts.add(key); continue; }
    old.evidence.push(...record.evidence);
    if (!old.warnings.includes(note)) old.warnings.push(note);
  }
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

/**
 * Applies the import's identity rule across every document of the municipality: within one period, records sharing a
 * code, or a name with compatible departments, are one business. Identical re-listings are merged; differing ones dropped.
 */
const memo = new WeakMap<CachedInput[], ProjectEvaluation[]>();
function acrossInputs(raw: (input: CachedInput) => ProjectEvaluation[]): (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[] {
  return (input, inputs) => {
    let all = memo.get(inputs);
    if (!all) {
      const norm = (s: string | null) => s?.normalize('NFKC').replace(/\s/g, '') ?? null;
      const period = (a: ProjectEvaluation, b: ProjectEvaluation) => a.evaluatedFiscalYear !== null && b.evaluatedFiscalYear !== null ? a.evaluatedFiscalYear === b.evaluatedFiscalYear : a.evaluationYear !== null && b.evaluationYear !== null ? a.evaluationYear === b.evaluationYear : null;
      const sig = (p: ProjectEvaluation) => JSON.stringify([norm(p.projectName), norm(p.department), p.evaluationYear, p.evaluatedFiscalYear, p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen]), p.indicators.map(i => [i.name, i.fiscalYear, i.target, i.actual, i.unit]), p.ratings.map(r => [r.label, r.value])]);
      const kept: ProjectEvaluation[] = [], dropped = new Set<ProjectEvaluation>();
      for (const p of inputs.flatMap(i => raw(i))) {
        const clash = kept.filter(o => {
          const sameName = norm(o.projectName) === norm(p.projectName), sameCode = o.projectCode !== null && p.projectCode !== null && norm(o.projectCode) === norm(p.projectCode);
          const sameDept = !o.department || !p.department || norm(o.department) === norm(p.department);
          return (sameCode || (sameName && sameDept)) && period(o, p) !== false;
        });
        if (!clash.length) { kept.push(p); continue; }
        if (clash.length === 1 && sig(clash[0]) === sig(p)) {
          clash[0].evidence.push(...p.evidence);
          const note = '同一年度・同一事業の再掲（値一致）を1件に統合し、再掲箇所を根拠に追加。';
          if (!clash[0].warnings.includes(note)) clash[0].warnings.push(note);
          continue;
        }
        clash.forEach(o => dropped.add(o)); dropped.add(p); kept.push(p);
      }
      all = kept.filter(p => !dropped.has(p));
      memo.set(inputs, all);
    }
    return all.filter(p => p.evidence[0].sourceUrl === input.sourceUrl && p.evidence[0].sha256 === input.sourceSha256);
  };
}

// ---------------------------------------------------------------- 芦別市: 目次（事務事業名・所管部署名・総合判定）
const ASHIBETSU_JUDGMENTS = '継続|拡充|改善|縮小|休止|廃止|終了|評価対象外';
function extractAshibetsu(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01216') return [];
  const title = input.text.match(/[〈<]目次[〉>]\s*令和([０-９\d]+)年度/);
  if (!title || !/主要事[務業]+(?:事業)?等?実施の状況及び事務事業評価結果/.test(input.text.slice(title.index!, title.index! + 200))) return [];
  const fiscalYear = 2018 + kanjiDigits(title[1]);
  const sections = [...input.text.matchAll(/【([^】\n]+会計)】/g)];
  const row = new RegExp(`(?<=\\n)\\d+\\n\\n(\\d+)\\n\\n(\\d+)(?:\\n\\n| )(\\d+) ([^\\n]+)\\n\\n(?:([^\\n\\d][^\\n]*)\\n\\n)?(${ASHIBETSU_JUDGMENTS})(?=\\n|$)`, 'g');
  const items: { key: string; record: ProjectEvaluation }[] = [];
  let last: { section: string; k: number[] } | null = null;
  for (const m of input.text.matchAll(row)) {
    const start = m.index!, section = sections.filter(s => s.index! < start).at(-1)?.[1] ?? '';
    const k = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (k[0] > 20 || k[1] > 20 || k[2] > 40) continue;
    // 款・項・目は目次内で非減少。崩れた位置の行（ページ番号の混入等）を排除する。
    if (last && last.section === section && (k[0] < last.k[0] || (k[0] === last.k[0] && (k[1] < last.k[1] || (k[1] === last.k[1] && k[2] < last.k[2]))))) continue;
    last = { section, k };
    const name = m[4].trim(), dept = m[5]?.trim() ?? null, judgment = m[6];
    if (dept && /ページ|款|事務事業名|所管部署名|総合判定/.test(dept)) continue;
    const raw = m[0], code = `${section ? section + ':' : ''}${k.join('-')}`;
    const p = project(input, `${code}:${name}`, name, null, raw, start);
    p.projectCode = null; p.department = dept; p.evaluatedFiscalYear = fiscalYear;
    p.ratings.push({ kind: 'self', label: '総合判定', value: judgment, scale: '拡充／改善／継続／縮小／休止／廃止／終了／評価対象外（原文の区分）', evidence: evidence(input, raw, start) });
    p.evidence.push(evidence(input, title[0], title.index!));
    p.warnings = [BASE_WARNING + '主要事務事業実施の状況及び事務事業評価結果の目次（款・項・目・事務事業名・所管部署名・総合判定）のみ。決算額・成果は各款の個票にあるが列崩れのため未取得。所管部署が複数行に分かれる行・列位置が崩れた行は除外。評価年度は本文に明示がないため未設定（対象年度は目次の年度）。'];
    if (!dept) p.warnings.push('所管部署名が判定の直前に無い行のため所管部署は未設定。');
    items.push({ key: `${code}:${name}`, record: p });
  }
  return mergeRecords(items, '同一会計・款項目・名称の再掲を統合（値一致）。');
}

// ---------------------------------------------------------------- 湧別町: 総合評価 集計表「事業別一覧」
const YUBETSU_DEPTS = ['健康こども', '住民税務', '企画財政', '水産林務', '商工観光', '教育総務', '社会教育課', '社会教育', '建設', '水道', '総務', '農政', '福祉'];
const YUBETSU_VIEW_SCALE = '１．「高い」 ２．どちらかといえば「高い」 ３．どちらかといえば「低い」 ４．「低い」 ５．「評価対象外」';
const YUBETSU_JUDGE_SCALE = '１．拡充 ２．現状維持 ３．改善 ４．縮小 ５．統合 ６．移管・移譲 ７．休止・廃止 ８．終結';
const YUBETSU_HEADER = /Ｒ[０-９\d]+\n評価 Check\n判定 Action\n事務 事業 実施\n直接事業費\n（見込） 種別 主体 手法 必要性 有効性 効率性 公平性 (?:１次|一次) (?:２次|二次) 外部 (?:３次|三次) 総合/g;
const YUBETSU_LEGEND = /^(?:(?:事務種別|事業主体|実施手法|評価区分|評価判定)：|[１-８]\.|(?:No|整理|番号|担当課|事務事業名|７．事業別一覧|事業別一覧)$)/;
interface Line { text: string; start: number }
function linesOf(text: string, from: number, to: number): Line[] {
  const out: Line[] = []; let pos = from;
  for (const t of text.slice(from, to).split('\n')) { out.push({ text: t, start: pos }); pos += t.length + 1; }
  return out;
}
function extractYubetsu(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01559') return [];
  const title = input.text.match(/^令和([０-９\d]+)年度 行政評価（令和([０-９\d]+)年度 実施事業）総合評価\n/);
  if (!title || !input.text.includes('事業別一覧')) return [];
  const year = 2018 + kanjiDigits(title[1]), implYear = 2018 + kanjiDigits(title[2]);
  const items: { key: string; record: ProjectEvaluation }[] = [];
  for (const h of input.text.matchAll(YUBETSU_HEADER)) {
    const hStart = h.index!, hEnd = hStart + h[0].length;
    const pageStart = input.text.lastIndexOf('事務種別：', hStart);
    if (pageStart < 0) continue;
    // Row identity (整理番号・担当課・事務事業名) from the region before the column header.
    const codes: Line[] = [], depts: Line[] = [], names: Line[] = [];
    let bad = false;
    for (const l of linesOf(input.text, pageStart, hStart)) {
      let t = l.text, off = l.start;
      if (!t.trim() || YUBETSU_LEGEND.test(t) || /^\d+$/.test(t)) continue;
      const c = t.match(/^(?:\d+ )?(\d{5}(?:-\d+)?)(?: |$)/);
      if (c) { const cs = t.indexOf(c[1]); codes.push({ text: c[1], start: off + cs }); t = t.slice(c[0].length); off += c[0].length; if (!t) continue; }
      const d = YUBETSU_DEPTS.find(x => t === x || t.startsWith(x + ' '));
      if (d) { depts.push({ text: d, start: off }); t = t.slice(d.length + 1); off += d.length + 1; if (!t) continue; }
      if (/^[\d,]+$/.test(t)) { bad = true; break; }
      names.push({ text: t, start: off });
    }
    // Columns after the header: 直接事業費＋12の区分列。列が1行に融合した場合は空白で分割。
    const columns: Line[][] = [];
    let n = -1, pos = hEnd;
    while (columns.length < 13 && input.text.startsWith('\n\n', pos)) {
      const end = input.text.indexOf('\n\n', pos + 2), blockEnd = end < 0 ? input.text.length : end;
      const ls = linesOf(input.text, pos + 2, blockEnd);
      if (n < 0) n = ls.length;
      if (ls.length !== n) break;
      const parts = ls.map(l => l.text.split(' '));
      const width = parts[0].length;
      if (!parts.every(p => p.length === width)) break;
      for (let j = 0; j < width; j++) columns.push(ls.map((l, i) => {
        const before = parts[i].slice(0, j).join(' ').length + (j ? 1 : 0);
        return { text: parts[i][j], start: l.start + before };
      }));
      pos = blockEnd;
    }
    if (bad || columns.length !== 13 || n <= 0 || codes.length !== n || depts.length !== n || names.length !== n) continue;
    const ok = columns.every((col, j) => col.every(c => j === 0 ? /^(?:[\d,]+|－)$/.test(c.text) : j <= 3 ? /^[1-7]$/.test(c.text) : j <= 7 ? /^[1-5]$/.test(c.text) : /^(?:[1-8]|－)$/.test(c.text)));
    if (!ok) continue;
    const labels = ['', '', '', '', '必要性', '有効性', '効率性', '公平性', '１次評価 判定', '２次評価 判定', '外部評価 判定', '３次評価 判定', '総合評価 判定'];
    for (let i = 0; i < n; i++) {
      const code = codes[i].text, name = names[i].text.trim(), dept = depts[i].text;
      const p = project(input, `${code}:${name}`, name, year, names[i].text, names[i].start);
      p.projectCode = code; p.department = dept; p.evaluatedFiscalYear = implYear;
      p.evidence.push(evidence(input, code, codes[i].start), evidence(input, dept, depts[i].start), evidence(input, title[0].trimEnd(), 0));
      for (let j = 4; j < 13; j++) {
        const c = columns[j][i];
        if (c.text === '－') continue;
        p.ratings.push({ kind: j === 10 ? 'external' : 'self', label: labels[j], value: c.text, scale: j <= 7 ? YUBETSU_VIEW_SCALE : YUBETSU_JUDGE_SCALE, evidence: evidence(input, c.text, c.start) });
      }
      p.warnings = [BASE_WARNING + '総合評価集計表「事業別一覧」の各列（整理番号・担当課・事務事業名・評価区分コード・判定コード）を行順で対応付け。各列の行数が一致するページのみ採用し、一致しないページは除外。評価値は原文のコード（区分の定義はscaleに記載）。直接事業費は「（見込）」のため金額として採用していない。'];
      items.push({ key: `${code}:${name}`, record: p });
    }
  }
  const merged = mergeRecords(items, '同一整理番号・名称の再掲を統合（値一致）。');
  // 複数事業で共有される整理番号（例: イベント事業）は事業の識別子にならないため保持しない。
  const counts = new Map<string, number>();
  for (const p of merged) counts.set(p.projectCode!, (counts.get(p.projectCode!) ?? 0) + 1);
  for (const p of merged) if (counts.get(p.projectCode!)! > 1) { p.warnings.push(`整理番号${p.projectCode}は複数事業で共有のため事業コードとして保持しない。`); p.projectCode = null; }
  return merged;
}

// ---------------------------------------------------------------- 美幌町: 事務事業評価調書（１次評価調書）
const BIHORO_VIEW = '妥当|検討|高い|普通|低い';
function bihoroSheet(input: CachedInput, raw: string, start: number, year: number, ordinalOfName: Map<string, number>): { key: string; record: ProjectEvaluation } | null {
  const nm = raw.match(/課・グループ名\n\n([^\n]+)\n/);
  if (!nm || /^(?:評 価 者 名|[０-９\d]|総 |予$)/.test(nm[1]) || nm[1].length > 40) return null;
  const name = nm[1].trim(), nameStart = start + nm.index! + '課・グループ名\n\n'.length;
  const dm = raw.match(/\n([^\s\n]+課[^\s\n]*グループ)\n/);
  const dept = dm?.[1] ?? null;
  const key = `${name}|${dept ?? ''}`;
  const ord = (ordinalOfName.get(key) ?? 0) + 1; ordinalOfName.set(key, ord);
  const p = project(input, `${key}#${ord}`, name, year, nm[1], nameStart);
  p.projectCode = null; p.department = dept;
  if (dm) p.evidence.push(evidence(input, dm[1], start + dm.index! + 1));
  const warnings = [BASE_WARNING + '１次評価調書。事業費は年度見出し6列と数値ブロック6個が対応し、かつ「事業費＝国＋道＋地方債＋その他＋一般財源」が成り立つ列だけ採用（単位：千円）。最終列（見込値）は除外。指標は単一行の指標名・単位・3年度分の目標/実績/達成率が整合する場合のみ。評価年度は表題の年度をそのまま保持（同調書に同年度の決算額を含む）。評価対象年度は本文に明示がないため未設定。'];
  // 年度別事業費
  const hdr = raw.match(/^((?:(?:平成|令和)\d\d年度(?:決算|予算) ?){6})$/m), evalIdx = raw.indexOf('３．評価');
  if (hdr && evalIdx > hdr.index!) {
    const labels = [...hdr[1].matchAll(/(平成|令和)(\d\d)年度(決算|予算)/g)];
    const blocks: { lines: string[]; start: number }[] = [];
    let pos = hdr.index! + hdr[0].length;
    for (const b of raw.slice(pos, evalIdx).split('\n\n')) {
      const ls = b.split('\n').filter(Boolean);
      if (ls.at(-1) === '（見込値）') ls.pop();
      const lead = b.length - b.trimStart().length;
      if (ls.length && ls.every(l => /^[\d,]+$/.test(l))) blocks.push({ lines: ls, start: pos + lead });
      pos += b.length + 2;
    }
    if (labels.length === 6 && blocks.length === 6) {
      for (let j = 0; j < 5; j++) {
        const v = blocks[j].lines.map(toNum);
        if (v.length !== 9 || v[0] !== v[1] + v[2] + v[3] + v[4] + v[5] || v[8] < v[0]) continue;
        const fy = (labels[j][1] === '平成' ? 1988 : 2018) + Number(labels[j][2]);
        const rawValue = blocks[j].lines[0];
        p.amounts.push({ kind: labels[j][3] === '決算' ? 'actual' : 'budget', fiscalYear: fy, amountYen: v[0] * 1000, rawValue, rawUnit: '千円', evidence: evidence(input, rawValue, start + blocks[j].start) });
      }
      if (p.amounts.length) p.evidence.push(evidence(input, hdr[1], start + hdr.index!));
    }
  }
  // 指標（指標１のみ・単一行名称・指標２/３空欄）
  const ind = raw.match(/指\n標\n１\n\n([^\n]+)\n\n目標\n実績\n達成率/);
  const tbl = raw.match(/((?:平成|令和)\d\d年度)\n\n((?:平成|令和)\d\d年度)\n\n((?:平成|令和)\d\d年度)\n\n((?:平成|令和)\d\d年度)\n\n((?:平成|令和)\d\d年度)\n\n([^\n\d％]+)\n([^\n\d％]+)\n％\n\n([\d,.]+)\n([\d,.]+)\n([\d,.]+)\n\n([\d,.]+)\n([\d,.]+)\n([\d,.]+)\n\n([\d,.]+)\n([\d,.]+)\n([\d,.]+)\n\n([\d,.]+)\n\n([\d,.]+)\n\n％\n\n％/);
  if (ind && tbl && tbl[6] === tbl[7]) {
    const years = tbl.slice(1, 6).map(y => (y.startsWith('平成') ? 1988 : 2018) + Number(y.slice(2, 4)));
    const triples = [[tbl[8], tbl[9], tbl[10]], [tbl[11], tbl[12], tbl[13]], [tbl[14], tbl[15], tbl[16]]];
    const consistent = triples.every(([t, a, r]) => toNum(t) === 0 ? true : Math.abs(toNum(a) / toNum(t) * 100 - toNum(r)) < 0.051);
    if (consistent) {
      const e = evidence(input, tbl[0], start + tbl.index!);
      triples.forEach(([t, a], i) => p.indicators.push({ name: ind[1], fiscalYear: years[i], target: t, actual: a, unit: tbl[6], evidence: e }));
      p.indicators.push({ name: ind[1], fiscalYear: years[3], target: tbl[17], actual: null, unit: tbl[6], evidence: e }, { name: ind[1], fiscalYear: years[4], target: tbl[18], actual: null, unit: tbl[6], evidence: e });
      p.evidence.push(evidence(input, ind[0], start + ind.index!));
    }
  }
  // 妥当性・有効性・効率性
  const triple = raw.match(new RegExp(`\\n評価\\n(${BIHORO_VIEW})\\n(${BIHORO_VIEW})\\n(${BIHORO_VIEW})\\n\\n理由`));
  if (triple) {
    const e = evidence(input, triple[0].slice(1), start + triple.index! + 1);
    ['妥当性', '有効性', '効率性'].forEach((label, i) => p.ratings.push({ kind: 'self', label, value: triple[i + 1], scale: null, evidence: e }));
  } else {
    for (const label of ['有効性', '効率性']) {
      const m = raw.match(new RegExp(`\\n${label}\\n(${BIHORO_VIEW})\\n`));
      if (m) p.ratings.push({ kind: 'self', label, value: m[1], scale: null, evidence: evidence(input, m[0].slice(1, -1), start + m.index! + 1) });
    }
  }
  // 評価結果（事業・予算の今後の方向性）
  const choose = (m: RegExpMatchArray | null, opts: string[], label: string) => {
    if (!m) return;
    const marks = m.slice(1, 5);
    if (marks.filter(x => x === '●').length !== 1) return;
    p.ratings.push({ kind: 'self', label, value: opts[marks.indexOf('●')], scale: opts.join('／'), evidence: evidence(input, m[0], start + m.index!) });
  };
  choose(raw.match(/([○●]) 拡充\n([○●]) 現状維持\n([○●]) 縮小\n([○●]) 休止・廃止/), ['拡充', '現状維持', '縮小', '休止・廃止'], '評価結果（事業）');
  choose(raw.match(/([○●]) 拡充\n([○●]) 現状維持\n([○●]) 縮小\n([○●])(?: |\n\n)皆減/), ['拡充', '現状維持', '縮小', '皆減'], '評価結果（予算）');
  p.warnings = warnings;
  if (!dept) p.warnings.push('課・グループ名が1行で取得できないため所管は未設定。');
  return { key: `${key}#${ord}`, record: p };
}
function extractBihoro(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01543') return [];
  const title = input.text.match(/^令和([０-９\d]+)年度事務事業評価調書\n（１次評価調書）/);
  if (!title) return [];
  const year = 2018 + kanjiDigits(title[1]);
  const starts = [...input.text.matchAll(/^令和[０-９\d]+年度\n\n事務事業評価調書\n/gm)].map(m => m.index!);
  const ordinal = new Map<string, number>(), out: ProjectEvaluation[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (input.truncated && i === starts.length - 1) continue;
    const s = starts[i], raw = input.text.slice(s, starts[i + 1] ?? input.text.length);
    const r = bihoroSheet(input, raw, s, year, ordinal);
    if (r) { r.record.evidence.push(evidence(input, title[0], 0)); out.push(r.record); }
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '01216': { extract: acrossInputs(extractAshibetsu), scope: '主要事務事業実施の状況及び事務事業評価結果の目次（令和3〜6年度、一般会計・特別会計）から、1行で読める事務事業名・款項目・所管部署名・総合判定を構造化。各款の個票の決算額・成果、平成30年度評価結果一覧・評価シートは列崩れのため対象外。' },
  '01559': { extract: acrossInputs(extractYubetsu), scope: '行政評価 総合評価集計表（令和4〜7年度）の事業別一覧から、整理番号・担当課・事務事業名と必要性等の評価区分コード・各次判定コードを構造化。直接事業費（見込）は金額として扱わず、令和3年度様式・外部評価報告書は対象外。' },
  '01543': { extract: acrossInputs(extractBihoro), scope: '事務事業評価調書（１次評価調書、令和3〜6年度）の個票から、事務事業名・課グループ・検算が通る年度別事業費・単一指標の目標実績・妥当性等と方向性を構造化。評価結果一覧（２次評価）・平成27〜29年度一覧は列崩れのため対象外。' },
};
