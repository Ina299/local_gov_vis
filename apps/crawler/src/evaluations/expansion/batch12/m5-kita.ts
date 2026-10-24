import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { amount, eraYear, num, rating } from '../batch8/h6-util';
import { type Entry, groupAt, municipal } from './m5-util';

/* ---------- 13117 北区 令和8年度北区事務事業評価（令和7年度の中期計画事業） ---------- */

const KITA_TITLE = '令和 8 年度北区事務事業評価\n';
const KITA_SHEET = /\n事務事業評価\n中期計画番号︓\n\n評価対象年度 令和7年度\n\n(\d{3})\n\n事業名︓ ([^\n]+)\n主管課︓ ([^\n]+)\n/dg;
const KITA_POLICY = '(維持・推進|検討・見直し|完了・完成|休止|統合|再開|廃止)';
const KITA_PROGRESS = 'S（計画を超えて進捗し、前倒し）／A（ほぼ計画通り進捗、90%以上）／B（概ね 7 割以上進捗、70％以上）／C（計画を下回って進捗、年度に遅れが生じている、70％未満）／D（未着手）／E（その他、対象期間外事業など）';
const KITA_SCALE = '維持・推進／検討・見直し／完了・完成／休止／統合／再開／廃止';

function kita(input: CachedInput): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(KITA_TITLE)) return [];
  const heads = [...t.matchAll(KITA_SHEET)];
  // 「（２）事務事業評価」の一覧表のうち、番号・事業名・進捗・評価が1行ずつ連続して読める行。
  const table = new Map<string, RegExpMatchArray>();
  const end = heads[0]?.index ?? 0;
  for (const m of t.slice(0, end).matchAll(new RegExp(`\\n(\\d{3})\\n\\n([^\\n]+)\\n\\n([SABCDE])\\n\\n${KITA_POLICY}\\n`, 'g'))) table.set(m[1], m);
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const s = h.index!, sheet = t.slice(s, heads[i + 1]?.index ?? t.length);
    const [, no, name, dept] = h;
    const p = project(input, no, name.trim(), 2026, name, groupAt(h, 2));
    p.evaluatedFiscalYear = 2025; p.department = dept.trim();
    p.evidence.push(evidence(input, h[0].trim(), s + 1), evidence(input, KITA_TITLE.trim(), 0));
    const notes: string[] = [];

    // 予算額・決算額（千円）: 事業費全体＝一般財源＋特定財源 が5列とも成り立つ場合だけ。
    // 列は (参考)令和6年度 当初予算・決算、令和7年度 当初予算・決算(見込)、令和8年度 当初予算 の順。
    const b = /■予算額・決算額（単位︓千円）\n[\s\S]*?\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n一般財源\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n特定財源\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n\n([\d,]+)\n/d.exec(sheet);
    const head = b && b[0].slice(0, b[0].indexOf(`\n${b[1]}\n`));
    const ok = b && head && !/\d/.test(head.replace(/令和[678]年度/g, '').replace('（単位︓千円）', '')) && /決算\(見込[）)]/.test(head)
      && [0, 1, 2, 3, 4].every(k => num(b[k + 1]) === num(b[k + 6]) + num(b[k + 11]));
    if (b && ok && sheet.includes('(参考）令和6年度')) {
      ([[1, 'budget', 2024], [2, 'actual', 2024], [3, 'budget', 2025], [5, 'budget', 2026]] as const).forEach(([g, kind, year]) =>
        p.amounts.push(amount(input, kind, year, b[g], '千円', b[g], groupAt(b, g, s))));
      notes.push('予算額・決算額は事業費全体＝一般財源＋特定財源が5列とも成り立つ表のみ、令和6年度当初予算・決算、令和7・8年度当初予算を記録（令和7年度「決算(見込)」は見込のため未収録）。');
    } else notes.push('予算額・決算額の表は列の並びが確定できないため未収録。');

    // 進捗度と事業部の評価: シートの先頭（評価対象年度の太枠）の値が、冒頭一覧表の同じ番号・事業名の行と一致する場合だけ。
    const prog = /\n事業の進捗状況\n\n([SABCDE])（[^\n]*）\n/d.exec(sheet);
    const pol = new RegExp(`\\n■事業部の方針\\n評価\\n(?:今後の方針\\n)?\\n${KITA_POLICY}\\n`, 'd').exec(sheet);
    const row = table.get(no);
    if (prog && pol && row && row[2] === name && row[3] === prog[1] && row[4] === pol[1]) {
      const fullProg = prog[0].trim().split('\n').pop()!;
      p.ratings.push(rating(input, 'self', '事業の進捗状況（令和7年度）', fullProg, KITA_PROGRESS, fullProg, groupAt(prog, 1, s)),
        rating(input, 'self', '事業部の方針 評価（令和7年度）', pol[1], KITA_SCALE, pol[1], groupAt(pol, 1, s)));
      p.evidence.push(evidence(input, row[0].trim(), row.index! + 1));
    } else notes.push('進捗度・事業部の評価はシートの値と冒頭の一覧表の行が対応づけられないため未収録。');
    p.warnings.push('北区 令和8年度事務事業評価（中期計画事業）。中期計画番号を projectCode に記録。評価年度は表題の令和8年度、評価対象年度はシートの「評価対象年度 令和7年度」。',
      `${notes.join('')}事業活動と成果の推移（指標）は計画・実績の列が抽出テキストで崩れているため未収録。右欄（前年度）の値は記録しない。`);
    out.push(p);
  });
  return out;
}

/* ---------- 47382 与那国町 主要施策の成果に関する報告書（令和元〜4年度） ---------- */

const YONA_HEAD = /(令和([元\d０-９]+)年度) ?主要施策の成果に関する ?報告書\n単位：千円\n/g;
const YONA_NAME: [RegExp, boolean][] = [
  [/^事\n\n業\n\n(?:課\n\n)?名 ([^\n]+)\n(?:\n(?:名\n\n)?([^\n]+課)\n)?/d, true],
  [/^事 業 名 ([^\n]+)\n(?:\n([^\n]+課)\n施 策 名)?/d, true],
  [/^事業名\n課 名\n施策名\n事項名\n\n(?:作成者名\n\n)?([^\n]+)\n/d, false],
];

function yonaguni(input: CachedInput): ProjectEvaluation[] {
  const t = input.text, heads = [...t.matchAll(YONA_HEAD)];
  if (!heads.length || !t.slice(0, 40).includes('主要施策の成果に関する報告書')) return [];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, i) => {
    const s = h.index! + h[0].length, sheet = t.slice(s, heads[i + 1]?.index ?? t.length);
    const fy = eraYear('令和', h[2]);
    let n: RegExpExecArray | null = null, withDept = false;
    for (const [re, d] of YONA_NAME) if ((n = re.exec(sheet))) { withDept = d; break; }
    if (!n || fy === null) return;
    const name = n[1].trim();
    if (/(課|課長名|作成者名|名)$/.test(name) || name.length < 3) return;
    const p = project(input, name, name, null, n[1], groupAt(n, 1, s));
    p.projectCode = null; p.evaluatedFiscalYear = fy;
    p.evidence.push(evidence(input, h[0].trimEnd(), h.index!));
    if (withDept && n[2]) { p.department = n[2]; p.evidence.push(evidence(input, n[2], groupAt(n, 2, s))); }
    // 予算執行状況: 予算額・決算額が欄の順に読め、決算額の財源内訳の数値の合計が決算額と一致する場合だけ。
    const b = /\n予算額\n\n決算額\n\n([\d,]+)\n\n([\d,]+)\n\n決算額の財源内訳\n/d.exec(sheet) ?? /\n予算額\n([\d,]+)\n\n決算額\n([\d,]+)\n\n決算額の財源内訳\n/d.exec(sheet);
    let note = '予算額・決算額は欄の対応が確定できないため未収録。';
    if (b) {
      const rest = sheet.slice(b.index + b[0].length), stop = rest.indexOf('報告書');
      const parts = stop < 0 ? [] : [...rest.slice(0, stop).matchAll(/[\d,]+/g)].map(m => num(m[0]));
      if (parts.length && parts.reduce((x, y) => x + y, 0) === num(b[2])) {
        p.amounts.push(amount(input, 'budget', fy, b[1], '千円', b[1], groupAt(b, 1, s)), amount(input, 'actual', fy, b[2], '千円', b[2], groupAt(b, 2, s)));
        note = '予算額・決算額は財源内訳の合計が決算額と一致する表のみ記録（単位：千円）。予算額は補正後かどうか本文に明示がない。';
      }
    }
    p.warnings.push(`与那国町 ${h[1]}主要施策の成果に関する報告書の事業別シート。表題の年度を評価対象年度とし、評価実施年度は明示がないため未設定。`,
      `${note}事業の目的・実施内容・成果は文章のため未構造化。担当課は事業名の直後に課名が読める場合のみ。`);
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '13117': { extract: municipal('13117', kita), scope: '北区 令和8年度事務事業評価（中期計画事業、令和7年度対象）の事業別シートの中期計画番号・事業名・主管課と、財源内訳で検算できる令和6年度当初予算・決算額と令和7・8年度当初予算、冒頭一覧表と一致する進捗度・事業部の評価。指標・決算見込額・前年度欄・文章欄は対象外。' },
  '47382': { extract: municipal('47382', yonaguni), scope: '与那国町 主要施策の成果に関する報告書（令和元〜4年度）の事業別シートの事業名・担当課・評価対象年度と、財源内訳の合計で検算できる予算額・決算額。主要事業一覧・事業の目的/実施内容/成果の文章・事業費内訳表は対象外。' },
};
