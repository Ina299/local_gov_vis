import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

const SHEET = '行政評価シート\n事務事業名\n担当部\n１．事業概要\n基本目標\n（方策の柱）\n政策\n（方策）\n施策\n（手法）\n';
const PROGRESS = new Set(['目標達成', '相当程度進展あり', '進展が大きくない', '評価結果なし']);
const COST = new Set(['費用に対して十分な効果があった', '費用に対して効果はあったが課題もあった', '費用に対して十分な効果が得られなかった', '費用なし']);
const DIRECTION = new Set(['現状のまま継続', '原状のまま継続', '見直して継続', '拡大', '縮小', '完了', '休止', '廃止・中止']);
const GRADE = new Set(['Ａ', 'Ｂ', 'Ｃ', 'Ｄ']);

/** Lines of a sheet with their absolute offsets in the extracted text. */
function lines(text: string, from: number, to: number) {
  const out: { line: string; start: number }[] = [];
  let pos = from;
  for (const line of text.slice(from, to).split('\n')) { out.push({ line, start: pos }); pos += line.length + 1; }
  return out;
}

/** 二本松市 行政評価シート (新二本松市総合計画の事務事業, one sheet per project). */
function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '07210' || input.format !== 'pdf' || !input.text.startsWith(SHEET)) return [];
  const text = input.text, starts: number[] = [];
  for (let i = text.indexOf(SHEET); i >= 0; i = text.indexOf(SHEET, i + 1)) starts.push(i);
  const out = new Map<string, ProjectEvaluation>(), conflicts = new Set<string>();
  starts.forEach((start, n) => {
    const end = n + 1 < starts.length ? starts[n + 1] : text.length;
    const sheet = text.slice(start, end).replace(/\n+$/, '');
    const all = lines(text, start, start + sheet.length);
    // Project name lines run from the header to the 担当部 line (…部 / …支所).
    let i = all.findIndex(l => l.line === '（手法）') + 1;
    while (all[i] && (all[i].line === '' || all[i].line === '取組事項')) i++;
    const nameLines: string[] = []; let department: string | null = null;
    for (; i < all.length && nameLines.length < 3; i++) {
      const l = all[i].line;
      if (l === '') continue;
      if (/^[^\s]+(部|支所)$/.test(l)) { department = l; break; }
      if (l === '担当係' || l === '担当課') break;
      nameLines.push(l.replace(/ 事業開始年度$/, ''));
    }
    if (!nameLines.length || nameLines.length > 2) return;
    if (!department) department = sheet.match(/\n担当係\n([^\s]+部)\n担当課\n/)?.[1] ?? null;
    const section = sheet.match(/\n担当課\n+([^\n]+課)\n/)?.[1];
    const name = nameLines.join('');
    const p = project(input, `${department ?? ''}:${name}`, name, null, sheet, start);
    p.department = department && section ? `${department} ${section}` : department;
    const doStart = sheet.indexOf('３．実施内容【ＤＯ（実行）】'), checkStart = sheet.indexOf('４．事業の分析【ＣＨＥＣＫ（評価）】');
    if (doStart >= 0 && checkStart > doStart) {
      const act = sheet.slice(doStart + '３．実施内容【ＤＯ（実行）】'.length, checkStart).split('\n').filter(l => l.trim() && l !== '取組内容').join('\n').trim();
      if (act) p.activities = act;
    }
    const actStart = sheet.indexOf('５．今後の方向性【ＡＣＴＩＯＮ（改善）】');
    const pick = (set: Set<string>, from: number) => {
      const hits = all.filter(l => l.start >= from && set.has(l.line));
      return hits.length === 1 ? hits[0] : null;
    };
    const prog = pick(PROGRESS, start), cost = pick(COST, start), grade = pick(GRADE, start);
    const dir = actStart >= 0 ? pick(DIRECTION, start + actStart) : null;
    for (const [label, hit] of [['目標に対する進捗状況', prog], ['費用対効果', cost], ['所管課評価', grade], ['事業の方向性', dir]] as const)
      if (hit) p.ratings.push({ kind: 'self', label, value: hit.line, scale: null, evidence: evidence(input, hit.line, hit.start) });
    p.warnings.push('行政評価シート（新二本松市総合計画の抽出事務事業）。評価実施年度・評価対象年度はシート上に明記がないため未設定（同時掲載の「行政評価結果について（令和３年３月）」は平成28〜令和元年度実績に基づき令和２年９〜10月に評価と記載）。指標表は年度列・目標/実績行の段組みが崩れて対応を確定できないため指標値は未収録。事業費の記載はない。評価語は様式の選択肢と完全一致する行が1つだけの場合に限り原文ラベルのまま収録。所管課評価の記号（Ａ〜Ｄ）は凡例がシート外のため scale 未設定（「－」は表中の空欄記号と区別できないため未収録）。');
    const key = p.projectCode!, old = out.get(key);
    if (old) {
      if (JSON.stringify(old.ratings.map(r => r.value)) !== JSON.stringify(p.ratings.map(r => r.value))) conflicts.add(key);
      else old.evidence.push(...p.evidence);
    } else out.set(key, p);
  });
  return [...out].filter(([k]) => !conflicts.has(k)).map(([, p]) => p);
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '07210': { extract, scope: '二本松市の行政評価シート（総合計画の抽出事務事業136件、1シート1事業）から事業名・担当部課・取組内容・進捗状況・費用対効果・所管課評価記号・事業の方向性を構造化。指標表（段組み崩れ）と年度、総括文書「行政評価結果について」は構造化しない。' },
};
