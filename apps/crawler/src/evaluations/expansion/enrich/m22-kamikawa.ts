import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { unwrap } from './m1-util';

// ---------------------------------------------------------------- 神川町（電源立地地域対策交付金 事業評価個表 平成30〜令和５年度、1事業ずつ）
// 公開済みレコードは同じ資料の事業評価個表から作られ、年度は個表の見出しの年度。目的の欄はない。
// 「交付金事業の概要」欄は、見出しの後に「交付金事業の名称」の見出しが続き、その後の空行で区切られた段落が欄の内容になる版
// （令和２〜５年度）だけを事業内容とする（見出しが段落の途中に入る版は前後の区切りが確定しないため除く）。
// 「交付金事業の定性的な成果及び評価等」欄は、見出しの次の行から空行までを成果とする（見出しの直後が別の欄の見出しなら空欄）。
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const HEAD = /\nⅡ．事業評価個表（(令和|平成)([０-９\d]+|元)年度）\n番号\n措置名\n公共用施設に係る整備、維\n1\n([^\n]+)\n持補修又は維持運営等措置\n/;

function block(t: string, at: number): string | null {
  const end = t.indexOf('\n\n', at);
  if (end < 0 || t[at] === '\n') return null;
  const raw = t.slice(at, end);
  return raw.trim() && !/^(評価に係る|活動指標|交付金事業)/.test(raw) ? raw : null;
}

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11383' || !input.sourceUrl.includes('/material/files/group/29/')) return [];
  const t = input.text, h = HEAD.exec(t);
  if (!h || t.split('事業評価個表（').length !== 2) return [];
  const n = h[2] === '元' ? 1 : Number(ascii(h[2])), fy = h[1] === '令和' ? 2018 + n : 1988 + n;
  const a = t.indexOf('\n交付金事業の概要\n\n交付金事業の名称\n\n'), o = t.indexOf('\n交付金事業の定性的な成果及び評価等\n');
  const activitiesAt = a >= 0 ? a + '\n交付金事業の概要\n\n交付金事業の名称\n\n'.length : -1, outcomesAt = o >= 0 ? o + '\n交付金事業の定性的な成果及び評価等\n'.length : -1;
  const activities = activitiesAt >= 0 ? block(t, activitiesAt) : null, outcomes = outcomesAt >= 0 ? block(t, outcomesAt) : null;
  if (!activities && !outcomes) return [];
  const p = project(input, `${h[3]}:narrative`, h[3], null, h[0].slice(1, -1), h.index! + 1);
  p.projectCode = null;
  p.evaluatedFiscalYear = fy;
  if (activities) { p.activities = unwrap(activities); p.evidence.push(evidence(input, activities, activitiesAt)); }
  if (outcomes) { p.outcomes = unwrap(outcomes); p.evidence.push(evidence(input, outcomes, outcomesAt)); }
  p.warnings.push('神川町 電源立地地域対策交付金 事業評価個表の「交付金事業の概要」（事業内容）と「交付金事業の定性的な成果及び評価等」（成果）。欄の幅での折り返しは改行を除いてつないだ。');
  return [p];
}

export const entry = {
  extract,
  scope: '神川町 電源立地地域対策交付金 事業評価個表（平成30〜令和５年度）: 交付金事業の概要（見出しと段落が分かれる版のみ）・定性的な成果及び評価等。目的の欄はない。',
};
