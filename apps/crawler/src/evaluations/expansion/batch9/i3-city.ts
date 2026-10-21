/** 市の事務事業評価: 42210 壱岐市（個別事業評価調書）、03206 北上市（事後評価結果一覧）、08203 土浦市（教育委員会 点検・評価報告シート）、04202 石巻市（評価結果一覧の事業名）。 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { BASE_WARNING, type Entry, acrossInputs, heisei, lines, reiwa, segments } from './i3-util';

// ---------------------------------------------------------------- 壱岐市
const IKI_INDEX = 'def9a70341e6fb3971cfe799';
const IKI_SHEETS = new Set(['038fe52d82ddf4be09ccb086', '1bc046cf157241e025300bc7', '4caca544b3c1f7c9b5ac7cc0', '4f92e5f89ee6f7ae8e4ed454',
  '4fbe4aa6e1c83d07d035e36d', '5af023bc553166e1422c33a1', '5e18466e2364d992b8a9ff39', '5f51a566f829c8f3c0bdab29', '7261fda75a677f89628ce7bb',
  '79705f96ac9df6352b4fa86d', '83393271edca2464dfcd22c7', '89901f6d8be060445c162f3d', 'a57b899a52290e71c4e3aebd', 'b9d1680a72b0b0d5ce8fb601',
  'c3d77245c8534cfb57c32ad7', 'd18e9af778ae6d29c7a0b029', 'd3c341f4351b61b8cc76cdeb', 'd6fa7a1f3dc592e36eb23063', 'fc7044ee0e3f45a9ebbb6fb1']);
const IKI_TITLE = '令和7年度事業事務事業評価結果（所管別）／壱岐市';
const IKI_SCALE = '判定平均点（3点満点）\nA=3、B=2、C=1、空白=0として換算';

/** 所管別一覧ページの「事業名」見出しから PDF リンク行までの事業名。 */
function ikiIndexNames(index: CachedInput): { name: string; at: number }[] {
  const out: { name: string; at: number }[] = [];
  let open = false;
  for (const l of lines(index.text)) {
    if (l.s === '事業名') { open = true; continue; }
    if (/PDFファイル/.test(l.s)) { open = false; continue; }
    if (open && l.s.trim()) out.push({ name: l.s, at: l.at });
  }
  return out;
}

function extractIki(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const index = inputs.find(i => i.sourceId === IKI_INDEX && i.text.startsWith(IKI_TITLE));
  if (!IKI_SHEETS.has(input.sourceId) || !index) return [];
  const names = ikiIndexNames(index), t = input.text, out: ProjectEvaluation[] = [];
  for (const { m, start, end } of segments(t, /令和 7 年度\n(?:事業名\n)?\n個別事業評価調書\n/g)) {
    const seg = t.slice(start, end), page1 = seg.slice(0, seg.indexOf('1／2') < 0 ? seg.length : seg.indexOf('1／2'));
    // 一覧の事業名のうち、調書1ページ目に1行として現れるもの（長い名称に含まれる短い名称は除く）が1つだけの場合。
    let hits = names.filter(n => page1.includes(`\n${n.name}\n`));
    hits = hits.filter(h => !hits.some(o => o.name !== h.name && o.name.includes(h.name)));
    if (new Set(hits.map(h => h.name)).size !== 1) continue;
    const hit = hits[0], at = start + page1.indexOf(`\n${hit.name}\n`) + 1;
    if (at - start > 400) continue;
    const p = project(input, `2025:${hit.name}`, hit.name, null, hit.name, at);
    p.projectCode = null; p.evaluatedFiscalYear = 2025;
    p.evidence.push(evidence(input, m[0].trim(), m.index!));
    const dept = [...page1.matchAll(/\n課名：\n\n([^\s：]{1,12}課)\n/g)];
    if (dept.length === 1) { p.department = dept[0][1]; p.evidence.push(evidence(input, dept[0][0].trim(), start + dept[0].index! + 1)); }
    const warnings = [BASE_WARNING + '令和7年度事業 事務事業評価結果（所管別一覧）に掲載された事業名と一致する個別事業評価調書。評価対象年度は調書表題の「令和 7 年度」と、事業名の照合に用いた所管別一覧ページ（https://www.city.iki.nagasaki.jp/soshiki/zaiseika/seisaku/16331.html）の表題「令和7年度事業事務事業評価結果」による（一覧ページは別資料のため根拠には含めていません）。'];
    const score = [...seg.matchAll(/\n(\d\.\d\d)\n\n2／2/g)];
    if (seg.includes(IKI_SCALE) && score.length === 1) {
      p.ratings.push({ kind: 'self', label: '判定平均点（3点満点）', value: score[0][1], scale: 'A=3、B=2、C=1、空白=0として換算',
        evidence: evidence(input, score[0][1], start + score[0].index! + 1) });
      p.evidence.push(evidence(input, IKI_SCALE, start + seg.indexOf(IKI_SCALE)));
      warnings.push('1次評価（所管部署）の各項目判定を換算した「判定平均点」のみ採用。各項目のＡ〜Ｃ判定・総合判定・2次評価は列の対応が崩れているため構造化していません。');
    } else warnings.push('判定平均点を特定できないため評価は構造化していません。');
    warnings.push('事業費の推移表は単位の記載が抽出テキストにないため金額は構造化していません。成果指標・活動指標も列の対応が崩れているため対象外。');
    p.warnings = warnings;
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 北上市（事務事業に係る事後評価の結果一覧）
const KITAKAMI: Record<string, true> = { '0dd160c4d0f151dae4ad4165': true, '7765b2504543ae56a953ac88': true, '9e578b2aff9af313294825fb': true };
const KITAKAMI_RESULTS = ['拡充', '継続', '縮小', '廃止・休止', '廃止', '休止', '完了', '統合'];

function extractKitakami(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!KITAKAMI[input.sourceId]) return [];
  const head = t.match(/^■(令和|平成)([０-９\d]+|元)年度事務事業に係る事後評価の結果一覧\(概要\)/);
  if (!head) return [];
  const fy = head[1] === '令和' ? reiwa(head[2]) : heisei(head[2]), out: ProjectEvaluation[] = [];
  const rows = segments(t, /\n\d{2}-\d{2}-\d{2} /g);
  for (const { start, end } of rows) {
    // 行末: 次の行の先頭（政策の基本目標の折返し1行）の直前が「会計名称」「評価結果」の2行。
    const ls = lines(t.slice(start, end), start).filter(l => l.s.trim());
    if (end < t.length) ls.pop();
    const result = ls.at(-1), account = ls.at(-2);
    if (!result || !account || !KITAKAMI_RESULTS.includes(result.s) || !/会計$/.test(account.s)) continue;
    const seg = t.slice(start, result.at + result.s.length);
    // 事業名の行に担当部課が続けて入った行（空白を含む行）は区切りが確定できないため除外。
    const nm = [...seg.matchAll(/\n\n(\d{1,4}) ([^\n\s]{2,40})\n\n/g)];
    if (nm.length !== 1) continue;
    const name = nm[0][2], at = start + nm[0].index! + 2;
    const p = project(input, `${fy}:${nm[0][1]}:${name}`, name, null, nm[0][0].trim(), at);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, head[0], 0));
    const dept = seg.slice(nm[0].index! + nm[0][0].length).match(/^([^\n ]+課) ([^\n ]+係)\n/);
    if (dept) { p.department = dept[1]; p.evidence.push(evidence(input, dept[0].trim(), start + nm[0].index! + nm[0][0].length)); }
    p.ratings.push({ kind: 'self', label: '評価結果(今後の方向性)', value: result.s, scale: null, evidence: evidence(input, `${account.s}\n\n${result.s}`, account.at) });
    p.warnings = [BASE_WARNING + `${head[1]}${head[2]}年度事務事業に係る事後評価の結果一覧（概要）の行。評価事業CD（${nm[0][1]}）と事業名が1行にある行のみ採用し、事業名が折り返す行は除外。評価結果は行末の会計名称の直後の値。担当課は「〇〇課 〇〇係」が1行にある場合のみ。評価事業CDは課をまたいで重複しうるため projectCode に入れていません。`];
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 土浦市（教育委員会 点検・評価報告シート）
const TSUCHIURA = new Set(['72c6270cd6d614035c8af546', '76481b08fb4ab5f139852cad', 'a212ae9e573872f4c650ae51', 'cf79ea0a0045f385d871a112', 'f89a678b4f7336e2c41c95a0']);
const TSU_LABELS = new Set(['事業名', '事 業 名', '担当課', '担 当 課', 'SDGｓ', 'SDGs', '事業目的', '事業内容', '']);
const TSU_DEPT = /^[^\s、。（]{1,14}(?:課|館|室|センター|所)(?:（[^）\n]+）)?$/;
const VALUE = /^[^\n]{0,20}[0-9０-９][^\n]{0,20}$/;

function extractTsuchiura(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!TSUCHIURA.has(input.sourceId)) return [];
  const head = t.match(/^教育に関する事務の管理及び執行の状況に係る\n点検・評価報告書\n（令和([０-９\d]+)年度分）/);
  if (!head) return [];
  const fy = reiwa(head[1]), out: ProjectEvaluation[] = [];
  const policies = new Set([...t.matchAll(/【基本方針[１-９\d]】([^\n]+?)(?: ?・{3,}[^\n]*)?$/gm)].map(m => m[1].trim()));
  const scale = t.match(/Ａ … 実績値が目標値に対して100%以上\nＢ …\n+〃\n+80～100%未満\n+Ｃ …\n+〃\n+80%未満/);
  for (const { start, end } of segments(t, /点検・評価報告シート（令和[０-９\d]+年度分）\n/g)) {
    const seg = t.slice(start, end);
    if (seg.includes('記載しています')) continue; // 様式の記入例
    const nameAt = seg.search(/\n事 ?業 ?名\n/);
    if (nameAt < 0) continue;
    // 表頭: 「事業名」から事業目的の本文（読点・句点を含む行または長い行）の直前まで。
    const head2: { s: string; at: number }[] = [];
    for (const l of lines(seg.slice(nameAt + 1), start + nameAt + 1)) {
      if (/[、。]/.test(l.s) || l.s.length > 30) break;
      head2.push(l);
    }
    const kept = head2.map((l, i) => ({ ...l, i })).filter(l => !TSU_LABELS.has(l.s.trim()) && !/^[ア-ン]$/.test(l.s) && !policies.has(l.s.trim()));
    const nameLines = kept.filter(l => !TSU_DEPT.test(l.s)), depts = kept.filter(l => TSU_DEPT.test(l.s) || /^[^\s]{1,10}課・[^\s]{1,10}課$/.test(l.s));
    if (!nameLines.length || nameLines.some((l, k) => k > 0 && l.i !== nameLines[k - 1].i + 1)) continue;
    // 名称の最終行の直後が読点を含む行なら名称が続いている（打ち切り）ため除外。
    if (nameLines.at(-1)!.i + 1 === head2.length) continue;
    // 先頭の項目記号（ア・イ…）は名称に含めない。
    if (/^[ア-ン] /.test(nameLines[0].s)) nameLines[0] = { ...nameLines[0], s: nameLines[0].s.slice(2), at: nameLines[0].at + 2 };
    const name = nameLines.map(l => l.s.trim()).join(''), raw = t.slice(nameLines[0].at, nameLines.at(-1)!.at + nameLines.at(-1)!.s.length);
    const deptLines = depts.filter(d => !nameLines.includes(d));
    const p = project(input, `${fy}:${name}`, name, null, raw, nameLines[0].at);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.department = deptLines.length ? deptLines.map(d => d.s.trim()).join('・') : null;
    p.evidence.push(evidence(input, head[0], 0), ...deptLines.map(d => evidence(input, d.s, d.at)));
    const warnings = [BASE_WARNING + `教育委員会 点検・評価報告書（令和${head[1]}年度分）の点検・評価報告シート。事業名は表頭のラベル・基本方針名・担当課以外の連続した行（複数行は連結）。文字化けしたページは対象外。`];
    // 成果指標: 「目標値／実績値／評価」の後に「指標名・目標値・実績値・評価」が並ぶ形、または指標名が「指標」の直後にある1件の形。
    const ix = seg.indexOf('目標値\n\n実績値\n\n評価\n\n');
    if (ix >= 0) {
      let pos = ix + '目標値\n\n実績値\n\n評価\n\n'.length;
      const found: { name: string; target: string; actual: string; rating: string; at: number; raw: string }[] = [];
      const single = seg.slice(0, ix).match(/\n指標\n([^\n]+)\n\n課題及び\n今後の\n取組の\n方向性\n\n$/);
      const one = seg.slice(pos).match(/^([^\n]+)\n\n([^\n]+)\n\n([ＡＢＣ])\n/);
      if (single && one && VALUE.test(one[1]) && VALUE.test(one[2]))
        found.push({ name: single[1], target: one[1], actual: one[2], rating: one[3], at: start + ix - single[0].length + 1, raw: seg.slice(ix - single[0].length + 1, pos + one[0].length - 1) });
      else for (;;) {
        const r = seg.slice(pos).match(/^([^\n]+)\n\n([^\n]+)\n\n([^\n]+)\n\n([ＡＢＣ])\n/);
        if (!r || VALUE.test(r[1]) || !VALUE.test(r[2]) || !VALUE.test(r[3])) break;
        found.push({ name: r[1], target: r[2], actual: r[3], rating: r[4], at: start + pos, raw: r[0].slice(0, -1) });
        pos += r[0].length + 1;
        if (seg[pos - 1] !== '\n') break;
      }
      for (const f of found) {
        const e = evidence(input, f.raw, f.at);
        p.indicators.push({ name: f.name, fiscalYear: fy, target: f.target, actual: f.actual, unit: null, evidence: e });
        if (scale) p.ratings.push({ kind: 'self', label: `成果指標の評価（${f.name}）`, value: f.rating, scale: 'Ａ…実績値が目標値に対して100%以上／Ｂ…80～100%未満／Ｃ…80%未満', evidence: e });
      }
      if (found.length && scale) p.evidence.push(evidence(input, scale[0], scale.index!));
      if (found.length) warnings.push(`成果指標は令和${head[1]}年度の目標値・実績値（単位は原文の値に含む）と評価（Ａ〜Ｃ）。指標名が折り返す行は構造化していません。`);
    }
    p.warnings = warnings;
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- 石巻市（行政評価結果一覧〈最終評価結果〉の事業名のみ）
const ISHINOMAKI = new Set(['a0b09ebd4a49eb9bb60f65d5', 'd5ded852822da4d1c2a01669']);

function extractIshinomaki(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!ISHINOMAKI.has(input.sourceId)) return [];
  const target = t.match(/石巻市行政評価（事務事業評価）結果一覧\n（対象：令和([０-９\d]+)年度実施事業）/);
  const cycle = t.match(/令和([０-９\d]+)年度行政評価（事務事業評価）結果一覧〈最終評価結果〉/);
  if (!target || !cycle) return [];
  const fy = reiwa(target[1]), evalYear = reiwa(cycle[1]), out: ProjectEvaluation[] = [];
  // 政策体系と事業名が別行の形は、事業名の折返し（後半だけの行）と区別できないため対象外。
  for (const m of t.matchAll(/\n(\d{1,3})\n\n(\d-\d-\d) ([^\n]{2,30}事業)\n\n/g)) {
    const name = m[3];
    const p = project(input, `${fy}:${m[1]}`, name, evalYear, m[0].trim(), m.index! + 1);
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, target[0], target.index!), evidence(input, cycle[0], cycle.index!));
    p.warnings = [BASE_WARNING + `令和${cycle[1]}年度 行政評価（事務事業評価）結果一覧〈最終評価結果〉（対象：令和${target[1]}年度実施事業）のうち、No.・政策体系・事務事業名が1行にそろう行の事業名のみ。成果指標・定性評価・総合評価・担当課は列が行から分離して並ぶため構造化していません。`];
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '42210': { extract: acrossInputs(extractIki), scope: '令和7年度事業の個別事業評価調書（所管別PDF）のうち、所管別一覧の事業名と一致する調書の事業名・課名・判定平均点を構造化。各項目判定・2次評価・事業費（単位記載なし）・指標は対象外。' },
  '03206': { extract: acrossInputs(extractKitakami), scope: '事務事業に係る事後評価の結果一覧（平成30年度・令和元年度・令和2年度）で評価事業CDと事業名が1行にそろう行の事業名・担当課・評価結果(今後の方向性)を構造化。事業名が折り返す行・個別評価シート・基本施策評価は対象外。' },
  '08203': { extract: acrossInputs(extractTsuchiura), scope: '教育委員会 点検・評価報告書（令和3〜7年度分）の点検・評価報告シートの事業名・担当課・成果指標（目標値・実績値・Ａ〜Ｃ評価）を構造化。文字化けしたページ・記入例・活動状況・有識者意見は対象外。' },
  '04202': { extract: acrossInputs(extractIshinomaki), scope: '行政評価（事務事業評価）結果一覧〈最終評価結果〉（令和7・8年度）のうちNo.・政策体系・事業名が1行にそろう行の事業名と年度のみ構造化。評価・指標・担当課は列が分離するため対象外。令和3・4年度一覧と総括資料も対象外。' },
};
