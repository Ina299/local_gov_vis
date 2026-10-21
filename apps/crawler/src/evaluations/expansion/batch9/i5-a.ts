import type { EvaluationIndicator, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints } from '../batch7/g1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const KAMOGAWA_SHEETS = new Set(['1b9e740afa386277be32e3a2', '415d09a254eec0dead4d2dc3', '481551a59ebcc7e3c5810cc4', '522514a144cfdaf542412504',
  '589b76a381a7311155beabcc', '5a952e4f6b2b3d70892f39a8', '84e57f6c4f9c4527f0dee24f', '88f49cf658ebf69b6c2c1883', 'a6b3a3d2733e9b1c7266f236',
  'ce1d2d879e42714799cde7ed', 'd91bb2edd95883bcc7328272', 'f0f97af9b1dcc03971239e40']);
const KAMOGAWA_OPTIONS = ['1不要・凍結', '2国・県・広域が実施', '3要改善', '4現行どおり・拡充'];
const KAMOGAWA_SCALE = '1不要・凍結／2国・県・広域が実施／3要改善／4現行どおり・拡充';

/** 款別PDF冒頭の一覧表の行（通番・款・項・目・事業コード・事業名・R7予算事業名・担当課・ページ）。 */
function kamogawaRows(input: CachedInput): RegExpMatchArray[] {
  const firstSheet = input.text.indexOf('予算科目（款項目）');
  if (firstSheet < 0) return [];
  const row = /\n\n(\d{3})(?:\n\n| )(\d+)(?:\n\n| )(\d+)(?:\n\n| )(\d+) \[(\d{8})\]\d? 一般会計 ([^\n]+)\n\n(?:([^\n]*[^課局室所館ー\n])\n\n)?([^\n]*(?:課|局|室|所|センター|館))\n\n(\d+)(?=\n)/g;
  return [...input.text.slice(0, firstSheet).matchAll(row)];
}

/**
 * 鴨川市 行政事業レビュー 事業シート（令和７年度決算ベース・令和８年６月作成）。
 * 各款PDF冒頭の一覧表の行（通番・事業コード・事業名・担当課）を単位とし、同じ事業コードと事業名を見出しに持つシートの自己評価（選択肢）を付ける。
 */
function extractKamogawa(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const title = '事業シート（令和７年度決算ベース。令和８年６月作成。）';
  if (input.municipalityCode !== '12223' || !KAMOGAWA_SHEETS.has(input.sourceId) || !input.text.startsWith(title)) return [];
  const t = input.text, firstSheet = t.indexOf('予算科目（款項目）');
  if (firstSheet < 0) return [];
  const starts = [...t.matchAll(/予算科目（款項目）/g)].map(m => m.index!);
  const pages = starts.map((s, i) => ({ start: s, text: t.slice(s, starts[i + 1] ?? t.length) }));
  const rows = kamogawaRows(input);
  const seen = new Map<string, number>();
  for (const m of rows) seen.set(`${m[5]}:${m[6]}`, (seen.get(`${m[5]}:${m[6]}`) ?? 0) + 1);
  // 同名・同担当課の行が複数ある場合（繰越分など、款別PDFをまたぐものを含む）は同一事業か別事業かを本文で確定できないため除外。
  const names = new Map<string, number>();
  for (const other of inputs) if (KAMOGAWA_SHEETS.has(other.sourceId) && other.text.startsWith(title))
    for (const m of kamogawaRows(other)) names.set(`${m[6]}:${m[8]}`, (names.get(`${m[6]}:${m[8]}`) ?? 0) + 1);
  const out: ProjectEvaluation[] = [];
  for (const m of rows) {
    const [, serial, , , , code, name, , dept] = m;
    if ((names.get(`${name}:${dept}`) ?? 0) > 1) continue;
    const raw = m[0].slice(2), s = m.index! + 2;
    const p = project(input, `${code}-${serial}`, name, null, raw, s);
    p.department = dept; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, title, 0));
    // 自己評価: 選択肢の凡例（3要改善・4現行どおり・拡充）を1つずつ除いた残りの選択肢行が1つだけのときのみ採用。
    const sheets = pages.filter(pg => {
      const h = pg.text.indexOf('事業シート（概要説明書）');
      return h >= 0 && pg.text.slice(0, h).includes(`[${code}]`) && pg.text.slice(h, h + 300).includes(`\n${name}\n`);
    });
    const found: { value: string; raw: string; start: number }[] = [];
    for (const pg of sheets) {
      const a = pg.text.indexOf('1不要・凍結 2国・県・広域が実施\n');
      if (a < 0) continue;
      const b = pg.text.indexOf('\n業\n', a);
      if (b < 0) continue;
      const lines = pg.text.slice(a, b).split('\n').slice(1).filter(l => KAMOGAWA_OPTIONS.includes(l));
      for (const legend of ['3要改善', '4現行どおり・拡充']) { const i = lines.indexOf(legend); if (i >= 0) lines.splice(i, 1); }
      if (lines.length === 1) found.push({ value: lines[0], raw: pg.text.slice(a, b), start: pg.start + a });
      else found.push({ value: '', raw: '', start: -1 });
    }
    const values = new Set(found.map(f => f.value));
    if (seen.get(`${code}:${name}`) === 1 && found.length && values.size === 1 && found[0].value) {
      p.ratings.push({ kind: 'self', label: '事業の自己評価（担当課による評価）', value: found[0].value, scale: KAMOGAWA_SCALE, evidence: evidence(input, found[0].raw, found[0].start) });
      for (const f of found.slice(1)) p.evidence.push(evidence(input, f.raw, f.start));
    }
    p.warnings.push(`事業シート（令和７年度決算ベース）の款別PDF冒頭の一覧表の1行から通番・事業コード・事業名・担当課を収録（projectCode は「事業コード-通番」）。評価対象年度は資料見出しの「令和７年度決算ベース」による。評価年度は本文に明記がなく（作成時期 令和8年6月のみ）未設定。自己評価は同じ事業コード・事業名のシートで選択肢が1つに特定できる場合のみ収録し、凡例と選択値の並びが崩れたシート・同一コード同名の事業が複数ある行・本文が12万字で打ち切られて該当シートがない行は評価なし。事業費・人件費・指標は抽出テキストで列（年度・決算/見込）の対応が崩れているため未収録。同名・同担当課の行が複数ある事業（繰越分など）は同一事業か別事業か確定できないため除外。${p.ratings.length ? '' : '（この行は自己評価を特定できず未収録）'}`);
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

const AKISHIMA_SCALE = 'A 成果拡大に向けて実施方法を見直し／B コスト改善に向けて実施方法を見直し／C 抜本的な見直し／D 縮小・廃止／E 現状を維持／F 事業完了／※事業を分割';

/** 昭島市 令和７年度事務事業評価（令和６年度実施事業）表紙・目次・対象事業一覧の「評価対象事業一覧」の行。 */
function extractAkishima(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== '20689f1b692f09d8bc15089b') return [];
  const title = '令和７年度昭島市事務事業評価（令和６年度実施事業）';
  const legend = '今後の方向性\nA 成果拡大に向けて実施方法を見直し\nB コスト改善に向けて実施方法を見直し\nC 抜本的な見直し\nD 縮小・廃止\nE 現状を維持\nF 事業完了\n※事業を分割';
  if (!input.text.startsWith(title) || !input.text.includes(legend)) return [];
  const t = input.text, listStart = t.indexOf('評価対象事業一覧\n事業名');
  if (listStart < 0) return [];
  const table = t.slice(listStart), out: ProjectEvaluation[] = [], keys = new Map<ProjectEvaluation, string>();
  const row = /\n\n(\d+(?:-\d+)?) ([^\n]+)\n\n([^\n]+)\n\n(\d-[①-⑳]-[\d,]+)\n\n([A-F]|事業を分割)(?=\n)(\n\n[^\n]*特別会計(?=\n))?/g;
  for (const m of table.matchAll(row)) {
    const [, no, name, dept, , dir] = m;
    const note = m[6]?.slice(2) ?? null;
    const raw = m[0].slice(2), s = listStart + m.index! + 2;
    const p = project(input, `評価事業${no}`, name, 2025, raw, s);
    p.department = dept; p.evaluatedFiscalYear = 2024;
    p.ratings.push({ kind: 'self', label: '今後の方向性', value: dir, scale: AKISHIMA_SCALE, evidence: evidence(input, raw, s) });
    p.evidence.push(evidence(input, title, 0), evidence(input, legend));
    p.warnings.push(`評価対象事業一覧の1行から番号・事業名・所属・今後の方向性を収録${note ? `（備考 ${note}）` : ''}。評価年度・評価対象年度は表紙の「令和７年度昭島市事務事業評価（令和６年度実施事業）」による。一覧2ページ目の備考（再掲の注記）は行と離れて抽出されるため未収録で、再掲行（基本施策が異なる同一事業）は所属・事業名・備考が同じ場合に1件へ統合。事業費・指標・評価点は大綱別PDFの評価シートにあるが、抽出テキストで列の対応が崩れているため未収録。`);
    out.push(p); keys.set(p, `${dept}:${name}:${note ?? ''}`);
  }
  // 統合後も同じ所属・事業名が残る行（会計が異なる健康維持増進事業など）は別事業の可能性があり、同一性を確定できないため除外。
  const merged = mergeReprints(out, p => keys.get(p)!), count = new Map<string, number>();
  for (const p of merged) count.set(`${p.department}:${p.projectName}`, (count.get(`${p.department}:${p.projectName}`) ?? 0) + 1);
  return merged.filter(p => count.get(`${p.department}:${p.projectName}`) === 1);
}

const MITANE_EFFECT = ['非常に効果的であった', 'やや効果的であった', '相当程度効果があった', '効果がほとんどなかった', '効果がなかった'];
const MITANE_POLICY = ['さらに発展させるべき（拡大）', '効果があるので継続', '内容の見直しが必要（改善）', '効果が見込めないため廃止'];
const MITANE_YEARS: Record<string, { fy: number; title: string }> = {
  '9b031b4a10e089bac78d7b7d': { fy: 2021, title: '三種町みらい創造プラン 令和３年度事業検証シート' },
  'd0d6cbfff0adcffb89d1d486': { fy: 2022, title: '令和４年度事業 三種町みらい創造プラン 事業検証シート' },
  'cc2ead67948ca66df7464449': { fy: 2023, title: '令和5年度事業 三種町みらい創造プラン 事業検証シート' },
};
const MITANE_R5_STAFF = 'A このまま継続／B 改善して継続／C 廃止または中止';

/** 三種町 みらい創造プラン 事業検証シート（令和3〜5年度事業）の各シート: 名称・事業番号・担当課と審議会評価（■印）。 */
function extractMitaneOld(input: CachedInput): ProjectEvaluation[] {
  const y = MITANE_YEARS[input.sourceId];
  if (!y || !input.text.startsWith(y.title)) return [];
  const t = input.text, starts = [...t.matchAll(/１．基本事項\n/g)].map(m => m.index!);
  // 令和5年度は冒頭に審議会検証事業の一覧（担当課評価・審議会評価）がある。
  const summary = new Map<string, { staff: string; effect: string; policy: string; dept: string; raw: string; start: number }>();
  if (y.fy === 2023) {
    const end = t.indexOf('【評価区分】');
    for (const m of t.slice(0, end < 0 ? 0 : end).matchAll(/\n\n(\d+)(?:\n\n| )(\d+)(?:\n\n| )([^\n]+)\n\n([^\n]+)\n\n([A-C])\n\n([A-E])\n\n([A-D])(?=\n)/g))
      summary.set(m[2], { staff: m[5], effect: m[6], policy: m[7], dept: m[4], raw: m[0].slice(2), start: m.index! + 2 });
  }
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, i) => {
    const block = t.slice(s, starts[i + 1] ?? t.length);
    const head = block.match(/^１．基本事項\n(?:計画種別\n\n)?(?:([\d･・]+)\n\n事業番号\n\n担当課名|事業番号\n\n([\d･・]+)\n\n担当課名)\n\n([^\n]+)\n/);
    const nm = block.match(/２．概 要\n名称\n\n([^\n]+)\n\nPlan/);
    if (!head || !nm) return;
    const no = head[1] ?? head[2], dept = head[3];
    if (!/(?:課|所|委員会|局|室)$/.test(dept)) return;
    const name = nm[1], nameStart = s + nm.index! + nm[0].indexOf(name);
    const p = project(input, `事業番号${no}`, name, null, block.slice(0, head[0].length), s);
    p.department = dept; p.evaluatedFiscalYear = y.fy;
    p.evidence.push(evidence(input, name, nameStart), evidence(input, y.title, 0));
    const e7 = block.indexOf('７．評価'), e8 = block.indexOf('全体評価', e7);
    let effect: string | null = null, policy: string | null = null;
    if (e7 >= 0 && e8 > e7) {
      const sec = block.slice(e7, e8), secStart = s + e7;
      const marks = [...sec.matchAll(/■ \(([A-E])\)([^\n]+)/g)];
      const eff = marks.filter(m => MITANE_EFFECT.includes(m[2])), pol = marks.filter(m => MITANE_POLICY.includes(m[2]));
      if (eff.length === 1 && pol.length === 1 && marks.length === 2) {
        effect = eff[0][1]; policy = pol[0][1];
        p.ratings.push({ kind: 'external', label: '審議会評価 事業効果・評価', value: `(${eff[0][1]})${eff[0][2]}`, scale: MITANE_EFFECT.map((l, k) => `(${'ABCDE'[k]})${l}`).join('／'), evidence: evidence(input, eff[0][0], secStart + eff[0].index!) });
        p.ratings.push({ kind: 'external', label: '審議会評価 今後の方針', value: `(${pol[0][1]})${pol[0][2]}`, scale: MITANE_POLICY.map((l, k) => `(${'ABCD'[k]})${l}`).join('／'), evidence: evidence(input, pol[0][0], secStart + pol[0].index!) });
      }
    }
    const sm = summary.get(no);
    let staffNote = '担当課の一次評価（総合評価）は評価欄と評価区分の並びが崩れているため未収録。';
    if (sm && sm.dept === dept && effect && sm.effect === effect && sm.policy === policy) {
      p.ratings.push({ kind: 'self', label: '担当課評価', value: sm.staff, scale: MITANE_R5_STAFF, evidence: evidence(input, sm.raw, sm.start) });
      p.evidence.push(evidence(input, sm.raw, sm.start));
      staffNote = '担当課評価は冒頭の審議会検証事業一覧の行（事業番号・担当課・審議会評価がシートと一致する行）から収録。';
    }
    p.warnings.push(`事業検証シート（令和${y.fy - 2018}年度事業）の1枚から名称・事業番号・担当課と審議会評価（■印が各1つの場合のみ）を収録。評価対象年度は資料見出しによる。評価年度（審議会の実施年度）は本文に明記がなく未設定。${staffNote}経費は予算・決算の別が明記されないため、KPIは列の並びが崩れているため未収録。`);
    out.push(p);
  });
  return mergeReprints(out, p => `${p.projectCode}:${p.projectName}`);
}

const MITANE_R7_STAFF = 'A 拡大／B 維持／C 改善／D 廃止又は中止';
const MITANE_R7_EFFECT = 'A 非常に効果的であった／B 相当程度の効果があった／C 効果がほとんどなかった／D 効果がなかった';
const MITANE_R7_POLICY = 'A さらに発展させるべき（拡大）／B 効果があるので継続／C 内容の見直しが必要（改善）／D 効果が見えないので廃止';

/** 令和7年度事業の検証シート「４－１ 事業の目標達成状況」: R6・R7の目標/実績が4列そろって読める場合のみ。 */
function mitaneTargets(input: CachedInput, sec: string, secStart: number): EvaluationIndicator[] | null {
  const raw = sec, ev = evidence(input, raw, secStart);
  const make = (name: string, v: string[]): EvaluationIndicator[] => [
    { name, fiscalYear: 2024, target: v[0], actual: v[1], unit: null, evidence: ev },
    { name, fiscalYear: 2025, target: v[2], actual: v[3], unit: null, evidence: ev }];
  const okValue = (v: string) => v.length > 0 && !v.includes('\n') && !/^[-ー－]$/.test(v);
  const header = 'R6\n\n指標\n\nR7\n\n目標\n\n実績\n\n目標\n\n実績\n\n';
  const a = sec.match(/^R6\n\n指標\n([^\n]+(?:\n[^\n]+)?)\n\nR7\n\n目標\n\n実績\n\n目標\n\n実績\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n$/);
  if (a) return [a[2], a[3], a[4], a[5]].every(okValue) ? make(a[1].replaceAll('\n', ''), [a[2], a[3], a[4], a[5]]) : null;
  if (!sec.startsWith(header)) return null;
  const tokens = sec.slice(header.length).replace(/\n\n$/, '').split('\n\n');
  if (!tokens.length || tokens.length % 5 !== 0) return null;
  const out: EvaluationIndicator[] = [];
  for (let k = 0; k < tokens.length; k += 5) {
    const [name, ...v] = tokens.slice(k, k + 5);
    if (!okValue(name) || /^[\d,.%]+$/.test(name) || !v.every(okValue)) return null;
    out.push(...make(name, v));
  }
  return out;
}

/** 三種町 令和７年度事業 みらい創造プラン 事業検証シート: シート見出し＋冒頭一覧の評価（担当課評価・審議会評価）＋目標達成状況。 */
function extractMitaneR7(input: CachedInput): ProjectEvaluation[] {
  // kenshoshitoR7.pdf（fe8dd590…）は同一ハッシュの別URLのため kenshoushitoR7.pdf からのみ収録。
  if (input.sourceId !== 'b6740bb5db1207b1861bc0d4') return [];
  const title = '令和７年度事業 三種町みらい創造プラン 事業検証シート\n（みらい創造プラン等審議会検証事業分）';
  if (!input.text.startsWith(title)) return [];
  const t = input.text, legendAt = t.indexOf('【評価区分】');
  if (legendAt < 0) return [];
  const summary = new Map<string, { name: string; dept: string; staff: string; effect: string; policy: string; raw: string; start: number }>();
  for (const m of t.slice(0, legendAt).matchAll(/\n\n(\d+)\n\n(\d+)(?:\n\n| )([^\n]+)\n\n([^\n]+)\n\n([A-D])\n\n([A-D])\n\n([A-D])(?=\n)/g))
    summary.set(m[2], { name: m[3], dept: m[4], staff: m[5], effect: m[6], policy: m[7], raw: m[0].slice(2), start: m.index! + 2 });
  const legendEv = evidence(input, '【評価区分】', legendAt);
  const out: ProjectEvaluation[] = [];
  const starts = [...t.matchAll(/１．基本事項\n名\n\n事業番号\n称\n\nR6\n\n(\d+)\n\nR7\n\n担当課名\n\n●\n\n([^\n]+)\n\n([^\n]+)\n/g)];
  starts.forEach((m, i) => {
    const [head, no, dept, name] = m, s = m.index!, block = t.slice(s, starts[i + 1]?.index ?? t.length);
    const p = project(input, `事業番号${no}`, name, null, head, s);
    p.department = dept; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, title, 0));
    const sm = summary.get(no);
    const notes: string[] = [];
    if (sm && sm.name === name && sm.dept === dept) {
      const ev = evidence(input, sm.raw, sm.start);
      p.ratings.push({ kind: 'self', label: '担当課評価（総合評価）', value: sm.staff, scale: MITANE_R7_STAFF, evidence: ev });
      p.ratings.push({ kind: 'external', label: '審議会評価 事業効果・評価', value: sm.effect, scale: MITANE_R7_EFFECT, evidence: ev });
      p.ratings.push({ kind: 'external', label: '審議会評価 今後の方針', value: sm.policy, scale: MITANE_R7_POLICY, evidence: ev });
      p.evidence.push(legendEv);
      notes.push('評価は冒頭の審議会検証事業一覧の行（事業番号・事業名・担当課がシートと一致する行）から収録し、区分は同資料の【評価区分】による。');
    } else notes.push('冒頭一覧の該当行が崩れているか事業番号・担当課がシートと一致しないため評価は未収録。');
    const a = block.indexOf('４－１ 事業の目標達成状況\n'), b = block.indexOf('４－２', a);
    if (a >= 0 && b > a) {
      const secStart = s + a + '４－１ 事業の目標達成状況\n'.length;
      const ind = mitaneTargets(input, t.slice(secStart, s + b), secStart);
      if (ind) { p.indicators.push(...ind); notes.push('事業の目標達成状況はR6・R7の目標/実績を原文表記のまま収録（単位は値に含まれるため unit は未設定）。'); }
      else notes.push('事業の目標達成状況は列の並びが崩れているか空欄のため未収録。');
    }
    p.warnings.push(`令和７年度事業 事業検証シートの1枚から事業番号・事業名・担当課を収録。評価対象年度は資料見出し「令和７年度事業」による。評価年度は本文に明記がなく未設定。${notes.join('')}コスト（経費）は単位・予算/決算の別が明記されないため、KPIは列の並びが崩れているため未収録。`);
    out.push(p);
  });
  return mergeReprints(out, p => p.projectCode!);
}

function extractMitane(input: CachedInput): ProjectEvaluation[] {
  return [...extractMitaneOld(input), ...extractMitaneR7(input)];
}

export const entries: Record<string, Entry> = {
  '12223': { extract: extractKamogawa, scope: '行政事業レビュー 事業シート（令和７年度決算ベース、款別PDF）冒頭一覧表の行から通番・事業コード・事業名・担当課と、同コード・同名シートの自己評価（4択の選択値が特定できる場合のみ）を構造化。事業費・人件費・指標、予算のない事業のPDF（一覧に事業コードなし）、事業シートの見方は対象外。保存本文が12万字で打ち切られた款は後半のシートの評価を欠く。' },
  '13207': { extract: extractAkishima, scope: '令和７年度事務事業評価（令和６年度実施事業）表紙・目次・対象事業一覧PDFの評価対象事業一覧の行（番号・事業名・所属・今後の方向性）を構造化。大綱別PDFの評価シート（事業費・評価点・総合評価文）は列の対応が崩れているため対象外。' },
  '05348': { extract: extractMitane, scope: 'みらい創造プラン事業検証シート（令和3・4・5・7年度事業）の各シートから事業名・事業番号・担当課、審議会評価（令和3〜5年度は■印、令和7年度・令和5年度担当課評価は冒頭一覧の行で照合したもの）と令和7年度の目標達成状況（R6・R7目標/実績）を構造化。経費（予算/決算の別が不明）、KPI表、事業結果一覧表・総括・計画本文は対象外。' },
};
