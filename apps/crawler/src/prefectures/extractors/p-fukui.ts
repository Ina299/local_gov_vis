/**
 * 福井県 事業評価結果(課・室)総括表（事業年度 令和8年度、課・室ごとのPDF）の事業名・部局名/所属名・予算額。
 *
 * 表の列は 事業名／福井県長期ビジョンにおける位置づけ／経費区分／事業開始年度／事業終了年度／予算額／決算額／
 * 財源内訳（国庫・その他特定財源・一般）／評価区分（単位：千円）。抽出テキストでは1行の値が空行区切りで出力されるが、
 * 行の途中で他の行の値が割り込む箇所がある。次の並びがそろう行だけを収録する:
 *  - 事業名の段落 →（位置づけの段落）→「政策的経費 開始年度 終了年度」の段落（開始・終了年度は同じ段落か直後の段落）;
 *    事業名は「…事業」「…費」「…金」で終わるもの（位置づけ番号の後ろは除く）;
 *  - 金額: 年度の直後に 予算額 →（決算額の空欄「―」）→ 財源内訳の値 → 評価区分 が続き、予算額＝財源内訳の和 の検算が合う場合のみ。
 * 予算額の年度は「令和７年度事務事業カルテについて」の記載（令和８年度に実施する事業は令和８年度当初予算額、
 * 令和７年度で終了した事業は令和７年度予算額（現計））に従い、事業終了年度で決める。決算額欄は空欄のため actual はない。
 */
import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../../evaluations/expansion/shared';
import { amount, nfkc, type Entry } from '../../evaluations/expansion/batch9/i1-util';

const CODE = '18000';
const TITLE = '事業評価結果(課・室)総括表';
const KEIHI = /(政策的経費|標準外経費|その他経費)/;
const ERA: Record<string, number> = { 令和: 2018, 平成: 1988, 昭和: 1925 };
const STATUS = new Set(['継続', '拡充', '縮減', '新規', '廃止', '完了', '整理統合', '終了']);
const DASH = /^[―－\-ー]$/;
const NUM = /^\d{1,3}(?:,\d{3})*$/;
const NAME_END = /(?:事業|事業費|費|金|基金)$/;

const fyOf = (s: string) => {
  const m = /^(令和|平成|昭和)([0-9０-９元]+)年度$/.exec(s.replace(/\s/g, ''));
  return m ? ERA[m[1]] + (m[2] === '元' ? 1 : Number(nfkc(m[2]))) : null;
};

type Para = { s: string; at: number };

function paragraphs(t: string): Para[] {
  const out: Para[] = [];
  const re = /[^\n]+(?:\n[^\n]+)*/g;
  for (const m of t.matchAll(re)) out.push({ s: m[0], at: m.index! });
  return out;
}

/** 事業名の候補: 位置づけ番号（例「 ２ 」「 14 」「 2.」）より前の部分。 */
function nameOf(line: string): string | null {
  if (line.includes('\n')) return null;
  const cut = line.split(/\s+(?:[0-9０-９]{1,2}[ .．]?\s*\S|[0-9０-９]{1,2}$)|\s+(?:政策的経費|標準外経費|その他経費)/)[0].trim();
  if (!cut || /^[0-9０-９]/.test(cut) || !NAME_END.test(cut) || /経費|年度|予算額|決算額|財源|位置づけ/.test(cut)) return null;
  return cut;
}

function extractOne(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== CODE || !input.text.startsWith(TITLE)) return [];
  const t = input.text;
  // 部局名・所属名（各ページの見出し。全ページで一致する場合のみ）
  const heads = [...t.matchAll(/事業年度\n\n令和 ?([0-9０-９]+)年度\n\n部局名\n\n([^\n]+)\n\n所属名\n\n([^\n]+)\n/g)];
  if (!heads.length) return [];
  const keys = new Set(heads.map(h => `${nfkc(h[1])}|${h[2].trim()}|${h[3].trim()}`));
  if (keys.size !== 1 || nfkc(heads[0][1]) !== '8') return [];
  const dept = `${heads[0][2].trim()} ${heads[0][3].trim()}`;
  const deptEv = evidence(input, heads[0][0], heads[0].index);
  const paras = paragraphs(t);
  const used = new Set<number>();
  const out: ProjectEvaluation[] = [];
  const seen = new Map<string, number>();
  paras.forEach((p, i) => {
    if (!KEIHI.test(p.s) || p.s.includes('\n')) return;
    // 開始・終了年度
    let yrs = /(?:政策的経費|標準外経費|その他経費)\s+((?:令和|平成|昭和)\S+年度)\s+((?:令和|平成|昭和)\S+年度)$/.exec(p.s);
    let last = i;
    if (!yrs && /(?:政策的経費|標準外経費|その他経費)$/.test(p.s)) {
      const nx = /^((?:令和|平成|昭和)\S+年度)\s+((?:令和|平成|昭和)\S+年度)$/.exec(paras[i + 1]?.s ?? '');
      if (nx) { yrs = nx; last = i + 1; }
    }
    if (!yrs) return;
    const endFy = fyOf(yrs[2]);
    if (!endFy) return;
    // 事業名: 同じ段落の先頭、または直前（位置づけの段落を1つまで挟む）の段落
    let name: string | null = null, nameAt = -1, nameIdx = -1;
    const own = nameOf(p.s);
    if (own) { name = own; nameAt = p.at; nameIdx = i; }
    else {
      for (const k of [i - 1, i - 2]) {
        const q = paras[k];
        if (!q) break;
        const nm = nameOf(q.s);
        if (nm) { name = nm; nameAt = q.at; nameIdx = k; break; }
        // 位置づけの段落（番号始まり、または事業名の語尾でない1行）だけを読み飛ばす
        if (k === i - 1 && !q.s.includes('\n') && !NUM.test(q.s) && !DASH.test(q.s) && !STATUS.has(q.s)) continue;
        break;
      }
    }
    if (!name || used.has(nameIdx)) return;
    used.add(nameIdx);
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    const r = project(input, `${name}#${n}`, name, null, name, nameAt);
    r.evidence.push(evidence(input, p.s, p.at));
    if (last !== i) r.evidence.push(evidence(input, paras[last].s, paras[last].at));
    r.department = dept;
    r.evidence.push(deptEv);
    // 金額: 予算額 →（決算額の空欄）→ 財源内訳 → 評価区分
    const vals: Para[] = [];
    let j = last + 1;
    while (paras[j] && (NUM.test(paras[j].s) || DASH.test(paras[j].s))) vals.push(paras[j++]);
    let status: Para | null = null;
    if (paras[j] && STATUS.has(paras[j].s)) status = paras[j];
    else if (vals.length && DASH.test(vals[vals.length - 1].s)) status = vals.pop()!;
    const fy = endFy >= 2026 ? 2026 : endFy === 2025 ? 2025 : null;
    if (status && vals.length >= 2 && NUM.test(vals[0].s) && fy) {
      const rest = vals.slice(1);
      const blanks = rest.filter(v => DASH.test(v.s));
      const nums = rest.filter(v => NUM.test(v.s));
      const blankOk = blanks.length === 0 || (blanks.length === 1 && DASH.test(rest[0].s));
      const total = Number(vals[0].s.replace(/,/g, ''));
      if (blankOk && nums.length >= 1 && nums.length <= 3 && nums.reduce((a, v) => a + Number(v.s.replace(/,/g, '')), 0) === total && total > 0) {
        const raw = t.slice(vals[0].at, status.at + status.s.length);
        r.amounts.push(amount(input, 'budget', fy, vals[0].s, '千円', raw, vals[0].at));
        r.warnings.push(fy === 2026
          ? '金額は総括表の予算額（千円）＝令和８年度当初予算額。財源内訳（国庫・その他特定財源・一般）の和との一致を確認。'
          : '金額は総括表の予算額（千円）。事業終了年度が令和７年度のため、資料の記載要領により令和７年度予算額（現計）として収録。財源内訳の和との一致を確認。');
      } else r.warnings.push('予算額と財源内訳の和が一致しない、または値の並びが崩れているため金額は未収録。');
    } else r.warnings.push('この行の予算額・財源内訳の値が事業名の行に続いて出力されていない（他の行の値が割り込む）ため金額は未収録。');
    // 評価区分は、予算額の検算が合った行か、年度の直後に区分が続く（値のない）行のみ。「―」は決算額の空欄と同じ記号のため検算が合った行のみ。
    if (status && (r.amounts.length || (!vals.length && !DASH.test(status.s)))) {
      r.ratings.push({ kind: 'self', label: '評価区分', value: DASH.test(status.s) ? '―' : status.s, scale: '継続／拡充／縮減／整理統合／廃止／完了／―', evidence: evidence(input, status.s, status.at) });
    }
    r.warnings.push('評価年度は資料に記載がないため未設定（事業年度は令和8年度）。');
    out.push(r);
  });
  return out;
}

export const entries: Record<string, Entry> = {
  [CODE]: {
    scope: '事業評価結果(課・室)総括表（事業年度 令和8年度、課・室ごとのPDF）の事業名・部局名/所属名・予算額（令和８年度当初予算額、財源内訳の和と一致する行のみ）・評価区分。決算額は空欄。行の値が他の行と入り混じって出力される行は名称のみ、または対象外。',
    extract: (input) => extractOne(input),
  },
};
