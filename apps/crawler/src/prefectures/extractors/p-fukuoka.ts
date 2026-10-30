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
    scope: '令和6・7年度 事務事業評価書（様式１号、部局別の分冊 PDF）の事業名・部・課(室)・評価年度・実績評価の対象年度・事業費の歳出（決算・当初予算。行の特定を検算できた表のみ）。行政評価概要一覧（評価書の再掲）、政策事前評価書、公共事業再評価・研究開発事業の総括表、成果指標は対象外。',
  },
};
