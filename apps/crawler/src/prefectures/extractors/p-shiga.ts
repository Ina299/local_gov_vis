/**
 * 滋賀県「主要施策の成果に関する説明書」（令和3〜6年度、部門別に分割されたPDF）。
 * 事項ごとに「予算額 N 円／決算額 N 円」の欄があり、農政・環境部門などでは事項の中の (1)(2)… の小事業ごとに同じ欄がある。
 * 欄名（予／算／額、決／算／額）と金額が抽出テキストで連続して並ぶ箇所だけを収録し、欄名と金額が離れて出力された事項は対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const N = String.raw`\d{1,3}(?:,\d{3})*`;
/** 予算額 → 決算額 の順で欄名と値が隣り合う形（値の後ろは「 円」または「円」）。 */
const PAIR = new RegExp(String.raw`予\n+算\n+額\n+(${N}) ?円\n+決\n+算\n+額\n+(${N}) ?円`, 'g');
const LABEL = /予\n+算\n+額/g;
const HEADER = new Set(['事', '項', '名', '成', '果', 'の', '説', '明', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', '人', '経', '済', '社', '会', '環', '境']);
const FIELDS = new Set(['自分らしい未来を描ける生き方', '新たな価値を生み出す産業', '多様な社会基盤', '豊かな自然の恵み', '未来を拓く', '未来を支える', '未来につなげる']);
const DEPT = /^（([^\n（）]{2,40}(?:課|室|局|部|所|センター|本部))）$/;
const ORG = /^[^、\s\d０-９：:％%]+(?:課|室|局|部|所|センター|本部)$/;

function fiscalYear(t: string): { fy: number; raw: string; start: number } | null {
  // 表紙「令／和／6／年／度／主 要 施 策 の 成 果 に 関 す る 説 明 書」
  const m = /令\n+和\n+(\d)\n+年\n+度\n+主 要 施 策 の 成 果 に 関 す る 説 明 書/.exec(t.slice(0, 3000));
  return m ? { fy: 2018 + Number(m[1]), raw: m[0], start: m.index } : null;
}

/** 金額欄の直前の行を遡って事項名（または (n) 小事業名）を集める。区切り（欄名・番号・分野名・課名・文章）で止まる。 */
function nameBefore(t: string, pos: number): { name: string; code: string | null; raw: string; start: number } | null {
  const lines: { s: string; start: number }[] = [];
  let end = pos;
  while (end > 0) {
    const nl = t.lastIndexOf('\n', end - 1);
    const s = t.slice(nl + 1, end);
    end = nl < 0 ? 0 : nl;
    const v = s.trim().replace(/^（(\d+)\)/, '($1)');
    if (!v) continue;
    // 欄名の1字・番号・ページ番号は読み飛ばし、分野名・課名・文章・ア/①の細目は区切り（名前より先に現れたら確定しない）
    if (HEADER.has(v) || /^[0-9０-９]+$/.test(v) || /^- \d+ -$/.test(v)) { if (lines.length) break; else continue; }
    if (FIELDS.has(v) || /^（.*）$/.test(v) || /[。]/.test(v) || /^[ア-ン] /.test(v) || /^[①-⑳]/.test(v)) { if (lines.length) break; else return null; }
    if (/^(?:今後の課題|施策成果|事業実績|次年度以降|[(（]?\d+[)）]? *(?:事業実績|施策成果|今後の課題))/.test(v)) { if (lines.length) break; else return null; }
    lines.unshift({ s, start: nl + 1 });
    if (/^[(（]\d+\)/.test(v)) {
      // 小事業の行: 直前の行が右欄「１ 事業実績」の混入（2段組の崩れ）なら名前が確定しない
      const prev = t.slice(0, nl).trimEnd().split('\n').pop()!.trim();
      if (/事業実績$| [１1]$/.test(prev)) return null;
      break;
    }
    if (lines.length > 3) break;
  }
  if (!lines.length || lines.length > 3) return null;
  const parts = lines.map(l => l.s.trim().replace(/^（(\d+)\)/, '($1)').replace(/ [１1]$/, ''));
  if (/^\(\d+\)/.test(parts[0]) && parts.slice(1).some(p => p.length > 15 || /^[0-9０-９]/.test(p))) return null;
  if (parts.some(p => p.length > 40 || /^[ア-ン①-⑳0-9０-９]|事業実績|^\(\d+\)$/.test(p) || /\d+(?:人|件|回|名|円|％|%|市町|地区)/.test(p))) return null;
  const joined = parts.join('');
  const code = /^\((\d+)\)/.exec(joined)?.[1] ?? null;
  const name = joined.replace(/^\(\d+\)\s*/, '').trim();
  if (name.length < 3 || name.length > 60) return null;
  const start = lines[0].start, last = lines[lines.length - 1];
  return { name, code, raw: t.slice(start, last.start + last.s.length), start };
}

/** 折り返しの改行だけを詰める（行幅いっぱいの行の後ろの改行のみ。短い行の後ろの改行＝小見出し・箇条の区切りは残す）。 */
const joinWrapped = (s: string) => s.split('\n').reduce((acc, l, i, a) => acc + l + (i === a.length - 1 ? '' : l.length >= 40 && !ITEM.test(a[i + 1]) ? '' : '\n'), '');
/** 小見出し・箇条の書き出し（前の行が行幅いっぱいでも改行を残す） */
const ITEM = /^(?:[(（][0-9０-９ｱ-ﾝ]+[)）]|[ア-ン](?:～[ア-ン])? |[・①-⑳※＜])/;
const ACTIVITY_HEAD = /^(?:(?:\(1\)|（1）|１) ?)?事業実績$/gm;
const OUTCOME_HEAD = /^(?:(?:\(2\)|（2）|２) ?)?施策成果$/gm;
/** 施策成果の本文の終わり: 「(3) 今後の課題」（「３」だけの行の後に「今後の課題」の形を含む）、指標の表の見出し（「令和N年度（…）の」で折り返す形を含む） */
const NEXT_HEAD = /^(?:(?:\(3\)|（3）|３) ?今後の課題.*|今後の課題|３|令和[0-9０-９]+年度[（(].*|.*目標とする指標.*|.*の目標値)$/m;
const IND_HEAD = /^令和[0-9０-９]+年度[（(](\d{4}) ?年度[）)]の目標とする指標(?:[（【][^\n）】]*[）】])?$/gm;
const VALUE = /^[\d,.]+ ?[^\s\d]{0,6}(?:／年)?$/;

/**
 * 金額欄の後ろ（次の予算額欄まで）にある「(2) 施策成果」の本文と「目標とする指標」の表。
 * 事項の中に番号付きの事業が複数あって施策成果・指標が複数ある場合は、どれが事項全体のものか定まらないので読まない。
 */
function details(t: string, from: number, to: number) {
  const seg = t.slice(from, to);
  const heads = [...seg.matchAll(OUTCOME_HEAD)];
  if (heads.length !== 1) return null;
  let outcome: { text: string; raw: string; start: number } | null = null;
  const bodyStart = from + heads[0].index! + heads[0][0].length + 1;
  const rest = t.slice(bodyStart, to);
  const stop = NEXT_HEAD.exec(rest);
  if (stop) {
    // 本文が一続きの段落（空行なし）で、ページ送り・段組みの混入がない場合だけ
    const raw = rest.slice(0, stop.index).replace(/\n+$/, '');
    if (raw.length >= 10 && !raw.includes('\n\n')) outcome = { text: joinWrapped(raw), raw, start: bodyStart };
  }
  // 事業実績: 金額欄の後ろに見出しが1つだけあり、施策成果の見出しまで一続き（空行なし）の場合だけ
  let activity: { text: string; raw: string; start: number } | null = null;
  const acts = [...seg.slice(0, heads[0].index!).matchAll(ACTIVITY_HEAD)];
  if (acts.length === 1) {
    const start = from + acts[0].index! + acts[0][0].length + 1;
    const raw = t.slice(start, from + heads[0].index!).replace(/\n(?:２\n)?\n*$/, '');
    if (raw.length >= 10 && !raw.includes('\n\n')) activity = { text: joinWrapped(raw), raw, start };
  }
  let indicator: { name: string; fy: number; actual: string; target: string; targetYear: number; raw: string; start: number } | null = null;
  const inds = [...seg.matchAll(IND_HEAD)];
  if (inds.length === 1) {
    const at = from + inds[0].index!;
    const lines: { s: string; end: number }[] = [];
    const re = /[^\n]+/g;
    re.lastIndex = at + inds[0][0].length;
    let x: RegExpExecArray | null;
    while (lines.length < 8 && (x = re.exec(t)) && x.index < to) lines.push({ s: x[0].trim(), end: x.index + x[0].length });
    const s = lines.map(l => l.s);
    const yr = /^令([0-9０-９])(?:年度)?$/.exec(s[1] ?? '');
    // 名前の次に「令X」の欄が1つだけある形（基準年・複数年度の列がある表は読まない）:
    //   欄名3つの後に値3つ（令X／目標値／達成率 → 実績／目標／達成率）、欄名と値が交互、達成率の欄がなく値2つ（次の行は値でない）
    const isVal = (v?: string) => !!v && VALUE.test(v);
    const isActual = (v?: string) => isVal(v) || v === '集計中';
    const isRate = (v?: string) => !!v && /^(?:[\d.]+ ?％|－)$/.test(v);
    let vals: [string, string, number] | null = null; // 実績・目標・使った行数
    if (s[2] === '目標値' && s[3] === '達成率' && isActual(s[4]) && isVal(s[5]) && isRate(s[6])) vals = [s[4], s[5], 7];
    else if (isActual(s[2]) && s[3] === '目標値' && isVal(s[4]) && s[5] === '達成率' && isRate(s[6])) vals = [s[2], s[4], 7];
    else if (s[2] === '目標値' && isActual(s[3]) && isVal(s[4]) && s[5] !== undefined && s[5] !== '達成率' && !isVal(s[5])) vals = [s[3], s[4], 5];
    if (yr && vals && !/^令|^平|目標|実績|^基準/.test(s[0])) {
      indicator = { name: s[0], fy: 2018 + Number(yr[1].normalize('NFKC')), actual: vals[0], target: vals[1], targetYear: Number(inds[0][1]), raw: t.slice(at, lines[vals[2] - 1].end), start: at };
    }
  }
  return { outcome, activity, indicator };
}

function extractShiga(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  const fy = fiscalYear(t);
  if (!fy) return [];
  const labels = [...t.matchAll(LABEL)].map(m => m.index!);
  const anyLabel = [...t.matchAll(/予\s*算\s*額/g)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(PAIR)) {
    const n = nameBefore(t, m.index!);
    if (!n) continue;
    const seq = out.length + 1;
    const p = project(input, `${fy.fy}-${seq}`, n.name, null, n.raw, n.start);
    p.evaluatedFiscalYear = fy.fy;
    p.evidence.push(evidence(input, fy.raw, fy.start));
    p.amounts.push(amount(input, 'budget', fy.fy, m[1], '円', m[0], m.index!), amount(input, 'actual', fy.fy, m[2], '円', m[0], m.index!));
    // 担当課: この金額欄から次の金額欄までに「（○○課）」の行がちょうど1種類だけある場合のみ。
    const next = labels.find(x => x > m.index!) ?? t.length;
    const tail = t.slice(m.index! + m[0].length, next);
    const depts = new Map<string, number>();
    let off = m.index! + m[0].length;
    for (const line of tail.split('\n')) {
      const d = DEPT.exec(line.trim());
      if (d && d[1].split('、').every(o => ORG.test(o)) && !depts.has(d[0].trim())) depts.set(d[0].trim(), off + line.indexOf(d[0].trim()));
      off += line.length + 1;
    }
    if (depts.size === 1) {
      const [[raw, at]] = [...depts];
      p.department = raw.slice(1, -1);
      p.evidence.push(evidence(input, raw, at));
    } else p.warnings.push(depts.size ? '事項内に複数の担当課の表記があるため担当課は未収録。' : '担当課の表記が確認できないため未収録。');
    p.warnings.push(`金額は「予算額」「決算額」欄（円）。表題「令和${fy.fy - 2018}年度主要施策の成果に関する説明書」により決算年度を${fy.fy}年度とした。予算額は原文の欄名のとおりで、当初・最終の別は原文に記載なし。`);
    if (n.code) p.warnings.push(`事項の中の小事業 (${n.code}) の金額欄。上位の事項名は未収録。`);
    else {
      // 小事業の金額欄には施策成果・指標の欄がない（事項全体のものと区別できない）ため、事項の金額欄の場合だけ
      const d = details(t, m.index! + m[0].length, anyLabel.find(x => x > m.index! + m[0].length) ?? t.length);
      if (d?.outcome) {
        p.outcomes = d.outcome.text;
        p.evidence.push(evidence(input, d.outcome.raw, d.outcome.start));
        p.warnings.push('成果は「施策成果」欄の本文（行幅いっぱいで折り返した改行のみ詰めた）。');
      }
      if (d?.activity) {
        p.activities = d.activity.text;
        p.evidence.push(evidence(input, d.activity.raw, d.activity.start));
        p.warnings.push('事業内容は「事業実績」欄の本文（金額の行を含め原文どおり。行幅いっぱいで折り返した改行のみ詰めた）。');
      }
      if (d?.indicator) {
        const ind = d.indicator;
        p.indicators.push({ name: ind.name, fiscalYear: ind.fy, target: ind.target, actual: ind.actual, unit: null, evidence: evidence(input, ind.raw, ind.start) });
        p.warnings.push(`指標は「令和${ind.targetYear - 2018}年度（${ind.targetYear}年度）の目標とする指標」の表。実績は「令${ind.fy - 2018}」欄、目標は「目標値」欄（${ind.targetYear}年度の目標）で、単位は値に含めて原文どおり。`);
      }
    }
    if (num(m[2]) > num(m[1])) p.warnings.push('決算額が予算額を上回る（原文どおり）。');
    out.push(p);
  }
  return out;
}

export const entries: Record<string, Entry> = {
  '25000': {
    scope: '主要施策の成果に関する説明書（令和3〜6年度）の事項（または事項内の (n) 小事業）ごとの予算額・決算額（円）と担当課。欄名と金額が抽出テキストで連続しない事項、事項名が複数行に分断されて確定しない事項、事項内の番号付き事業の個別金額（欄名なし）は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, extractShiga, p => `${p.evaluatedFiscalYear}|${nfkc(p.projectName)}|${p.amounts.map(a => a.amountYen).join(',')}`),
  },
};
