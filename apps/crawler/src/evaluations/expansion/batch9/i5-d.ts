import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints } from '../batch7/g1-util';

type Entry = { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string };

const NASU_DOCS: Record<string, { year: number; heading: RegExp }> = {
  cfd329edd863512d2283af11: { year: 2021, heading: /■R3事務事業棚卸結果一覧（(廃止・縮小|改善|継続)）/g },
  '3deca2d22c7a5eb2e21db0ba': { year: 2022, heading: /■令和4年度事務事業棚卸結果一覧（(廃止・縮小|改善|継続)）/g },
};

/** 那須塩原市 事務事業棚卸結果一覧（令和3・4年度）の行。総合評価結果は各ページ見出しの区分（廃止・縮小／改善／継続）。 */
function extractNasushiobara(input: CachedInput): ProjectEvaluation[] {
  const doc = NASU_DOCS[input.sourceId];
  if (!doc) return [];
  const t = input.text, heads = [...t.matchAll(doc.heading)].map(m => ({ start: m.index!, raw: m[0], section: m[1] }));
  if (!heads.length) return [];
  const out: ProjectEvaluation[] = [], last = new Map<string, number>();
  // 番号・事業名（列幅で折り返し）が単独の段落として並ぶ行のみ。事業名列と概要列が同じ行に混ざった行は対象外。
  for (const m of t.matchAll(/\n\n(\d{1,3})\n\n((?:[^\n]{1,12}\n){0,2}[^\n]{1,12})(?=\n\n)/g)) {
    const head = heads.filter(h => h.start < m.index!).pop();
    if (!head) continue;
    const name = m[2].replaceAll('\n', ''), num = Number(m[1]);
    if (!/(?:事業|金|費|業務)(?:（[^）]*）|〔[^〕]*〕)?$/.test(name)) continue;
    const after = t.slice(m.index! + m[0].length + 2, m.index! + m[0].length + 402);
    const confirm = `引き続き${name}を実施`, bullet = /^[・○〇]/.test(after), confirmed = after.includes(confirm);
    if (!bullet && !confirmed) continue;
    // 同じ区分の中で番号が戻る行は表外の数字の可能性があるため除外。
    if ((last.get(head.section) ?? 0) >= num) continue;
    last.set(head.section, num);
    const raw = m[0].slice(2), start = m.index! + 2;
    const p = project(input, `${doc.year}-${head.section}-${num}`, name, doc.year, raw, start);
    p.projectCode = null;
    p.ratings.push({ kind: 'self', label: '事務事業棚卸 総合評価結果', value: head.section, scale: '廃止・縮小／改善／継続', evidence: evidence(input, head.raw, head.start) });
    if (confirmed) {
      const c = t.indexOf(confirm, m.index! + m[0].length);
      p.evidence.push(evidence(input, confirm, c));
    }
    p.warnings.push(`令和${doc.year - 2018}年度事務事業棚卸結果一覧の1行から事業名と総合評価結果（行が載るページの見出しの区分）を収録。担当課・係名と棚卸結果の文章は抽出テキストで列が入れ替わる箇所があり行との対応を確定できないため未収録。番号は区分ごとの通し番号のため事業コードとしては扱っていない。評価年度は一覧の表題の年度、評価対象年度は資料に明記がなく未設定。事業名列と概要列が同じ行に混在した行は対象外。`);
    out.push(p);
  }
  return mergeReprints(out, p => `${p.evaluationYear}:${p.projectName}`);
}

const OMURA_DIRECTIONS = ['現状維持', '拡充', '縮小', '終了', '廃止', '終期設定', 'その他の見直し', '他事業に統合'];

/** 大村市 令和７年度 部局別事務事業評価結果一覧（継続事業及び補正新規事業）の行（主管・No.・事務事業名・方向性）。 */
function extractOmura(input: CachedInput, inputs: CachedInput[]): ProjectEvaluation[] {
  if (input.sourceId !== '470e3b67d52cad2c23915a47') return [];
  const title = '令和７年度\n\n部局別事務事業評価結果一覧（継続事業及び補正新規事業）';
  if (!input.text.startsWith(title)) return [];
  // 同じ年度の「行政評価結果の概要」の方向性別事業名リストで、一覧の行の方向性を照合する（根拠には使わない）。
  const summary = inputs.find(i => i.sourceId === '17ddb8cc000e56ec78aa66eb')?.text;
  if (!summary?.startsWith('令和７年度\n\n行政評価結果の概要')) return [];
  const listed = new Map<string, Set<string>>();
  for (const s of summary.matchAll(/○「([^」]+)」とした事業\n((?:・[^\n]*\n?)+)/g))
    listed.set(s[1] === '終期の設定' ? '終期設定' : s[1], new Set(s[2].split('\n').filter(l => l.startsWith('・')).map(l => l.slice(1))));
  const anyListed = (name: string) => [...listed.values()].some(s => s.has(name));
  const t = input.text, out: ProjectEvaluation[] = [], dirs = OMURA_DIRECTIONS.join('|');
  const row = new RegExp(`(?<=\\n\\n)([^\\n]{2,30})\\n\\n(\\d{1,3}) ([^\\n]+)\\n\\n(${dirs})(?=\\n\\n)`, 'g');
  for (const m of t.matchAll(row)) {
    const [, dept, no, name, dir] = m;
    if (OMURA_DIRECTIONS.includes(dept) || /^\d/.test(dept)) continue;
    if (dir === '現状維持' ? anyListed(name) : !listed.get(dir)?.has(name)) continue;
    const p = project(input, `No.${no}`, name, 2025, m[0], m.index!);
    p.department = dept;
    p.ratings.push({ kind: 'self', label: '方向性', value: dir, scale: OMURA_DIRECTIONS.join('／'), evidence: evidence(input, m[0], m.index!) });
    p.evidence.push(evidence(input, title, 0));
    p.warnings.push('令和７年度 部局別事務事業評価結果一覧（継続事業及び補正新規事業）の1行から主管課・No.・事務事業名・方向性を収録。方向性は同年度「行政評価結果の概要」の方向性別事業名リストと一致する行のみ（現状維持はリストに載らないことを確認）。抽出テキストで方向性が行から離れて列挙される行は対象外。事業費・指標・妥当性等の評価は一覧にないため未収録。評価対象年度は資料に明記がなく未設定。');
    out.push(p);
  }
  return mergeReprints(out, p => p.projectCode!);
}

export const entries: Record<string, Entry> = {
  '09213': { extract: extractNasushiobara, scope: '令和3・4年度 事務事業棚卸結果一覧の行から、事業名と総合評価結果（廃止・縮小／改善／継続、ページ見出しの区分）のみを構造化。担当課・棚卸結果の文章（列が入れ替わるため）、事業名と概要が混在した行、結果概要（集計）は対象外。' },
  '42205': { extract: extractOmura, scope: '令和７年度 部局別事務事業評価結果一覧（継続事業及び補正新規事業）の行から、主管課・No.・事務事業名・方向性を構造化（同年度の評価結果概要の事業名リストと照合できた行のみ）。令和６年度一覧（列がまとめて並び行対応が確定しない）、単票の事務事業評価表・事業概要シート、金額・指標は対象外。' },
};
