import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import type { Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

// ---------------------------------------------------------------- 石岡市 令和７年度 事務事業評価シート（部局別PDF。batch11 で新規取得）
// 様式は batch7 g2-ishioka.ts（令和８年度版）と同じ。年度列だけ1年ずれる（令和4〜6年度=過年度、令和7年度=現年度）。
const ISHIOKA = new Set(['0fbe3d1bd797e3aa6dc41a26', '1443c99c5509f4d000824a47', '3b9a543ab48dd33974e3e99e', '66ee7db666effc46bf9c6359',
  '78f0ed415249e7da5f219131', '9132d5ce39d07c5850828cfe', 'a3bf911a0b454a9f0956f030', 'c09c5693464cbdd77a9da759', 'c1d70b1c194547be88edd453',
  'c20c28bee98a6f7fd2232476', 'd7063c1f5f8a7847a087dcac', 'd97d284a4cc4d0b5fb6abecf', 'f4a3bccb352e7e93d044a8d3']);
/** 記入説明（「全体について」）。評価対象年度の根拠に使う。 */
const ISHIOKA_GUIDE = '1f2a37d41bfbc9b8fdb1574d';
const GUIDE_TEXT = '・令和６年度に実施した事業を対象としています。';
const SHEET = /(?:^|\n\n)令和７年度\n\n(?:事業名\n\n)?事務事業評価シート\n(?!【)/g;
const NUM = '-?[\\d,]+';
const YEARS = '2\\.投入量（インプット）\\n年度\\n\\n（単位：千円）\\n令和4年度\\n（過年度）\\n\\n令和5年度\\n（過年度）\\n\\n令和6年度\\n（過年度）\\n\\n令和7年度\\n（現年度）\\n\\n';
const FIN = `((?:${NUM}\\n){6}\\n(?:${NUM}\\n){6}\\n(?:${NUM}\\n){6}\\n)`;
const BUD_LABELS = '義務的経費\\n一般行政経費\\n政策的経費\\n公共施設経費\\n補 正 等\\n前年度から繰越\\n次年度へ繰越\\n予算額計\\(B\\)\\n\\n';
const BUD = `((?:(?:${NUM}\\n){8}\\n){4})`;
const REST = '執行率\\(A/B\\)\\n\\n((?:[\\d.]+%\\n\\n){4})職員数\\(人\\)\\n人件費\\(C\\)\\n会計年度任用職員\\(人\\)\\nフルコスト\\(A\\+C\\)\\n\\n((?:(?:[\\d.,]+\\n){4}\\n){3})';
// 2通りの並び: (1) 財源区分の見出し→値、(2) 年度見出しの直後に決算額の値（見出しは後置）。
const INPUTS = [
  new RegExp(YEARS + '(?:（\\n財\\n決\\n源\\n算\\n区\\n額\\n）分\\n\\n)?国庫支出金\\n県 支 出 金\\n地 方 債\\nそ の 他\\n一 般 財 源\\n決算額計\\(A\\)\\n\\n' + FIN +
    '(?:（\\n経\\n予\\n費\\n算\\n区\\n額\\n）分\\n\\n)?' + BUD_LABELS + BUD + REST),
  new RegExp(YEARS + FIN + BUD_LABELS + BUD + REST),
];
const OPTIONS = ['継続実施（変更なし）', '見直し検討', '事業終了'];
const norm = (s: string) => s.normalize('NFKC').replace(/\s/g, '');
const n = (s: string) => Number(s.replaceAll(',', ''));
const groups = (block: string, size: number) => { const v = block.split('\n').filter(Boolean), out: string[][] = []; for (let i = 0; i < v.length; i += size) out.push(v.slice(i, i + size)); return out; };

function tocOf(input: CachedInput) {
  const first = input.text.search(SHEET), head = first < 0 ? input.text : input.text.slice(0, first);
  return [...head.matchAll(/(?<=\n)(\d+)\n\n([^\n]+)\n\n([^\n]+)\n\nP(\d+)\n/g)].map(m => ({ name: m[3], dept: m[2], page: Number(m[4]), raw: m[0], start: m.index! }));
}

function addAmounts(input: CachedInput, p: ProjectEvaluation, seg: string, offset: number): boolean {
  const hits = INPUTS.map(re => re.exec(seg)).filter((m): m is RegExpExecArray => !!m);
  if (hits.length !== 1) return false;
  const m = hits[0];
  const fin = groups(m[1], 6), bud = groups(m[2], 8), rate = m[3].split('\n').filter(Boolean), per = groups(m[4], 4);
  if (fin.length !== 3 || bud.length !== 4 || rate.length !== 4 || per.length !== 3) return false;
  // 財源計＝決算額計(A)、予算額計(B)＝各経費＋補正＋前年度繰越−次年度繰越、執行率＝A/B、フルコスト＝A＋人件費(C) が全列で成り立つ場合のみ採用。
  for (const f of fin) if (f.slice(0, 5).reduce((s, x) => s + n(x), 0) !== n(f[5])) return false;
  for (const b of bud) if (b.slice(0, 6).reduce((s, x) => s + n(x), 0) - n(b[6]) !== n(b[7])) return false;
  for (let i = 0; i < 3; i++) {
    const a = n(fin[i][5]), b = n(bud[i][7]);
    if (!b || Math.abs(a / b * 100 - Number(rate[i].replace('%', ''))) > 0.006) return false;
    if (a + n(per[i][1]) !== n(per[i][3])) return false;
  }
  const ev = evidence(input, m[0], offset + m.index);
  const add = (kind: 'actual' | 'budget' | 'personnel' | 'fullCost', fy: number, raw: string) =>
    p.amounts.push({ kind, fiscalYear: fy, amountYen: n(raw) * 1000, rawValue: raw, rawUnit: '千円', evidence: ev });
  for (let i = 0; i < 3; i++) add('actual', 2022 + i, fin[i][5]);
  for (let i = 0; i < 4; i++) add('budget', 2022 + i, bud[i][7]);
  for (let i = 0; i < 3; i++) { add('personnel', 2022 + i, per[i][1]); add('fullCost', 2022 + i, per[i][3]); }
  return true;
}

function addDirection(input: CachedInput, p: ProjectEvaluation, seg: string, offset: number) {
  const s = seg.indexOf('事業の方向性 ');
  if (s < 0 || seg.indexOf('事業の方向性 ', s + 1) >= 0) return;
  const e = seg.indexOf('事業終了', s);
  if (e < 0) return;
  const raw = seg.slice(s, e + 4), marks = [...raw.matchAll(/[●○]/g)].map(m => m[0]);
  // ●/○ と選択肢以外の文字（今後の方向性の記述など）が挟まる崩れた並びは採らない。
  if (!/^事業の方向性 [●○]\n\n継続実施（変更なし）\n\n[●○]\n\n見直し検討\n\n[●○]\n\n事業終了$/.test(raw)) return;
  if (marks.length !== 3 || marks.filter(x => x === '●').length !== 1) return;
  p.ratings.push({ kind: 'self', label: '事業の方向性', value: OPTIONS[marks.indexOf('●')], scale: OPTIONS.join('／'), evidence: evidence(input, raw, offset + s) });
}

function ishiokaOne(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.municipalityCode !== '08205' || !ISHIOKA.has(input.sourceId)) return [];
  const guide = inputs.find(i => i.sourceId === ISHIOKA_GUIDE && i.text.startsWith('令和７年度\n\n事務事業評価シート') && i.text.includes(GUIDE_TEXT));
  const toc = tocOf(input);
  const starts = [...input.text.matchAll(SHEET)].map(m => m.index! + (m[0].startsWith('\n') ? 2 : 0));
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  starts.forEach((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : input.text.length, seg = input.text.slice(start, end);
    if (input.truncated && k === starts.length - 1) return;
    // 1シートに見出しが1組だけのもの（シート境界の崩れがないもの）に限る。
    if (seg.split('1.事業概要').length !== 2 || seg.split('６.事業評価（総括評価）').length !== 2) return;
    const nm = seg.match(/\n\n([^\n]+(?:\n[^\n]+)?)\n\n根拠法令\n/), dm = seg.match(/課名\n\n([^\n]+)\n\n([^\n]+)\n\n会計\n/), pg = seg.match(/\n(\d+)\/(\d+)\n/);
    if (!nm || !pg || nm[1] === '事業名' || nm[1].includes('事業名')) return;
    const hits = toc.filter(x => x.page === Number(pg[1]));
    // 事業名は目次の表記（シート開始ページと目次のP番号が一致し、シートの事業名と同じもの）でのみ確定する。
    if (hits.length !== 1 || norm(hits[0].name) !== norm(nm[1])) return;
    const hit = hits[0], name = hit.name;
    // 特別会計・企業会計の「（総括）」シートは個別事業ではないため除外。
    if (name.endsWith('（総括）')) return;
    const titleRaw = seg.slice(0, seg.indexOf('\n', seg.indexOf('事務事業評価シート')));
    const p = project(input, `${hit.dept}:${name}`, name, 2025, titleRaw, start);
    p.projectCode = null;
    p.department = hit.dept;
    p.evidence.push(evidence(input, nm[0].slice(2, -1), start + nm.index! + 2), evidence(input, hit.raw, hit.start));
    if (dm) p.evidence.push(evidence(input, dm[0], start + dm.index!));
    if (guide) {
      p.evaluatedFiscalYear = 2024;
      p.evidence.push(evidence(guide, GUIDE_TEXT));
    }
    const hasAmounts = addAmounts(input, p, seg, start);
    addDirection(input, p, seg, start);
    p.warnings.push('令和７年度事務事業評価シート。評価年度は表題の令和７年度。評価対象年度は同じ様式の記入説明「令和６年度に実施した事業を対象としています。」による。担当課は目次の課名欄の表記。');
    if (hasAmounts) p.warnings.push('投入量表（単位：千円）の列は本文の並び（令和4〜6年度=過年度、令和7年度=現年度）で対応づけ、財源計＝決算額計(A)、予算額計(B)の内訳合計、執行率A/B、フルコスト＝A＋人件費(C) の一致を全列で確認したもののみ採用。予算額計(B)は補正・繰越を含む額（令和7年度は現年度の予算額）。');
    else p.warnings.push('投入量表の段組みが崩れているか検算が一致しないため金額は未採用。');
    p.warnings.push('活動指標・成果指標は抽出テキストで指標名と年度・値の対応が確定できないため未採用。事業の方向性は●が1つだけで選択肢3つが順に並ぶ場合のみ採用。');
    const key = norm(hit.dept + '\n' + name);
    if (out.has(key)) { conflicts.add(key); return; }
    out.set(key, p);
  });
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

// ---------------------------------------------------------------- 羽村市
const joinLines = (s: string) => s.split('\n').map(l => l.trim()).join('');
const signed = (s: string) => Number(s.replace(/^▲ ?/, '-').replaceAll(',', ''));

// (1) 令和6年度 行政評価基本シート（令和5年度実施事業の事後評価。外部評価委員会資料3-2-1〜7。資料3-1は記入説明付きの見本のため除外）
const HAMURA_SHEET_DOCS = new Set(['f2fca7d61ad88cd63cd9676a', '7a5230aaacf5280d78962877', '31405438acae6f14a09d460c', '590b4be412e1802410ba6993',
  '97197e22c21ebfc04b08de3a', 'a035ece0d089d6d2af767adb', '2db94e268806d827ea2d15fe']);
const HAMURA_TITLE = '令和5年度における施策の取組状況と成果について';
const HAMURA_HEAD = /令和6年度\n\nNo\.(\d+)\n\n【行政評価基本シート】\n作成部署\n\n１\.基本項目\n事業名\n\n([^\n]+部[^\n]*)\n\n([^\n]+)\n\n実施期間 事業種別 運営手法 実施計画No\n\n([^\n]+(?:\n[^\n]+)?)\n\n/g;
const PROGRESS = ['計画通り完了', '計画を見直し完了', '遅延', '中断'];
const OVERALL = /^(?:計画通り実施|改善が必要（.+）)$/;
const HAMURA_ROW = /\n(?:◎ )?No\.(\d+) ([^\n]+)\n\n([^\n]+)\n\n([A-D])\n\n([A-D])\n\n([A-D])\n\n([^\n]+(?:\n[^\n]+)?)\n/g;
const SPENT = /③投入実績\n決算の内訳 \(単位：千円\)\n\n予算額\(当初\) 補正・流用額(?:等)?\n\n事業費\n年間業務時間（人件費の目安）\n\n([\d,]+)\n\n(▲ ?[\d,]+|[\d,]+)\n\n当初計画\n\n実績\n\n予算額\(最終\)\n\n決算額\n\n([\d,]+)\n\n(?:([\d,]+)\n\n執行率\n([\d.]+)%|執行率\n\n?([\d,]+) ([\d.]+)%)\n/;
const PLAN = /令和5年度（当初）\n\n(?:事業費\n(?:人件費\(係長職\)\n人件費\(主任・主事職\)\n総事業費\(合計\)\n)?\n(?:\d+\n\n)?)?令和4年度（実績）\n\n増減\n\n(?:事業費\n\n)?([\d,]+)\n\n([\d,]+)\n\n(-?[\d,]+)\n\n/;

function hamuraSheets(input: CachedInput): ProjectEvaluation[] {
  if (!HAMURA_SHEET_DOCS.has(input.sourceId) || !input.text.startsWith(HAMURA_TITLE)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const rows = [...t.matchAll(HAMURA_ROW)].filter(r => PROGRESS.includes(r[3]) && OVERALL.test(joinLines(r[7])));
  const heads = [...t.matchAll(HAMURA_HEAD)];
  heads.forEach((h, k) => {
    const start = h.index!, nextHead = heads[k + 1]?.index ?? t.length, nextTitle = t.indexOf(HAMURA_TITLE, start);
    const end = Math.min(nextHead, nextTitle < 0 ? t.length : nextTitle), seg = t.slice(start, end), no = h[1];
    const name = joinLines(h[4]);
    // 後半（内部評価（事後評価））の番号が見出しと一致するものに限る。
    const other = [...seg.matchAll(/\nNo\.(\d+)\n/g)].map(m => m[1]);
    if (other.some(x => x !== no)) return;
    const sameNo = rows.filter(r => r[1] === no);
    const row = sameNo.length === 1 && norm(sameNo[0][2]) === norm(name) ? sameNo[0] : null;
    // 事業名が2行に折り返している場合は、一覧の行で事業名を確認できるものだけ採る。
    if (h[4].includes('\n') && !row) return;
    const p = project(input, `No.${no}`, name, 2024, h[0].slice(0, -2), start);
    p.projectCode = `No.${no}`;
    p.department = `${joinLines(h[2])} ${joinLines(h[3])}`;
    p.evaluatedFiscalYear = 2023;
    p.evidence.push(evidence(input, HAMURA_TITLE, 0));
    const sp = SPENT.exec(seg), pl = PLAN.exec(seg);
    let amounts = false;
    if (sp) {
      const initial = n(sp[1]), adj = signed(sp[2]), final = n(sp[3]), spentRaw = sp[4] ?? sp[6], rate = Number(sp[5] ?? sp[7]);
      // 予算額(当初)＋補正・流用額＝予算額(最終)、決算額÷予算額(最終)＝執行率、②事業費の令和5年度（当初）＝③予算額(当初) を確認。
      if (initial + adj === final && final > 0 && Math.abs(n(spentRaw) / final * 100 - rate) <= 0.051 && pl && n(pl[1]) === initial) {
        const ev = evidence(input, sp[0].slice(0, -1), start + sp.index);
        p.amounts.push({ kind: 'budget', fiscalYear: 2023, amountYen: final * 1000, rawValue: sp[3], rawUnit: '千円', evidence: ev },
          { kind: 'actual', fiscalYear: 2023, amountYen: n(spentRaw) * 1000, rawValue: spentRaw, rawUnit: '千円', evidence: ev });
        amounts = true;
      }
    }
    if (amounts && pl && n(pl[1]) - n(pl[2]) === signed(pl[3])) {
      p.amounts.push({ kind: 'actual', fiscalYear: 2022, amountYen: n(pl[2]) * 1000, rawValue: pl[2], rawUnit: '千円', evidence: evidence(input, pl[0].slice(0, -2), start + pl.index) });
    }
    if (row) {
      const raw = row[0].slice(1, -1), at = row.index! + 1, ev = evidence(input, raw, at);
      p.ratings.push({ kind: 'self', label: '進捗状況', value: row[3], scale: PROGRESS.join('／'), evidence: ev },
        { kind: 'self', label: '妥当性', value: row[4], scale: null, evidence: ev },
        { kind: 'self', label: '効率性（手法）', value: row[5], scale: null, evidence: ev },
        { kind: 'self', label: '達成度', value: row[6], scale: null, evidence: ev },
        { kind: 'self', label: '総合評価', value: joinLines(row[7]), scale: null, evidence: ev });
    }
    p.warnings.push('羽村市 令和6年度 行政評価基本シート（令和5年度実施事業の事後評価、所管課長による内部評価）。評価対象年度は資料の表題「令和5年度における施策の取組状況と成果について」による。番号は実施計画等の掲載番号（No.）。');
    p.warnings.push(amounts ? '金額は③投入実績（単位：千円）の予算額(最終)・決算額（令和5年度）と、②事業費の令和4年度（実績）。当初＋補正・流用＝最終、決算÷最終＝執行率、②の令和5年度（当初）＝③の予算額(当初)、②の当初−実績＝増減 を確認したもののみ。人件費・総事業費は列の対応が確定できないため未収録。'
      : '投入実績の表が崩れているか検算が一致しないため金額は未収録。');
    p.warnings.push(row ? '進捗状況・妥当性・効率性（手法）・達成度・総合評価は同じ資料の「施策を構成する主要な事務事業の事後評価結果」の行（番号・事業名が一致し値が順に並ぶ行）から収録。A〜Dの定義は本資料に記載なし。'
      : '施策ごとの事後評価結果一覧で行が崩れているため評価は未収録。');
    out.push(p);
  });
  return out;
}

// (2) 令和6年度 行政評価（新規事務事業評価）結果一覧表（令和7年度から新たに実施を計画している事務事業の事前評価）
const HAMURA_NEW = 'b40579a56b2f49f573a545c2';
const HAMURA_NEW_TITLE = '令和６年度\n行政評価（新規事務事業評価）結果一覧表';
function hamuraNew(input: CachedInput): ProjectEvaluation[] {
  if (input.sourceId !== HAMURA_NEW || !input.text.startsWith(HAMURA_NEW_TITLE)) return [];
  const t = input.text, scale = 'A：実施が妥当\nB：要再検討\nC：実施しない';
  const scaleAt = t.indexOf(scale);
  if (scaleAt < 0) return [];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(/\n\n(\d+)(?:\n\n| )((?:[^\n]+\n)?[^\n]+)\n\n([^\n・]+(?:部|局))・([^\n・]+)\n\n([ABC])\n/g)) {
    const name = joinLines(m[2]), dept = m[4];
    if (/部・|事務事業名|^\d/.test(name) || !/(?:課|室|局|館)$/.test(dept.split('、').at(-1)!)) continue;
    const raw = m[0].slice(2, -1), at = m.index! + 2;
    const p = project(input, `R6新規:${m[1]}`, name, 2024, raw, at);
    p.projectCode = null; p.department = dept;
    p.evidence.push(evidence(input, HAMURA_NEW_TITLE, 0));
    p.ratings.push({ kind: 'self', label: '評価結果（新規事務事業評価・二次評価）', value: m[5], scale: 'A：実施が妥当／B：要再検討／C：実施しない', evidence: evidence(input, raw, at) });
    p.warnings.push('令和7年度から新たに実施を計画している事務事業の事前評価（一次評価=所管課長、二次評価=羽村市行政評価委員会）。評価対象年度は事前評価のため未設定。番号・事業名・所管部課・評価結果が順に並ぶ行のみ収録し、評価コメント・経費概要（計画値）は未収録。番号は掲載順のため事業コードにしていません。');
    out.push(p);
  }
  return out;
}
const hamuraKey = (p: ProjectEvaluation) => `${p.evaluationYear}\n${norm(p.projectName)}`;
const hamuraOne = (i: CachedInput) => i.municipalityCode === '13227' ? [...hamuraSheets(i), ...hamuraNew(i)] : [];

// ---------------------------------------------------------------- 有田町 事務事業評価一覧（資料２。R6・R5）
const ARITA_DIRECTIONS = '継続|事務改善|拡大|縮小|廃止|⺠営化|民営化|⺠間活用|民間活用';
const TERM = '(?:短期|中期|⻑期|長期)';
const ARITA: Record<string, { title: string; year: number; coded: boolean; cost: string }> = {
  '1026383704d50d0e39b5584c': { title: '資料２\nR６事務事業評価一覧', year: 2024, coded: false, cost: 'R５事業費' },
  '5c07bc4bc9b79ca061318f52': { title: '資料２\nR5事務事業評価一覧', year: 2023, coded: true, cost: 'R4事業費' },
};
function aritaOne(input: CachedInput): ProjectEvaluation[] {
  const spec = ARITA[input.sourceId];
  if (input.municipalityCode !== '41401' || !spec || !input.text.startsWith(spec.title)) return [];
  const t = input.text;
  const legends = [...t.matchAll(/【[^】\n]+】([1-6１-６])[.．]([^\n]+)/g)];
  if (legends.length !== 6) return [];
  const legendRaw = t.slice(legends[0].index!, legends[5].index! + legends[5][0].length);
  // R5一覧は方向性の前に区分記号（A〜G）が付く（「A 継続」「C事務改善」）。
  const code = spec.coded ? '[A-G] ?' : '';
  const row = new RegExp(`(?<=\\n)(\\d+)(?:\\n\\n| )([^\\n]+)\\n\\n([^\\n]+)\\n\\n([\\d,]+) ([ABC-]) ([ABC-]) ([ABC-]) ([ABC-]) ([ABC-]) ([ABC-]) ${code}(?<d1>${ARITA_DIRECTIONS})` +
    `(?:(?: ${TERM})? ${code}(?<d2a>${ARITA_DIRECTIONS})(?: ${TERM})?)?\\n` +
    `(?:\\n(?:${TERM} )?${code}(?<d2b>${ARITA_DIRECTIONS})(?: ${TERM})?(?=\\n\\n(?:${TERM}\\n\\n)?\\d+(?:\\n\\n| )\\S|\\n\\n\\n|\\n?$))?`, 'g');
  const out: ProjectEvaluation[] = [];
  for (const r of t.matchAll(row)) {
    const g = [...r];
    const [no, name, dept] = [g[1], g[2], g[3]];
    if (!/^[^\s\d]+(?:課|局|室|署)$/.test(dept) || /^\d|事業費|担当課|事務事業名|(?:^|\s)[A-G](?:\s|$)/.test(name)) continue;
    if (r.groups!.d2a && r.groups!.d2b) continue;
    const letters = g.slice(5, 11);
    const first = r.groups!.d1, second = r.groups!.d2a ?? r.groups!.d2b;
    const start = r.index!, raw = r[0].replace(/\n+$/, '');
    const p = project(input, `${spec.year}:${no}`, name.trim(), spec.year, raw, start);
    p.projectCode = null; p.department = dept;
    p.evidence.push(evidence(input, spec.title, 0), evidence(input, legendRaw, legends[0].index!));
    const ev = evidence(input, raw, start);
    letters.forEach((v, i) => {
      if (v === '-') return;
      const lg = legends[i][0].replace(/^【\s*([^】]+?)\s*】[1-6１-６][.．]/, '$1：');
      p.ratings.push({ kind: 'self', label: `評価${i + 1}（${lg}）`, value: v, scale: 'A/B/C（区分の定義は本文に記載なし）', evidence: ev });
    });
    p.ratings.push({ kind: 'self', label: '１次評価 方向性', value: first, scale: null, evidence: ev });
    if (second) p.ratings.push({ kind: 'self', label: '２次評価 方向性', value: second, scale: null, evidence: ev });
    p.warnings.push(`有田町 ${spec.title.slice(4)}の1行が「№・事務事業名・担当課・${spec.cost}・評価1〜6・１次評価方向性」の順に揃う行のみ収録。${spec.cost}は予算/決算の別が本文に明示されないため金額として採用していません。` +
      '時期は列の対応が確定できないため未収録。２次評価方向性は次の行の開始直前に「（時期）方向性」が並ぶ場合のみ収録。評価1〜6の設問は一覧末尾の凡例を引用（A/B/Cの定義は記載なし）。評価対象年度は一覧に明記がないため未設定。' +
      (spec.coded ? '方向性の前の英字（A〜G）は方向性の区分記号で、方向性の値には含めていません。' : ''));
    out.push(p);
  }
  return out;
}
const aritaKey = (p: ProjectEvaluation) => `${p.evaluationYear}\n${norm(p.projectName)}\n${p.department}`;

export const entries: Record<string, Entry> = {
  '13227': { extract: (input, inputs) => municipalityRecords(input, inputs, hamuraOne, hamuraKey),
    scope: '令和6年度 行政評価基本シート（外部評価委員会資料3-2-1〜7、令和5年度実施事業の事後評価）の事業名・作成部署・投入実績（検算一致時の予算額(最終)・決算額、令和4年度実績事業費）・事後評価結果一覧の進捗状況/妥当性/効率性/達成度/総合評価と、令和6年度新規事務事業評価結果一覧表の評価結果。活動実績・評価理由・中間評価・事後評価結果概要一覧（行崩れ）・記入説明付き見本は構造化しない。' },
  '41401': { extract: (input, inputs) => municipalityRecords(input, inputs, aritaOne, aritaKey),
    scope: 'R６・R5事務事業評価一覧（資料２）で行が揃う事業の事務事業名・担当課・評価1〜6・１次評価方向性・２次評価方向性（並びが確定するもののみ）。事業費（予算/決算不明）・時期・行が崩れた事業・R4/R2一覧（列が1値ずつ分離）・結果報告（資料１の集計）は構造化しない。' },
  '08205': { extract: ishiokaOne, scope: '令和７年度事務事業評価シート（市長直轄・市長公室・総務部・財務部・生活環境部・福祉部・子育て健康部・産業戦略部・都市建設部・会計課・議会事務局・消防本部・八郷総合支所）の事業名・担当課・投入量（検算一致時の決算額・予算額・人件費・フルコスト）・事業の方向性。特別会計等の（総括）シート、活動指標・成果指標・点検項目・総括評価文は構造化しない。' },
};
