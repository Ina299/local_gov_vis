/**
 * 40216 小郡市: 事務事業評価シート（令和5年度事務事業、所管課別PDF）。公開済みレコード（同じシート）の空欄の
 * 目的（「事業の目的」欄）と事業内容（「事業概要」欄）を補う。
 * 抽出テキストでは目的の文が見出し「事業の目的」の直前の段落に、概要の文が見出しの直後に出る。目的は直前の段落が
 * 施策コード（P＋4桁）か「作成責任者 …長」の行で終わる場合だけ、概要は直後に「予算額・／執行額／（単位：千円）／事業概要」が
 * 続く場合だけ採る（見出しと文が交互に出るシートは欄の境目が決まらないため採らない）。
 */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { evidence, project, stableId, type CachedInput } from '../shared';
import { unwrap } from './m1-util';

/** 公開済みレコードの元になった所管課別のシートPDF（batch9 i0-sheets の小郡市と同じ）。 */
const SHEETS = new Set(['0489f5c35964e91695a655f0', '175ce0d5da31ed2d2e9c88a3', '2039dcd047bfc94507d329c1', '235084c3531dec23daf668f4',
  '2da57aba340e58e530c13b41', '40ba127cf5d24975298be7e5', '40c44eb92783714cfb86faa9', '42f46aeb9b7dabaa9251df79', '5593ea239e33e37c25c1faef',
  '578c88c8e780c1c8ec8d9a4f', '616a60f0ec5f23a73efc15b8', '67c711886a043c8504e50c2d', '6fa748d8613682d24f221ef6', '749d6512fea0532d0c877b7a',
  '79f7dc26450543cb97aef73a', '80fc7fe79a4e6bfde6013772', '94f894ff28f9168bfd06380f', '95e215f708bc8d811f1bc33f', '97737c06da2a6a581a3d273b',
  'af2bea38b80fe362e7f3ad61', 'ba0d368ee61f724d7a59aa5d', 'c5ffbc630c3448f2ec90d9ca', 'c6ac8fb7871654da6692853f', 'cad8300fa46e01f7111f930b',
  'cfbef20d6eef6360e7424fa7', 'd5e981bfd4d7ebe0b4745bdf', 'da3c3874c20c445d404dcdbe', 'e3ca2f4475da597e38556672', 'e95244cd10fbd7c39a7b40f6',
  'f5ab9dec20c1769f60d19186', 'fdb79449014565b28b7fc8b4']);
/** シートの見出し語（1行でも含めば欄の内容ではない）。 */
const LABEL = /事業の目的|事業概要|予算額|執行額|施策コード|終了予定年度|作成責任者|根拠法令|単位：|^R0\d年度$/;
/** 段落として閉じている（句点・括弧で終わる、1行だけ、または欄の幅に満たない行で終わる）。 */
function closed(lines: string[]): boolean {
  const width = Math.max(...lines.map(l => l.length)), last = lines[lines.length - 1].trim();
  return lines.length === 1 || /[。）)]$/.test(last) || last.length < width - 3;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '40216' || !SHEETS.has(input.sourceId)) return [];
  const t = input.text, out: ProjectEvaluation[] = [];
  const heads = [...t.matchAll(/事務事業評価シート（令和(\d+)年度事務事業）/g)];
  heads.forEach((h, i) => {
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    // 事業名・所管は公開済みレコードと同じ取り方（シート番号・事業番号・名称の組が1つに定まるものだけ）。
    const ids = [...seg.matchAll(/シートNo\. (\S+)\n事業No\. (\S+)\n\n事務事業名\n開始年度\n\n(.+)\n/g)];
    if (!ids.length || new Set(ids.map(m => JSON.stringify([m[1].normalize('NFKC').replace(/[ー－‐-]/g, '-'), m[2], m[3].trim()]))).size !== 1) return;
    const label = [...seg.matchAll(/\n\n事業の目的\n/g)];
    if (label.length !== 1) return;
    const at = label[0].index!;
    // 目的: 見出しの直前の段落（間に「R04年度」だけの段落が挟まる場合は飛ばす）。
    const before = seg.slice(0, at).replace(/\n\nR0\d年度$/, '');
    const cut = before.lastIndexOf('\n\n'), prev = before.slice(0, cut);
    const pl = before.slice(cut + 2).split('\n');
    const prevLast = prev.slice(prev.lastIndexOf('\n') + 1);
    const purpose = cut > 0 && /^(P[0-9A-Z]{4}|作成責任者 \S+長)$/.test(prevLast) && !pl.some(l => !l.trim() || LABEL.test(l)) && closed(pl)
      ? { lines: pl, at: start + cut + 2 } : null;
    // 事業内容: 見出しの直後の段落で、その後に予算欄の見出しと「事業概要」が続くもの。
    const am = /^((?:[^\n]+\n)+)\n予算額・\n執行額\n（単位：千円）\n\n事業概要\n/.exec(seg.slice(at + '\n\n事業の目的\n'.length));
    const al = am?.[1].replace(/\n$/, '').split('\n');
    const activities = al && !al.some(l => LABEL.test(l)) && closed(al) ? { lines: al, at: start + at + '\n\n事業の目的\n'.length } : null;
    if (!purpose && !activities) return;
    const [, , , name] = ids[0];
    const p = project(input, `narrative-${start}`, name.trim(), null, ids[0][0].trimEnd(), start + ids[0].index!);
    p.id = stableId(input, `narrative-${start}`, null);
    p.projectCode = null;
    p.evaluatedFiscalYear = 2018 + Number(h[1]);
    p.evidence.push(evidence(input, h[0], start));
    const depts = new Set([...seg.matchAll(/作成責任者 (\S+?(?:課|室|局|館|所|センター))長\n/g)].map(m => m[1]));
    if (depts.size === 1) p.department = [...depts][0];
    const put = (b: { lines: string[]; at: number }) => { const raw = b.lines.join('\n'); p.evidence.push(evidence(input, raw, b.at)); return unwrap(raw); };
    if (purpose) p.purpose = put(purpose);
    if (activities) p.activities = put(activities);
    p.warnings.push('小郡市 事務事業評価シートの文章欄から、目的（「事業の目的」の直前の段落）と事業内容（「事業概要」の文）を原文のまま収録。'
      + '見出しと文が交互に出る（欄の境目が決まらない）シートは採らず、欄の幅で折り返した改行だけを除いた。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: '小郡市 事務事業評価シート（令和5年度事務事業、所管課別PDF）の文章欄: 事業の目的・事業概要。見出しと文が交互に出るシートは対象外。',
};
