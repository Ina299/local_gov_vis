import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, dedupe, num } from './g7-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

/** 西郷村 令和7年度外部評価報告書（令和6年度実施事業分）: per-project committee ratings. */
function extractNishigo(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07461' || input.sourceId !== '4068bb2a440f20049867fd0a' || !input.text.includes('令和 6 年度\n実施事業分\n\n外部評価報告書')) return [];
  const heads = [...input.text.matchAll(/事務事業\n\n([^\n]+)\n\n担当部署\n\n([^\n]+)\n/g)];
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i], start = h.index!, end = heads[i + 1]?.index ?? input.text.length;
    const seg = input.text.slice(start, end), cut = seg.indexOf('\n総\n評');
    const body = cut > 0 ? seg.slice(0, cut) : seg;
    const letters = [...body.matchAll(/\n([A-D])\n([A-D])\n([A-D])\n\n/g)], total = [...body.matchAll(/\n([^\n]*（[A-D]）)\n/g)];
    if (letters.length !== 1 || total.length !== 1) continue;
    const p = project(input, h[1], h[1], 2025, h[0].trimEnd(), start);
    p.projectCode = null; p.department = h[2]; p.evaluatedFiscalYear = 2024;
    const l = letters[0], ev = evidence(input, l[0].trim(), start + l.index! + 1);
    ['妥当性', '有効性', '効率性'].forEach((label, k) => p.ratings.push({ kind: 'external', label: `西郷村行政評価推進委員会 視点ごとの評価：${label}`, value: l[k + 1], scale: null, evidence: ev }));
    p.ratings.push({ kind: 'external', label: '西郷村行政評価推進委員会 総合評価', value: total[0][1],
      scale: 'A︓事業継続 B︓改善を検討し事業を継続 C︓事業縮⼩・再構築の検討 D︓事業廃⽌・凍結の検討', evidence: evidence(input, total[0][1], start + total[0].index! + 1) });
    p.warnings.push('外部評価報告書（令和7年度、令和6年度実施事業分）の委員会評価。妥当性・有効性・効率性の評価記号は抽出テキスト上で縦に3つ並ぶ順に対応付け。事業費・指標は報告書に記載がないため未収録。事業名・部署名の互換漢字（⻄・⾏等）は原文のまま。');
    out.push(p);
  }
  return dedupe(out, p => p.projectName);
}

const CONTRIB = 'a 施策の実現に直結する事業 b 施策の実現のために大きな役割を担う事業 c 施策の実現のためにある程度の役割を担う事業 d 施策の実現のために必ずしも寄与しない事業';
const EFFIC = '1 コスト削減の余地がなく、業務プロセスの簡素化・改善ができない。 2 コスト削減の余地がなく、業務プロセスの簡素化・改善ができる。 3 コスト削減の余地があり、業務プロセスの簡素化・改善ができない。 4 コスト削減の余地があり、業務プロセスの簡素化・改善ができる。';
const NUM = '([\\d,]+)';
// Middle lines (事業内容・担当課 interleaved) must not be another row's number line or a numeric column value.
const MID = '(?!\\d{1,3} \\S)(?![\\d,]+(?: |\\n|$))[^\\n]+';
const CHITOSE_ROW = new RegExp(`^(\\d{1,3}) (\\S+)\\n\\n((?:${MID}\\n\\n?){1,8}?)${NUM}(?: |\\n\\n)${NUM}(?: |\\n\\n)${NUM}(?: |\\n\\n)${NUM}\\n\\n([a-d])\\n\\n([1-4])\\n\\n(新規|維持|改善|拡充|縮小|終了|廃止)\\n`, 'gm');

/** 千歳市 令和6年度 施策・事務事業評価表（令和7年度評価実施）の「事後評価」表の行。 */
function extractChitose(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '01224' || input.sourceId !== '2e21fbf07a47e243fe8ab07a') return [];
  const head = '令和６年度 施策・事務事業評価表 <令和７年度評価実施>';
  const sheets = [...input.text.matchAll(new RegExp(head, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < sheets.length; i++) {
    const end = sheets[i + 1] ?? input.text.length, seg = input.text.slice(sheets[i], end);
    const a = seg.indexOf('・事後評価'), b = seg.indexOf('４.施策の分析', a);
    if (a < 0 || b < 0) continue; // last sheet is cut by the stored-text limit
    const base = sheets[i] + a, part = seg.slice(a, b);
    for (const m of part.matchAll(CHITOSE_ROW)) {
      if (!/[課係]/.test(m[3])) continue;
      const start = base + m.index!, raw = m[0].trimEnd();
      const p = project(input, m[2], m[2], 2025, raw, start);
      p.projectCode = null; p.evaluatedFiscalYear = 2024;
      p.amounts.push(amount(input, 'actual', 2024, m[4], '千円', raw, start), amount(input, 'budget', 2025, m[5], '千円', raw, start));
      p.ratings.push({ kind: 'self', label: '事後評価（令和７年度）施策への貢献度', value: m[8], scale: CONTRIB, evidence: evidence(input, raw, start) },
        { kind: 'self', label: '事後評価（令和７年度）効率性', value: m[9], scale: EFFIC, evidence: evidence(input, raw, start) },
        { kind: 'self', label: '事後評価（令和７年度）今後の事業の方向性', value: m[10], scale: '新規・維持・改善・拡充・縮小・終了・廃止', evidence: evidence(input, raw, start) });
      p.evidence.push(evidence(input, '・事後評価', base));
      p.warnings.push('施策・事務事業評価表の「事後評価」表（決算R6・予算R7・実施計画R8/R9）のうち、事業名行・事業内容・4金額・貢献度・効率性・方向性が抽出テキスト上で連続する行だけを採用。R8/R9の実施計画額は未収録。担当課は事業内容と同じ行に混在するため未設定。');
      p.warnings.push('保存テキストが120,000字で打ち切られているため、施策№018以降は未処理。列順が崩れた行（事業名の折返し・金額が先行する行）は除外。');
      out.push(p);
    }
  }
  return dedupe(out, p => p.projectName);
}

const NAGAI_LABEL = /予算額|決算額|執行率|目標|実績|達成|^R\d|指標|※|事業費|番号|主な内容|事務事業名|款/;
/**
 * The 事務事業名 column wraps at 8 characters and the 主な内容 bullets at 13; the two are interleaved.
 * A name is accepted only when every non-bullet line is unambiguously a name fragment.
 */
function nagaiName(text: string, codeStart: number): { name: string; start: number } | null {
  const ps = text.lastIndexOf('\n\n', codeStart), from = ps < 0 ? 0 : ps + 2;
  const lines = text.slice(from, codeStart).replace(/\n$/, '').split('\n'), name: string[] = [];
  let pending = false;
  for (const line of lines) {
    if (NAGAI_LABEL.test(line)) return null;
    if (!line.startsWith('・') && line.includes(' ・')) {
      if (pending) return null;
      const [left, right] = [line.slice(0, line.indexOf(' ・')), line.slice(line.indexOf(' ・') + 1)];
      name.push(left); pending = right.length >= 13; continue;
    }
    if (line.startsWith('・')) { pending = line.length >= 13; continue; }
    if (pending) return null;
    name.push(line);
  }
  if (!name.length || name.slice(0, -1).some(x => x.length !== 8) || name[name.length - 1].length > 8) return null;
  return { name: name.join(''), start: from };
}

/** 長井市 令和6年度行政評価シート（事務事業）. */
function extractNagai(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '06209' || !['95c1f523e1469e935509e029', '06927e24a4b8424f9bd84d19'].includes(input.sourceId)) return [];
  const head = '令和６年度行政評価シート（事務事業）';
  const cover = input.text.startsWith('令和７年度 行政評価\n\n事務事業別評価\n\n（令和６年度実施分）');
  const sheets = [...input.text.matchAll(new RegExp(head, 'g'))].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (let i = 0; i < sheets.length; i++) {
    const s0 = sheets[i], seg = input.text.slice(s0, sheets[i + 1] ?? input.text.length);
    const policy = seg.match(/主要施策\n\n(?:[^\n]+\n\n)?([^\n]+\(([^()\n]+)\))\n/);
    const codes = [...seg.matchAll(/^\((\d+\.\d+\.\d+\.\d+)\)$/gm)];
    const B = [...seg.matchAll(/予算額\n\n([\d,]+)\n/g)], A = [...seg.matchAll(/決算額\n\n([\d,]+)\n/g)], R = [...seg.matchAll(/執行率\n\n(\d+\.\d)%\n/g)];
    // Amount rows are trusted only when one row per project plus the 事業費合計 row exist and both totals and every 執行率 reconcile.
    let amountsOk = B.length === codes.length + 1 && A.length === B.length && R.length === B.length;
    if (amountsOk) {
      const b = B.map(m => num(m[1])), a = A.map(m => num(m[1]));
      const sum = (xs: number[]) => xs.slice(0, -1).reduce((x, y) => x + y, 0);
      amountsOk = sum(b) === b[b.length - 1] && sum(a) === a[a.length - 1] &&
        b.every((v, k) => v === 0 ? R[k][1] === '0.0' : Math.abs(Math.round(a[k] / v * 1000) / 10 - Number(R[k][1])) < 0.051);
    }
    codes.forEach((c, k) => {
      const nm = nagaiName(input.text, s0 + c.index!);
      if (!nm) return;
      const raw = input.text.slice(nm.start, s0 + c.index! + c[0].length);
      const p = project(input, c[1], nm.name, cover ? 2025 : null, raw, nm.start);
      p.evaluatedFiscalYear = 2024;
      p.evidence.push(evidence(input, head, s0));
      if (policy) p.evidence.push(evidence(input, policy[0].slice(policy[0].indexOf(policy[1])).trimEnd(), s0 + policy.index! + policy[0].indexOf(policy[1])));
      if (amountsOk) {
        p.amounts.push(amount(input, 'budget', 2024, B[k][1], '千円', B[k][0].trimEnd(), s0 + B[k].index!),
          amount(input, 'actual', 2024, A[k][1], '千円', A[k][0].trimEnd(), s0 + A[k].index!));
        p.warnings.push('R6予算額（年度末の予算現額）・決算額は、シート内の事業行数＋事業費合計の行数が一致し、各事業の合計と事業費合計・執行率がすべて整合したシートだけで、事業の掲載順に対応付け。');
      }
      p.warnings.push(`projectCodeは原文の（款.項.目.事業）番号。事業名は8字幅の事業名欄と主な内容欄が交互に混在するため、混在が判別できる場合のみ結合し、判別できない事業は除外。主要施策の担当課（${policy?.[2] ?? '不明'}）は事業の所管と一致するとは限らないため部署は未設定。活動指標・定性評価は列崩れのため未収録。`);
      if (!cover) p.warnings.push('この資料には評価実施年度の表紙がないため evaluationYear は未設定（シート表題は令和６年度行政評価シート）。');
      out.push(p);
    });
  }
  return dedupe(out, p => `${p.projectCode}\n${p.projectName}`);
}

export const entries: Record<string, Entry> = {
  '01224': { extract: extractChitose, scope: '令和6年度施策・事務事業評価表（令和7年度評価実施）の事後評価表のうち列が連続して読める事務事業行（R6決算・R7予算・貢献度・効率性・方向性）。施策評価・事中評価・結果概要・列崩れ行・保存テキスト打切り以降は対象外' },
  '06209': { extract: extractNagai, scope: '令和6年度行政評価シート（事務事業）の事業名（判別可能なもののみ）・款項目事業番号と、整合確認できたシートのR6予算現額・決算額。主要施策評価シート・活動指標・定性評価は対象外' },
  '07461': { extract: extractNishigo, scope: '西郷村行政評価推進委員会の外部評価報告書（令和6年度実施事業分）の対象7事務事業の視点別評価と総合評価。基本施策評価シート・提言本文は対象外' },
};
