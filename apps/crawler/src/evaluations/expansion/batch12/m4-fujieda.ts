import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project, stableId } from '../shared';
import { amount, nfkc, type Entry } from '../batch9/i1-util';
import { municipalityRecords } from '../batch11/k0-util';

/**
 * Length-preserving normalization: each character is replaced by its NFKC form only when that form is a single
 * UTF-16 unit (康熙部首 ⽅→方, 全角数字, ︓→: など). Offsets in the mapped text equal offsets in the source text.
 */
export function mapped(s: string): string {
  let out = '';
  for (const c of s) { const n = KANGXI_EXTRA[c] ?? c.normalize('NFKC'); out += n.length === 1 && c.length === 1 ? n : c; }
  if (out.length !== s.length) throw new Error('length-preserving normalization failed');
  return out;
}
export const eraYear = (era: string, n: string) => (era === '令和' ? 2018 : 1988) + (n === '元' ? 1 : Number(nfkc(n)));

/** Lines of a text with absolute offsets. */
export function lines(text: string, base: number): { start: number; s: string }[] {
  return [...text.matchAll(/[^\n]*/g)].filter(m => m[0].length || m.index! < text.length).map(m => ({ start: base + m.index!, s: m[0] }));
}

// ------------------------------------------------------------------ 藤枝市（行政サービス評価委員会 地方創生交付金事業評価シート）
const FUJIEDA_LABEL = /^(事業名|事業開始年月.*|事業終了年月.*|交付金名|事業№|作成責任者|事業目的|担当課|事業費|事業概要|事業経費内訳|総合戦略基本方針.*|政策パッケージ.*|総合戦略施策名.*|\d+|(令和|平成)\S*年\S*月|R\d+\.\d+)$/;
const RATING = /(事業の有効性|事業の効率性|事業の総合効果)\s+[^\n]*?か。[ \n]*([1-4]:[^\n]*た)\n/g;
/** 各設問の選択肢に固有の語。設問と値の語が合わない（列ずれの疑い）ときは採用しない。 */
const RATING_WORD: Record<string, RegExp> = { 事業の有効性: /KPI/, 事業の効率性: /効率|低コスト/, 事業の総合効果: /地方創生/ };
const KANGXI_EXTRA: Record<string, string> = { '⺠': '民', '⻑': '長', '⻘': '青', '⻄': '西', '⻫': '斉', '⻤': '鬼', '⻝': '食', '⻩': '黄', '⻭': '歯' };

export function extractFujieda(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '22214') return [];
  const raw = input.text, t = mapped(raw);
  const committee = /^<資料[^\n]*>\s*\n+\s*(令和|平成)(\S+?)年度\s*\n*\s*藤枝市行政サービス評価委員会/.exec(t);
  if (!committee) return [];
  const evaluationYear = eraYear(committee[1], committee[2]);
  const heads = [...t.matchAll(/^(令和|平成)(\S+?)年度(?:\(令和(\S+?)年度実績\))?[^\n]*$(?=\n事業名\n)/gm)];
  // シート見出し（通常は「…事業評価シート」。令和4年度資料に「令和３年度高齢者活躍のまちづくり推進事業」という見出しの誤記1件）は直後が「事業名」欄の行。
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, end = heads[k + 1]?.index ?? t.length, sheet = t.slice(start, end);
    const fy = h[3] ? eraYear('令和', h[3]) : eraYear(h[1], h[2]);
    const ls = lines(sheet, start).slice(1);
    // 事業名: 見出し直後のラベル以外の最初の行。次の非空行がラベル・日付・番号でなければ（折り返しの疑い）採用しない。
    const content = ls.filter(l => l.s.trim().length);
    const ni = content.findIndex(l => !FUJIEDA_LABEL.test(l.s.trim()));
    if (ni < 0) return;
    const nameLine = content[ni], name = nameLine.s.trim();
    if (/交付金|^[(]|[)]$/.test(name) || !FUJIEDA_LABEL.test(content[ni + 1]?.s.trim() ?? '')) return;
    const nameRaw = raw.slice(nameLine.start, nameLine.start + nameLine.s.length).trim();
    const nameOff = raw.indexOf(nameRaw, nameLine.start);
    const projectName = mapped(nameRaw).replace(/\s+/g, ' ');
    const p = project(input, nfkc(projectName), projectName, evaluationYear, nameRaw, nameOff);
    // 同じ資料に同名事業の別年度シートがあるため、ID は評価対象年度も含めて作る（事業番号はシート間で共通でないため projectCode は未設定）。
    p.evaluatedFiscalYear = fy; p.projectCode = null; p.id = stableId(input, `${nfkc(projectName)}|${fy}`, evaluationYear);
    p.evidence.push(evidence(input, raw.slice(start, start + h[0].length), start), evidence(input, raw.slice(committee.index, committee.index + committee[0].length), committee.index));
    // 担当課: 見出しから「うち交付金充当額」までの間で課・室等で終わる短い行がちょうど1つのとき。
    const upTo = sheet.indexOf('うち交付金充当額');
    if (upTo > 0) {
      const depts = lines(sheet.slice(0, upTo), start).filter(l => /^[^\s、。:]{2,25}(課|室|局|センター)(\([^)]*\))?$/.test(l.s.trim()) && !/交付金/.test(l.s) && !FUJIEDA_LABEL.test(l.s.trim()));
      if (depts.length === 1) {
        const d = depts[0], draw = raw.slice(d.start, d.start + d.s.length).trim(), doff = raw.indexOf(draw, d.start);
        p.department = mapped(draw);
        p.evidence.push(evidence(input, draw, doff));
      }
    }
    for (const m of sheet.matchAll(RATING)) {
      if (!RATING_WORD[m[1]].test(m[2])) continue;
      const off = start + m.index!, len = m[0].length - 1;
      const valOff = off + m[0].lastIndexOf(m[2]);
      p.ratings.push({ kind: 'self', label: m[1], value: mapped(raw.slice(valOff, valOff + m[2].length)), scale: null, evidence: evidence(input, raw.slice(off, off + len), off) });
    }
    const policy = /今後の方針\n\n([^\n]{2,20})\n\n今後の方針理由/.exec(sheet);
    if (policy) {
      const off = start + policy.index!, len = policy[0].length;
      p.ratings.push({ kind: 'self', label: '今後の方針', value: mapped(policy[1]), scale: null, evidence: evidence(input, raw.slice(off, off + len), off) });
    }
    if (new Set(p.ratings.map(r => r.label)).size !== p.ratings.length) return; // 同じ項目が2回現れる＝列対応が不確定
    // 金額: 見出しに「（令和N年度実績）」と明記された様式（令和8年度委員会）のみ、事業費(円)を実績として収録。
    if (h[3]) {
      // 「事業費(円)」の後の最初の金額行＝事業費、「うち交付金充当額(円)」の後の最初の金額行＝充当額。充当額≦事業費の検算が合うときだけ採用。
      const isMoney = (s: string) => /^(\d{1,3}(?:,\d{3})+|0)$/.test(s.trim());
      const le = sheet.indexOf('事業費(円)'), lg = sheet.indexOf('うち交付金充当額(円)');
      const after = (i: number) => lines(sheet.slice(i), start + i).slice(1).find(l => isMoney(l.s));
      const tot = le >= 0 ? after(le) : undefined, gr = lg >= 0 ? after(lg) : undefined;
      if (tot && gr && tot !== gr && (gr.start > tot.start || lg > tot.start - start) && Number(nfkc(gr.s).replace(/,/g, '')) <= Number(nfkc(tot.s).replace(/,/g, ''))) {
        const off = start + le, v = tot.s.trim(), vOff = raw.indexOf(v, tot.start);
        p.amounts.push(amount(input, 'actual', fy, raw.slice(vOff, vOff + v.length), '円', raw.slice(off, vOff + v.length), off));
      }
    }
    p.warnings.push(`藤枝市行政サービス評価委員会の地方創生交付金事業評価シート。評価年度は表紙の委員会年度、評価対象年度はシート見出しの年度${h[3] ? '（「令和N年度実績」の明記）' : ''}。` +
      (h[3] ? '金額はシート見出しに実績年度が明記された様式の「事業費(円)」のみ実績として収録（交付金充当額は未収録）。' : '金額（事業費・うち交付金充当額）は予算・決算の区分が明記されないため未収録。') +
      '評価項目（有効性・効率性・総合効果）は設問の直後に選択肢番号付きで記載されたものだけを原文どおり収録し、選択肢一覧が本文にないため尺度は未設定。KPI表は計画単位のため未収録。事業名・担当課は抽出テキストの行位置から取得。');
    out.push(p);
  });
  return out;
}

const fujiedaAll = (input: CachedInput, inputs: CachedInput[]) => municipalityRecords(input, inputs, extractFujieda, p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`);

// ------------------------------------------------------------------ 瑞穂市（総合戦略に基づく事業実績評価 平成27年度分）
// 同市の他年度の「事業実績評価」は総合計画の施策（例: 1-1-(5) 災害に強い住環境の整備）単位で対象外。
// 平成27年度分だけが総合戦略事業（事業単位）のシートで構成される。
const MIZUHO_SELF = /目標達成に(?:非常に効果的で\n(?:自己評価\n)?あった|相当程度効果があった|効果があった|効果がなかった)|目標指標無し/g;

export function extractMizuho(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '21216') return [];
  const t = input.text;
  const title = /^瑞穂市まち・ひと・しごと創生総合戦略に基づく\n事業実績評価（平成２７年度分）\n/.exec(t);
  if (!title) return [];
  const lg0 = t.indexOf('＜自己評価の選択肢について＞'), lg1 = t.indexOf('瑞 穂 市', lg0);
  if (lg0 < 0 || lg1 < 0) return [];
  const scale = t.slice(lg0 + '＜自己評価の選択肢について＞'.length, lg1).trim().split('\n').map(s => s.trim()).filter(Boolean).join('／');
  const heads = [...t.matchAll(/^総合戦略事業(\d\d)\(([^\n]+)\)\n/gm)];
  const out: ProjectEvaluation[] = [];
  heads.forEach((h, k) => {
    const start = h.index!, next = heads[k + 1]?.index ?? t.length;
    const stop = t.indexOf('今後の方向性', start);
    if (stop < 0 || stop > next) return;
    const sheet = t.slice(start, stop), name = h[2];
    const p = project(input, nfkc(name), name, null, h[0].trimEnd(), start);
    p.projectCode = `総合戦略事業${h[1]}`; p.id = stableId(input, p.projectCode, null);
    p.evaluatedFiscalYear = 2015;
    p.evidence.push(evidence(input, title[0].trimEnd(), title.index));
    const goal = sheet.indexOf('基本目標');
    if (goal > 0) {
      const depts = lines(sheet.slice(0, goal), start).filter(l => /^\S{2,20}課$/.test(l.s.trim()));
      if (depts.length === 1) { const d = depts[0].s.trim(); p.department = d; p.evidence.push(evidence(input, d, t.indexOf(d, depts[0].start))); }
    }
    const self = [...sheet.matchAll(MIZUHO_SELF)];
    if (self.length === 1) {
      const m = self[0], off = start + m.index!;
      p.ratings.push({ kind: 'self', label: '自己評価', value: m[0].replace(/\n(?:自己評価\n)?/g, ''), scale, evidence: evidence(input, m[0], off) });
    }
    // 「27年度(実績)」欄の直後に事業名・事業費(千円)・金額・「28年度(計画)」が順に並ぶ（列が崩れていない）ときだけ実績額を採用。
    const a = /27年度\(実績\)\n[^\n]+\n\n事業費\(千円\)\n\n(\d{1,3}(?:,\d{3})*)\n\n28年度\(計画\)/.exec(sheet);
    if (a) {
      const off = start + a.index!, vOff = off + a[0].indexOf(`\n${a[1]}\n`) + 1;
      p.amounts.push(amount(input, 'actual', 2015, a[1], '千円', t.slice(off, vOff + a[1].length), off));
    }
    p.warnings.push('瑞穂市まち・ひと・しごと創生総合戦略に基づく事業実績評価（平成２７年度分）の事業シート。評価対象年度は表題の「平成２７年度分」、評価年度は本文に明記がないため未設定。' +
      '自己評価は選択肢（資料冒頭の凡例）のいずれか1つがシート内に1回だけ現れる場合のみ収録（「目標達成に非常に効果的で／あった」の改行・欄名の割り込みは除いて連結）。' +
      '審議会評価は選択肢が両方印字され選択結果が抽出テキストから判別できないため未収録。金額は「27年度(実績)」欄の事業費(千円)が列崩れなく読める場合のみ実績として収録。KPI表は列対応が崩れているため未収録。');
    out.push(p);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '21216': { extract: (input, inputs) => municipalityRecords(input, inputs, extractMizuho, p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`),
    scope: '総合計画等評価審議会資料のうち「まち・ひと・しごと創生総合戦略に基づく事業実績評価（平成27年度分）」の総合戦略事業シート11件の事業名・所管課・自己評価・27年度実績事業費（列崩れのないもののみ）。総合計画の施策単位の事業実績評価（平成28〜令和6年度分）、審議会の評価結果・評価まとめシート、評価方法資料は対象外。' },
  '22214': { extract: fujiedaAll, scope: '行政サービス評価委員会資料のうち地方創生交付金（推進・拠点整備・テレワーク・デジタル田園都市国家構想・第２世代交付金）の事業評価シート（平成30〜令和7年度対象）の事業名・担当課・自己評価（有効性・効率性・総合効果、旧様式は今後の方針）。金額は実績年度が明記された令和8年度委員会資料の事業費のみ。単年度戦略シート・総合計画成果指標管理シート・総合戦略KPI管理シート・事業総括表は対象外。' },
};
