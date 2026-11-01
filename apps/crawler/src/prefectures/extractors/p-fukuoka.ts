import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, nfkc, num, type Entry } from '../../evaluations/expansion/batch9/i1-util';

// ---------------------------------------------------------------- 福岡県（事務事業評価書（様式１号）、部局別の分冊 PDF。令和6・7年度）
const SHEET = /（様式１号）\n/g;
const N = String.raw`\d{1,3}(?:,\d{3})*`;
const TOKEN = new RegExp(String.raw`^(${N}|-|－|―)$`, 'gm');
const LABEL = /^(事 業 名|事業名|部課\(室\)|部|課\(室\)|課|\(室\)|総|合|計|画|4つ|の柱|小項目|中項目|１|事業のねらい・目的|事業|開始年度|Ｒ[０-９]+年度)$/;

type Tok = { v: string; off: number };
const val = (t: Tok) => (/^\d/.test(t.v) ? num(t.v) : null);
const lines = (x: string) => x.split('\n');
/** 部局の段落: 先頭行に部・庁を含み、課・室・局等を含む短い段落。 */
const isDept = (x: string) => !lines(x).some(l => LABEL.test(l)) && /部|庁/.test(lines(x)[0]) && /課|室|局|担当|センター/.test(x) && lines(x).length <= 4 && !/事業/.test(x);
/** 事業名の段落: 欄名・番号だけの行・総合計画欄の文言を含まず、部局の段落でもない。 */
const okName = (x: string) => lines(x).every(l => !LABEL.test(l) && !/^\d+$/.test(l.trim()) && !/中項目|具体的|総合計画|の柱|事業のねらい|事業名$/.test(l))
  && !/^(警察本部|教育庁)|部$/.test(lines(x)[0]) && !isDept(x) && /事業|[費金ト）)]$/.test(x.trim());

/** 段落（空行区切り）。off は input.text での位置。 */
function paragraphs(t: string, from: number, to: number): { text: string; off: number }[] {
  const out: { text: string; off: number }[] = [];
  let pos = from;
  for (const part of t.slice(from, to).split('\n\n')) {
    const lead = part.length - part.replace(/^\n+/, '').length, body = part.replace(/^\n+/, '').replace(/\n+$/, '');
    if (body.trim()) out.push({ text: body, off: pos + lead });
    pos += part.length + 2;
  }
  return out;
}
/** 折り返しの改行を詰める（「・」「（」「①」等で始まる行の前の改行は残す）。 */
const unwrap = (x: string) => x.split('\n').map(l => l.trim()).reduce((acc, l, i) => (i === 0 ? l : /^(?:[・（(①-⑳○〇●■◆※＜<【［\[０-９]|\d+[ ．.、）)])/.test(l) ? `${acc}\n${l}` : acc + l), '');
/** 見出し部分の欄の文字・値だけの行。 */
const HEADCELL = /^(?:事業|開始年度|事業開始年度|事 業|[RHＲＨ](?:[0-9０-９]+|元)|[0-9０-９]+)$/;
const fyOf = (y: string) => (y[0] === 'H' ? 1988 : 2018) + Number(y.slice(1));

/**
 * 目的・事業概要・実績の評価・成果指標。
 *  - 目的: 「１ 事業のねらい・目的」の本文（「２ 事業概要」の見出しまで）。
 *  - 事業内容: 「２ 事業概要」の本文（「３ 成果指標及び進捗状況」の見出しが直後に続く場合のみ。【…図】等の図の見出し以降は図中の文字のため除く）。
 *  - 成果: 「【R◯年度の実績値に対する評価とその要因】」の（評価）の本文（（評価）（要因）が1組だけの場合）。
 *  - 指標: 「３ 成果指標及び進捗状況」の表が、成果指標名・「目標／実績」・年度ごとの（年度, 目標, 実績）の段落だけからなる場合のみ。
 * 「５ 見直しの内容」（継続／拡充／改善／終了…）は選んだ印が抽出テキストに残らないため判定は収録しない。
 */
function describe(input: CachedInput, s: number, sheet: string, p: ProjectEvaluation): void {
  const t = input.text;
  const pm = /事業のねらい・目的\n\n?([^]*?)\n\n?２(?:\n\n| )事業概要\n/.exec(sheet);
  if (pm) {
    // 見出し部分の欄（「事業／開始年度」とその値、総合計画の番号）が本文の前後に紛れ込むことがあるため、前後のその行だけ除く。
    // 本文の途中に欄の文字や課名だけの行がある場合は収録しない。
    const ls = pm[1].split('\n');
    let a = 0, b = ls.length;
    while (a < b && (HEADCELL.test(ls[a].trim()) || !ls[a].trim())) a++;
    while (b > a && (HEADCELL.test(ls[b - 1].trim()) || !ls[b - 1].trim())) b--;
    const body = ls.slice(a, b);
    if (body.length && !body.some(l => HEADCELL.test(l.trim()) || /^[^。、]{1,14}(?:課|部|局|室)$/.test(l.trim()))) {
      const raw = body.join('\n'), off = s + pm.index + pm[0].indexOf(pm[1]) + ls.slice(0, a).reduce((n, l) => n + l.length + 1, 0);
      p.purpose = unwrap(raw.split('\n\n').join('\n'));
      p.evidence.push(evidence(input, raw, off));
    }
  }
  const am = /\n事業概要\n\n?([^]*?)\n\n?３(?:\n\n| )成果指標及び進捗状況\n/.exec(sheet);
  if (am) {
    const fig = /\n【[^】\n]*(?:図|スキーム|イメージ|フロー|スケジュール)[^】\n]*】/.exec(am[1]);
    const raw = (fig ? am[1].slice(0, fig.index) : am[1]).replace(/\n+$/, '');
    // 番号だけの行や（１）（２）の記号だけが並ぶ行があるものは、段組みの表が崩れているため収録しない。
    const rl = raw.split('\n');
    if (raw.trim() && !rl.some(l => /^[0-9０-９]+$/.test(l.trim()) || /[⑴-⒇]{2}/.test(l)) && rl.filter(l => /^[○〇・●]$/.test(l.trim())).length < 2) {
      p.activities = unwrap(raw.split('\n\n').join('\n'));
      p.evidence.push(evidence(input, raw, s + am.index + am[0].indexOf(am[1])));
    }
  }
  const ev = /【R\d+ ?年度の実績値に対する評価とその要因】\n/.exec(sheet);
  if (ev) {
    const endM = /\n(?:（上記を踏まえた|【効率的な事業)/.exec(sheet.slice(ev.index));
    const sec = endM ? sheet.slice(ev.index, ev.index + endM.index) : '';
    const om = /^【[^】]+】\n（評価）\n([^]+?)\n\n?（要因）\n/.exec(sec);
    if (om && (sec.match(/（評価）/g) ?? []).length === 1 && (sec.match(/（要因）/g) ?? []).length === 1 && om[1].trim()) {
      p.outcomes = unwrap(om[1]);
      p.evidence.push(evidence(input, om[1], s + ev.index + om[0].indexOf(om[1])));
    }
  }
  const i0 = sheet.indexOf('成果指標及び進捗状況\n'), i1 = sheet.indexOf('【成果指標の設定根拠】', i0);
  if (i0 < 0 || i1 < 0) return;
  const ps = paragraphs(t, s + i0 + '成果指標及び進捗状況\n'.length, s + i1);
  let name: { text: string; off: number } | null = null, labels = 0;
  const rows: { y: string; tv: string; av: string | null; off: number; end: number }[] = [];
  for (const x of ps) {
    const ls = x.text.split('\n');
    if (ls[0] === '成果指標' && !name && !rows.length) {
      if (ls.length > 1) name = { text: ls.slice(1).join('\n'), off: x.off + '成果指標\n'.length };
      continue;
    }
    if (x.text === '目標\n実績') { labels++; continue; }
    if (/^[RH]\d+$/.test(ls[0])) {
      if (ls.length > 3 || ls.slice(1).some(l => l.length > 20)) return;
      if (ls.length === 3) rows.push({ y: ls[0], tv: ls[1].trim(), av: ls[2].trim(), off: x.off, end: x.off + x.text.length });
      // 値が1つだけの年度は、目標・実績のそろった年度より後（将来の年度）なら目標値。それより前のものは目標か実績か定まらないため収録しない。
      else if (ls.length === 2 && rows.length) rows.push({ y: ls[0], tv: ls[1].trim(), av: null, off: x.off, end: x.off + x.text.length });
      continue;
    }
    if (!name && !rows.length && ps[0].text === '成果指標' && !/^[\d,.\-－―%％]+$/.test(x.text)) { name = x; continue; }
    return;
  }
  if (!name || labels !== 1 || !rows.length || name.text.split('\n').some(l => /^[RH]\d+$|^[\d,.]+$|^目標$|^実績$/.test(l.trim()))) return;
  // 目標だけの年度の後に目標・実績のそろった年度が来る形は、並びが崩れているため対象外。
  const full = rows.map(r => r.av !== null);
  if (full.includes(false) && full.lastIndexOf(true) > full.indexOf(false)) return;
  const nm = name.text.split('\n').map(l => l.trim()).join('');
  const unit = /（(百万円|千円|億円|円|万人|千人|人|件|社|回|日|時間|校|団体|戸|箇所|か所|カ所|ha|t|％|%)）/.exec(nm)?.[1] ?? null;
  for (const r of rows) p.indicators.push({ name: nm, fiscalYear: fyOf(r.y), target: r.tv, actual: r.av, unit, evidence: evidence(input, t.slice(name.off, r.end), name.off) });
}

function extractFukuoka(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40000' || input.format !== 'pdf') return [];
  const t = input.text;
  if (!t.includes('事務事業評価書（')) return [];
  const starts = [...t.matchAll(SHEET)].map(m => m.index!);
  const out: ProjectEvaluation[] = [];
  starts.forEach((s, k) => {
    const sheet = t.slice(s, starts[k + 1] ?? t.length);
    const hy = /\nＲ([０-９]+)年度\n/.exec(sheet);
    if (!hy) return;
    const ey = 2018 + Number(hy[1].normalize('NFKC'));
    // 見出し部分（「事業概要」より前）を空行で段落に分ける。
    const hEnd = sheet.indexOf('事業概要');
    const header = sheet.slice(0, hEnd > 0 ? hEnd : Math.min(sheet.length, 1500));
    const paras: { text: string; off: number }[] = [];
    for (let pos = 0; pos < header.length;) {
      const end = header.indexOf('\n\n', pos);
      const stop = end < 0 ? header.length : end;
      if (stop > pos) paras.push({ text: header.slice(pos, stop).replace(/^\n+/, ''), off: s + pos + (header.slice(pos, stop).length - header.slice(pos, stop).replace(/^\n+/, '').length) });
      pos = stop + 2;
    }
    // 部・課(室): 見出し部分で部局の段落が1つだけの場合のみ。
    const depts = paras.filter(x => isDept(x.text));
    const dp = depts.length === 1 ? depts[0] : null;
    // 事業名: 「事務事業評価書（既存事業分）」の直後の段落、または欄名「部／課(室)」の直後の段落。末尾の番号だけの行（総合計画欄の柱番号）は除く。
    const trim = (x: { text: string; off: number }) => {
      const ls = lines(x.text);
      while (ls.length > 1 && /^\d+$/.test(ls[ls.length - 1].trim()) && /(事業|費|金|）)$/.test(ls[ls.length - 2].trim())) ls.pop();
      return { text: ls.join('\n'), off: x.off };
    };
    const after = (re: RegExp) => {
      const m = re.exec(sheet);
      if (!m) return null;
      const at = s + m.index + m[0].length;
      return paras.find(x => x.off === at) ?? null;
    };
    const cands = [after(/事務事業評価書（[^）\n]+）\n\n?/), after(/\n部\n課(?:\(室\)|\n\(室\))\n\n/)].filter(Boolean).map(x => trim(x!)).filter(x => okName(x.text));
    if (!cands.length) return;
    const nameRaw = cands[0].text, nameOff = cands[0].off;
    const name = lines(nameRaw).map(l => l.trim()).join('');
    const p = project(input, `${k}|${nfkc(name)}`, name, ey, nameRaw, nameOff);
    p.evidence.push(evidence(input, `Ｒ${hy[1]}年度`, s + hy.index + 1));
    if (dp) {
      const [first, ...rest] = lines(dp.text).map(l => l.trim()).filter(l => !/^\d+$/.test(l));
      // 課名の途中で折り返した行は詰め、課・室等で終わる行の次は別の課として空白で区切る。
      p.department = [first, ...rest].reduce((acc, l, i) => (i === 0 ? l : /(部|局|課|室|担当|センター)$/.test(acc) ? `${acc} ${l}` : acc + l), '');
      p.evidence.push(evidence(input, dp.text, dp.off));
    } else p.warnings.push('部・課(室)の欄が抽出テキストで一つに特定できないため担当部局は未収録。');
    const ef = /【R(\d+) ?年度の実績値に対する評価/.exec(sheet);
    if (ef) { p.evaluatedFiscalYear = 2018 + Number(ef[1]); p.evidence.push(evidence(input, ef[0], s + ef.index)); }
    describe(input, s, sheet, p);

    // ４ 事業費（千円）: 歳出／うち一般財源／人件費（時間）／人件費（千円）の4行×3列（列見出し Rn 決算・Rn 当初）。
    const c0 = sheet.indexOf('事業費（千円）'), c1 = sheet.indexOf('見直しの内容', c0);
    const section = c0 >= 0 && c1 > c0 ? sheet.slice(c0, c1) : '';
    const heads = [...section.matchAll(/(?:^|\n)(?:事業費（千円） )?R(\d+) (決算|当初)(?=\n)/g)];
    const toks: Tok[] = [...section.matchAll(TOKEN)].map(m => ({ v: m[1], off: s + c0 + m.index! }));
    const years = heads.map(h => 2018 + Number(h[1]));
    if (heads.length !== 3 || years[1] !== years[0] + 1 || years[2] !== years[1] + 1 || toks.length !== 12) {
      p.warnings.push('事業費の表（歳出・一般財源・人件費の4行×3列）が抽出テキストで揃わないため金額は未収録。');
      out.push(p); return;
    }
    const g = [0, 1, 2, 3].map(i => toks.slice(i * 3, i * 3 + 3));
    // 人件費の時間（h）と千円（y）の組: 値のある列で y/h（1時間あたり単価、千円）が 3.5〜5.0 かつ列間の差が1割以内。空欄・0 は両方そろう。
    const isPersonnel = (h: Tok[], y: Tok[]) => {
      const rates: number[] = [];
      const ok = h.every((x, c) => {
        const a = val(x), b = val(y[c]);
        if (a === null || a === 0 || b === null || b === 0) return (a === null || a === 0) && (b === null || b === 0);
        rates.push(b / a);
        return b / a >= 3.5 && b / a <= 5;
      });
      return ok && rates.length > 0 && Math.max(...rates) / Math.min(...rates) <= 1.1;
    };
    // 歳出 ≥ うち一般財源（各列）。
    const dominates = (a: Tok[], b: Tok[]) => a.every((x, c) => {
      const u = val(x), v = val(b[c]);
      return u === null ? v === null : v === null ? false : u >= v;
    });
    const fits: number[][] = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i === j || !isPersonnel(g[i], g[j])) continue;
      const rest = [0, 1, 2, 3].filter(x => x !== i && x !== j);
      if (dominates(g[rest[0]], g[rest[1]])) fits.push(rest);
    }
    if (fits.length !== 1) {
      p.warnings.push('事業費の表で歳出の行を検算（人件費の時間と金額の比、歳出≧うち一般財源）で特定できないため金額は未収録。');
      out.push(p); return;
    }
    const spend = g[fits[0][0]];
    const raw = sheet.slice(c0, toks[11].off - s + toks[11].v.length);
    spend.forEach((x, c) => {
      if (val(x) === null || val(x) === 0) return;
      p.amounts.push(amount(input, heads[c][2] === '決算' ? 'actual' : 'budget', years[c], x.v, '千円', raw, s + c0));
    });
    p.warnings.push('金額は「４ 事業費（千円）」の歳出の行（列見出しの R 年度・決算／当初の別で収録）。歳出の行は、人件費（時間・千円）の行の比と「歳出≧うち一般財源」の検算で一意に特定できた場合のみ収録。人件費・一般財源は未収録。0・空欄は収録していない。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '40000': {
    extract: (input) => extractFukuoka(input),
    scope: '令和6・7年度 事務事業評価書（様式１号、部局別の分冊 PDF）の事業名・部・課(室)・評価年度・実績評価の対象年度・事業費の歳出（決算・当初予算。行の特定を検算できた表のみ）、事業のねらい・目的、事業概要（段組みや図が崩れていないもののみ）、実績値に対する評価（（評価）欄）、成果指標の目標・実績（1指標の表で年度ごとの並びが確定するもののみ）。見直しの内容（選択の印が抽出テキストに残らない）、行政評価概要一覧（評価書の再掲）、政策事前評価書、公共事業再評価・研究開発事業の総括表は対象外。',
  },
};
