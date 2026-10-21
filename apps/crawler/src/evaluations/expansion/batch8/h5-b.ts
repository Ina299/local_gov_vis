import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints } from '../batch7/g1-util';

/** 四国中央市 教育委員会の点検・評価報告書（平成21〜30年度の旧様式）。令和元年度以降は施策概要（主要項目）単位のため対象外。 */
const OLD_FORMAT = new Set([
  'e96dad8b559037c77ae26506', '8da6599bf277f87e426883e4', '3c3b246805f44ecff4420c7a', '25904cb3ca3069b7e084d351', '4bd0465533f122ff4f8b435c',
  'a49078ae96e544994a1414f6', '948ccf1d3df987775c762d24', '059125dcf0cef3299cb7b8c9', 'b232b3da366bdef3b8f62af8', '854c71ac502a27341516a0e5',
]);
const LABELS = '現状継続|改善継続|事業拡充|現状拡充|拡充継続|拡充|規模縮小|廃止|休止|事業完了';
const era = (e: string, n: number) => (e === '令和' ? 2018 : 1988) + n;

function extractShikokuchuo(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '38213' || !OLD_FORMAT.has(input.sourceId)) return [];
  const text = input.text, end = text.indexOf('対象）');
  if (end < 0 || end > 80) return [];
  const title = text.slice(0, end + 3);
  const y = title.normalize('NFKC').replace(/\s/g, '').match(/^(平成|令和)(\d+)年度\((平成|令和)(\d+)年度対象\)$/);
  if (!y) return [];
  const evaluationYear = era(y[1], Number(y[2])), evaluatedFiscalYear = era(y[3], Number(y[4]));
  const row = new RegExp(`(?<=\\n)(○(?:\\n\\n)?)?([^\\n○]{2,40}?(?:事業|業務|事務))\\n\\n?(${LABELS})(?=\\n)`, 'g');
  // The line before a business name must close the previous item; otherwise the name may be the tail of a wrapped line.
  const closesItem = (line: string) => line.startsWith('※') || new RegExp(`(?:。|）|\\)|\\d|回|人|円|チーム|容|価|改善策|【内部評価】|${LABELS})$`).test(line);
  const out: ProjectEvaluation[] = [];
  for (const head of text.matchAll(/【内部評価】/g)) {
    const s = head.index!;
    const stops = ['【学識経験者意見】', '\n重点施策', '【施策概要】', '【外部評価'].map(k => text.indexOf(k, s + 6)).filter(k => k >= 0);
    const seg = text.slice(s, stops.length ? Math.min(...stops) : text.length);
    for (const m of seg.matchAll(row)) {
      const prev = seg.slice(0, m.index).split('\n').filter(l => l.trim()).at(-1) ?? '';
      if (!m[1] && !closesItem(prev.trim())) continue;
      if (/^\s*[（(]/.test(m[2])) continue;
      const name = m[2].trim().replace(/^[0-9０-９]+[．.]\s*/, '');
      const start = s + m.index!;
      const p = project(input, name, name, evaluationYear, m[0], start);
      p.projectCode = null; p.evaluatedFiscalYear = evaluatedFiscalYear;
      p.ratings.push({ kind: 'self', label: '内部評価', value: m[3], scale: null, evidence: evidence(input, m[0], start) });
      p.evidence.push(evidence(input, title, 0));
      p.warnings.push('教育委員会の点検・評価報告書の【内部評価】欄で事業名の直後に記載された評価区分（現状継続・改善継続等）のみ収録。区分の定義は報告書に記載がないため原文ラベルのまま。重点施策単位の目標・実績表、事業費、学識経験者（外部評価委員）の施策単位の総合評価は事業との対応が確定しないため未収録。担当課は記載がなく未設定。');
      out.push(p);
    }
  }
  return mergeReprints(out, p => p.projectName);
}

export const entries: Record<string, { extract: (input: CachedInput, inputs: CachedInput[]) => ProjectEvaluation[]; scope: string }> = {
  '38213': { extract: extractShikokuchuo, scope: '平成21〜30年度（平成20〜29年度対象）の教育委員会点検・評価報告書10冊の【内部評価】欄から、事業名と直後の評価区分（現状継続・改善継続・拡充継続等）を事業単位で構造化。重点施策単位の目標・実績表と事業費、学識経験者の施策評価（A〜D）、令和元年度以降の施策概要（主要項目）単位の様式は対象外。' },
};
