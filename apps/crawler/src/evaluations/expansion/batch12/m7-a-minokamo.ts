import type { EvaluationIndicator, ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { acrossDocuments, amount, type Entry } from '../batch9/i1-util';

// ---------------------------------------------------------------- 美濃加茂市（令和６年度 事業評価書：小事業ごとの1枚シート）
// 第5回取得の事業評価書PDF（大事業ごとに小事業のシートを束ねたもの）。
const SOURCES = new Set(('009a75494447d0c39480e366 023eaa770509f71b5a8c945a 0485b4261336aa0d7bce9670 0bc599e7936470e5b32e9f25 0dabc9c196846e740f3ea6c5 '
  + '0eb049c9c13eacb644fc3841 0f1b5b423b713f12f6c40365 2799038bcd6a75e1dedc6f6c 289fbcac572c07e66d56f74f 2ed0bab7dccaa0f235344fed 3588439544e4be2ceeec3a75 '
  + '3733da2069216f10831f1ce5 39f3e7f632f1e46e987f1a90 3df10da567eef5a365a53d92 4db25f824e8d1eac0a6d7740 55e06b4d82408fcfcfb260c6 5cd98f188feb875575441f97 '
  + '6b6a1154c194a96c41835f1f 6ffc96aa8dd98c866b9bda00 7038430bd652cac5180bf489 7776257dffadb1b1d6d7c794 78bc40386d77eed8aba1d1b1 817a6b20674093b82fc7c683 '
  + '856120b2489d856d29982f1f 8a24b906270b384d3aa834cc 8c66d39ae024bb1bb1b2b941 8fb2f94f971d908c3f933e53 96939424e4bf8f595af09b02 9eb1371077aa8165ec3994f2 '
  + 'ad6b2365a5ac17595391e328 af3fef9e22c1d2746026b1cf cc3e5d46e19db2bdff4262d3 cc4a1c788ffaac315d65c836 d4e1db9f6979dce8df35c84c d6e546b34d531cc0d6ccefea '
  + 'e12e996539efefcaa605d30d e26f93373324b5f606be4ad6 e4730566deb299cce0c5958e e6ab1bd7d0acd3cfbd6e4cb8 ea105d949458b6efc52ebd73 ee126005960cd2a1c059e13d '
  + 'f0aba17a9b23d89c1c75fb9f f82235b5db2bafdde9bb1e5f fe54d926f0f33ff5ccc2313b').split(' '));

/** 「主要な取り組み」欄の文言（事業名ではない）。シート見出し部で事業名より前に出る場合があるため除外する。 */
const MAINS = new Set(['政策体系に基づかないその他の事業', 'まず一歩、健康はウオーキングから', 'みんなの活動を、みんなで支える', 'チャレンジ、自分で学べる教育支援',
  'みんなのまちを、みんなでつくる', 'まもる農業、残す里山', 'みんなにやさしく、楽しく子育て', '「もしも」の時に備え、生き残る', '発達支援は、早期発見、早期医療',
  'スクラップorリノベーション＆ビルド', '若者のチカラと生涯学習で未来を', '介護のいらないライフプラン', '外国人市民も地域のパートナー', '地球とまちの環境を守る',
  '「働く」から「働きたい」場所へ', '外国人児童生徒の教育支援', 'みんなの目で見守る防犯・交通安全', '変わる、はじまる、みのかもツーリズム']);
const SKIP = new Set(['主要な取り組み', '小事業', '中事業', '目指す姿', 'ＫＰＩ', '大事業', '−', '‑', '―', '目標値 −', '目標値 ‑', '実', '績']);
const NAME_END = /(?:事業|事務|業務|費|管理|補助金|経費)(?:（定住）)?$/;
const AMOUNT = /^\d{1,3}(?:,\d{3})*$/;
const YEARS = [2020, 2021, 2022, 2023, 2024];

type Line = { s: string; start: number };
function lines(text: string, from: number, to: number): Line[] {
  const out: Line[] = [];
  let pos = from;
  for (const s of text.slice(from, to).split('\n')) { out.push({ s, start: pos }); pos += s.length + 1; }
  return out;
}

function sheet(input: CachedInput, from: number, to: number): ProjectEvaluation | null {
  const t = input.text, s = t.slice(from, to);
  const head = /^会計区分\n\n(\d\d)\n\n令和６年度\n\n[^\n]+\n６つのまちづくり宣言 [^\n]+\n\n大事業\n\n事業評価書\n\n事業主体\n/.exec(s);
  if (!head) return null;
  const goalAt = s.indexOf('目標年度');
  const smallAt = s.indexOf('小事業');
  if (goalAt < 0 || smallAt < 0 || smallAt > goalAt) return null;
  // 事業名: 「小事業」欄から「目標年度」までの見出し部で、ラベル・コード・主要な取り組み文言・KPI文言を除いた最初の行。
  const cands = lines(t, from + smallAt, from + goalAt).filter(l => l.s && !SKIP.has(l.s) && !/^\d+$/.test(l.s) && !MAINS.has(l.s) && !/^[①②③]/.test(l.s));
  const name = cands[0];
  if (!name || !NAME_END.test(name.s)) return null;
  const codes = /\n(\d{8})\n[\s\S]*?中事業\n\n(\d\d)\n\n(?:主要な取り組み\n\n(?:[^\n]+\n\n)?)?小事業\n\n(\d\d)\n/.exec(s.slice(0, goalAt));
  const code = codes ? `${head[1]}-${codes[1]}-${codes[2]}-${codes[3]}` : null;
  const p = project(input, code ?? name.s, name.s, null, name.s, name.start);
  p.projectCode = code;
  p.evaluatedFiscalYear = 2024;
  p.evidence.push(evidence(input, head[0].trimEnd(), from));
  // 担当（事業主体）: 「事業主体」から「目指す姿」までに1行だけある「○○部 ○○課」形式の行。
  const ownerEnd = s.indexOf('目指す姿');
  const depts = ownerEnd > 0 ? lines(t, from, from + ownerEnd).filter(l => /^(?:\S+部|健康こども|教育委員事|農業委員会) \S+$/.test(l.s)) : [];
  if (depts.length === 1) { p.department = depts[0].s; p.evidence.push(evidence(input, depts[0].s, depts[0].start)); }
  if (codes) {
    p.evidence.push(evidence(input, codes[0].slice(1, -1), from + codes.index + 1));
  }
  const notes: string[] = ['令和６年度事業評価書（各年度の予算額・決算額と指標の推移はR02〜R06、「実績からR07年度の事業の方向性」を記載）。評価対象年度は表題の「令和６年度」とし、評価実施年度は本文に明記がないため未設定。',
    '事業名は見出し部の「小事業」欄、担当は「事業主体」欄の原文（「教育委員事」「スポ振課」等、PDFのセル幅で切れた略記を含む）。事業番号は会計区分-事業主体コード-中事業-小事業。'];

  // 事業費（千円）: 「決算額」の直前に予算額5列（R02〜R06）、直後に決算額5列が並ぶ場合のみ。全年度で決算額≦予算額を確認。
  const yen = s.indexOf('(千円)');
  const settle = yen >= 0 ? s.indexOf('\n決算額\n', yen) : -1;
  let amountsOk = false;
  if (settle > 0) {
    const before = lines(t, from + yen, from + settle).filter(l => l.s && !/^R0\d$/.test(l.s) && l.s !== '(千円)');
    const budget = before.slice(-5);
    const tail = before.slice(0, -5);
    const after: Line[] = [];
    for (const l of lines(t, from + settle + '\n決算額\n'.length, to)) { if (!l.s) continue; if (!AMOUNT.test(l.s)) break; after.push(l); }
    const actual = after.slice(0, 5);
    const n = (x: Line) => Number(x.s.replaceAll(',', ''));
    if (tail.length === 0 && budget.length === 5 && budget.every(l => AMOUNT.test(l.s)) && actual.length === 5 && actual.every((a, i) => n(a) <= n(budget[i]))) {
      const raw = t.slice(budget[0].start, actual[4].start + actual[4].s.length);
      YEARS.forEach((fy, i) => {
        p.amounts.push(amount(input, 'budget', fy, budget[i].s, '千円', raw, budget[0].start));
        p.amounts.push(amount(input, 'actual', fy, actual[i].s, '千円', raw, budget[0].start));
      });
      amountsOk = true;
      notes.push('金額は「事業費(千円)」欄で「決算額」の直前の5値を予算額、直後の5値を決算額としてR02〜R06（令和2〜6年度）の順に対応づけた（全年度で決算額≦予算額を確認）。予算額が5値そろわない・間に他の文字が入るシートは転記していない。');
    }
  }
  if (!amountsOk) notes.push('事業費（予算額・決算額）は抽出テキストで5年度分の列がそろわない（空欄または段組み崩れ）ため転記していません。');

  // 指標: 「目標値／実績値」の5値ブロックが2つあり、1つ目が活動指標（アウトプット）、2つ目がＫＰＩ（アウトカム）。
  const blocks = [...s.matchAll(/目標値\n\n((?:[^\n]+\n\n)+?)実績値\n\n((?:[^\n]+\n\n)+?)(?=[^\n]*[^\d,.\n%％])/g)];
  const act = /活 動 指\n\n((?:[^\n]+\n)*?[^\n]+)\n\nR0\d\n/.exec(s), kpi = /Ｐ Ｉ \(単位\)\n\n((?:[^\n]+\n)*?[^\n]+)\n\nR0\d\n/.exec(s);
  const vals = blocks.map(b => [b[1].split('\n\n').slice(0, -1), b[2].split('\n\n').slice(0, -1)]);
  const okName = (m: RegExpExecArray | null) => m !== null && !/^R0\d$/.test(m[1]) && !m[1].includes('。');
  if (blocks.length === 2 && okName(act) && okName(kpi) && act && kpi && vals.every(([g, a]) => g.length === 5 && a.length === 5 && [...g, ...a].every(v => /^[\d,.]+$/.test(v)))) {
    const add = (label: RegExpExecArray, b: RegExpMatchArray, [g, a]: string[][]) => {
      const name = label[1].replace(/\n/g, '');
      const ev = evidence(input, b[0].trimEnd(), from + b.index!);
      p.evidence.push(evidence(input, label[1], from + label.index + label[0].indexOf(label[1])));
      YEARS.forEach((fy, i) => p.indicators.push({ name, fiscalYear: fy, target: g[i], actual: a[i], unit: null, evidence: ev } satisfies EvaluationIndicator));
    };
    add(act, blocks[0], vals[0]);
    add(kpi, blocks[1], vals[1]);
    notes.push('指標は「活動指標（アウトプット）」「ＫＰＩ（アウトカム）」の目標値・実績値がともにR02〜R06の5値そろう場合のみ、出現順（1つ目＝活動指標、2つ目＝ＫＰＩ）で転記。単位は指標名の括弧書きにある場合のみで、単位欄は空。指標名はPDFの改行を除いて連結。');
  } else notes.push('活動指標・ＫＰＩは5年度分の値がそろわない、または指標名と値の対応が確定できないため転記していません。');
  notes.push('施策のＫＰＩ（まちづくり宣言の目標値）、背景・目的・実績・分析の文章は段組み崩れのため転記していません。');
  p.warnings.push(...notes);
  return p;
}

function one(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '21211' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, starts = [...t.matchAll(/(?:^|\n)会計区分\n/g)].map(m => m.index! + (m[0].startsWith('\n') ? 1 : 0));
  return starts.map((s, i) => sheet(input, s, starts[i + 1] ?? t.length)).filter((p): p is ProjectEvaluation => p !== null);
}

export const minokamoEntries: Record<string, Entry> = {
  '21211': {
    extract: (input, inputs) => acrossDocuments(input, inputs, one, p => `${p.projectCode ?? ''}|${p.projectName}|${p.evaluatedFiscalYear}`),
    scope: '美濃加茂市「令和６年度 事業評価書」（小事業ごとのシート）の事業名・事業主体（担当課）・事業番号、列がそろう場合の予算額・決算額（R02〜R06、千円）と活動指標・ＫＰＩの目標値/実績値。施策ＫＰＩ、背景・目的・分析の文章、列が崩れた金額・指標は対象外。',
  },
};
