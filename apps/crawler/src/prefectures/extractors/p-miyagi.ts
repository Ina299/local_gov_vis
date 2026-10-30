/**
 * 宮城県「令和８年度政策評価・施策評価基本票」の施策評価シート「主要な事業の成果」（事業名／事業内容／実績／決算額（千円））。
 * 表の見出し「決算額（千円）」の直後、または直前の段落が決算額（数字だけの段落）である位置から、段落が
 * 「事業名（1行）→事業内容→実績→決算額」の順に4つ揃う所だけを1事業として読む。順序が崩れた所（ページ送りで事業名だけが後ろに回る、
 * 事業名と事業内容が1行に混ざる等）は読まない。
 * 決算額の年度は、同じ年度の「政策評価・施策評価基本票の要旨」の「令和７年度の政策、施策及び事業の成果等を対象に、令和８年度に実施した」
 * という記載による（基本票の表には年度が印字されない）。担当課は表に印字されないため、同じ基本票の参考資料２（交付金事業の表）で事業名が一致する場合だけ担当課室を引く。
 * 他施策の事業の再掲（「再」印）と「参考」欄は収録しない。令和６・７年度の基本票の「推進事業一覧シート」は
 * 決算見込額であり、事業名・担当部・担当課室が段組みで分断されるため対象外。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { acrossDocuments, amount, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const TITLE = '令和８年度政策評価・施策評価基本票';
const SCOPE_NOTE = 'この書面は、条例第５条第２項に基づき、県が令和７年度の政策、施策及び事業の成果等を対象に、令和８年度に実施した政策評価・施策評価に係る基本票';
const HEAD = '決算額（千円）\n\n';
const AMOUNT = /^\d{1,3}(?:,\d{3})*$/;
const STOP = /^(?:目標指標の達成度等|参考|再|主要な事業の成果|事業名|事業内容|実績|決算額（千円）)$/;

type Para = { text: string; start: number };

function paragraphs(t: string, from: number, to: number): Para[] {
  const out: Para[] = [];
  const re = /[^\n](?:[^\n]|\n(?!\n))*/g;
  re.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) && m.index < to) out.push({ text: m[0], start: m.index });
  return out;
}

/** 事業名は1行で、事業・経費・奨励金・交付金・プロジェクト等で終わる（括弧書きの添え字は可）。 */
const nameLike = (s: string) => !s.includes('\n') && s.length <= 40 && !/\s/.test(s) && !STOP.test(s)
  && /(?:事業|費|金|プロジェクト)(?:[（(][^（）()]*[）)])*$/.test(s);
/** 事業内容・実績の段落に別の事業名らしい行が混ざっていれば、行が段組みで重なっている。 */
const mixed = (s: string) => s.split('\n').some(l => /^[^、。]{2,30}(?:事業|プロジェクト)$/.test(l));

/**
 * 同じ基本票の「参考資料２ 令和7年度…第2世代交付金…の実施状況」の表は「事業を構成するR7年度推進事業名」と「担当課室」を1行に並べる。
 * 名前が一致し、担当課室が1つに定まる推進事業だけ担当課室を引く。
 */
function appendixDepartments(t: string): Map<string, { dept: string; raw: string; start: number } | null> {
  const out = new Map<string, { dept: string; raw: string; start: number } | null>();
  const from = t.lastIndexOf('\n参考資料２\n■令和7年度新しい地方経済・生活環境創生交付金');
  if (from < 0) return out;
  for (const m of t.slice(from).matchAll(/\n(\d+) ([^\n]+)\n\n([^\n]+?(?:課|室))\n\n(\d+)\n\n(\d+)\n/g)) {
    const key = nfkc(m[2]), old = out.get(key);
    const v = { dept: m[3], raw: m[0].slice(1, -1), start: from + m.index! + 1 };
    out.set(key, old === undefined ? v : old && old.dept === v.dept ? old : null);
  }
  return out;
}

function one(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  const t = input.text;
  if (!t.startsWith(TITLE + '\n')) return [];
  const youshi = inputs.find(i => i.text.includes(SCOPE_NOTE) && i.text.includes('令和８年度政策評価・施策評価基本票の要旨'));
  if (!youshi) return [];
  const out: ProjectEvaluation[] = [];
  const depts = appendixDepartments(t);
  const heads = [...t.matchAll(/決算額（千円）\n\n/g)].map(m => m.index! + HEAD.length);
  heads.forEach((from, hi) => {
    const next = heads[hi + 1] ?? t.length;
    const stops = [t.indexOf('\n参考\n', from), t.indexOf('\n目標指標の達成度等\n', from)].filter(x => x >= 0);
    const to = Math.min(next, ...stops);
    const ps = paragraphs(t, from, to);
    // 行は「事業名→事業内容→実績→決算額」の4段落。見出し直後か、直前の段落が決算額（行の終わり）の位置からだけ読み始める。
    for (let i = 0; i + 3 < ps.length; i++) {
      if (i > 0 && !AMOUNT.test(ps[i - 1].text)) continue;
      const [name, content, result, amt] = ps.slice(i, i + 4);
      if (!nameLike(name.text) || AMOUNT.test(content.text) || AMOUNT.test(result.text) || STOP.test(content.text) || STOP.test(result.text) || !AMOUNT.test(amt.text)) continue;
      // ページ番号（後ろに空行が2つ続く数字だけの段落）を決算額と取り違えない
      if (t.startsWith('\n\n\n', amt.start + amt.text.length) || amt.start + amt.text.length >= t.length - 1) continue;
      if (mixed(content.text) || mixed(result.text)) continue;
      i += 3;
      // 内容・実績の段落に「再」印が混ざる行は他施策の再掲
      if ([content, result].some(p => p.text.split('\n').some(l => /^再(?: |$)/.test(l)))) continue;
      const raw = t.slice(name.start, amt.start + amt.text.length);
      const p = project(input, `${name.start}-${nfkc(name.text)}`, name.text, 2026, raw, name.start);
      p.evaluatedFiscalYear = 2025;
      p.activities = content.text.replace(/\n/g, '');
      p.evidence.push(evidence(input, TITLE, 0), evidence(youshi, SCOPE_NOTE));
      p.amounts.push(amount(input, 'actual', 2025, amt.text, '千円', amt.text, amt.start));
      p.warnings.push('施策評価シート「主要な事業の成果」の決算額（千円）。表に年度の印字はなく、同じ年度の基本票の要旨の「令和７年度の政策、施策及び事業の成果等を対象に、令和８年度に実施した」による。担当課は主要な事業の表には印字されない。');
      const d = depts.get(nfkc(name.text));
      if (d) {
        p.department = d.dept;
        p.evidence.push(evidence(input, d.raw, d.start));
        p.warnings.push('担当課室は同じ基本票の参考資料２（第２世代交付金の実施状況）の「事業を構成するR7年度推進事業名」「担当課室」の行から、事業名が一致するものを引いた。');
      }
      out.push(p);
    }
  });
  return out;
}

export const entries: Record<string, Entry> = {
  '04000': {
    scope: '令和８年度政策評価・施策評価基本票の施策評価シート「主要な事業の成果」の事業名・事業内容・決算額（令和７年度）、参考資料２で名前が一致する事業の担当課室。段組みで順序が崩れた行、再掲（再）・参考欄、令和６・７年度基本票の推進事業一覧（決算見込額）、反映状況説明書は対象外。',
    extract: (input, inputs) => acrossDocuments(input, inputs, i => one(i, inputs), p => `${nfkc(p.projectName)}|${p.evaluatedFiscalYear}`),
  },
};
