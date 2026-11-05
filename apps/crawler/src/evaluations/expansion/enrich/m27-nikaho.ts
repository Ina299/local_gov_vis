import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- にかほ市（令和7年度 外部行政評価報告書（評価対象：令和6年度事務事業））
// 公開済みレコードは各委員会の評価票の「№ 事業担当課名 事 業 名 事業種別」の行（evaluationYear 2025・evaluatedFiscalYear 2024）。
// 評価票の「目的・成果」欄は、縦書きの「事務事業の概要」の文字・活動内容の欄と同じ列に出力され、多くの票で本文が見出しの前の行から
// 始まるため欄の境が決まらない。見出し「目的・成果」と本文が1行にあり（句点で終わる）、次の行が「評」（評価の欄）で、前の行が
// 活動内容の欄の終わり（句点で終わる行か、縦書きの「要」で始まる行）の票だけ、その1行の本文を目的とする。
const TITLE = /^令和７年度\n外部行政評価報告書\n（評価対象：令和６年度事務事業）$/m;
const HEAD = /^№ 事業担当課名 事 業 名 事業種別\n[0-9０-９] (\S+) (\S+(?: \S+)*) (直営|民間委託|補助|委託)$/gm;
const PURPOSE = /\n([^\n]*)\n目的・成果 ([^\n]+。)\n評\n/;

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '05214' || !/\/material\/files\/group\/5\/R7\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, title = TITLE.exec(t), out: ProjectEvaluation[] = [];
  if (!title) return [];
  const heads = [...t.matchAll(HEAD)];
  heads.forEach((h, i) => {
    if (input.truncated && i === heads.length - 1) return;
    const start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length), m = PURPOSE.exec(seg);
    if (!m || !(/。$/.test(m[1]) || /^要( |$)/.test(m[1]))) return;
    const p = project(input, `R7:${h[2]}:narrative`, h[2], 2025, h[0], start);
    p.evaluatedFiscalYear = 2024;
    p.department = h[1];
    p.purpose = m[2];
    p.evidence.push(evidence(input, title[0], title.index!), evidence(input, `目的・成果 ${m[2]}`, start + m.index! + m[1].length + 2));
    p.warnings.push('にかほ市 外部行政評価報告書の評価票の「目的・成果」欄（見出しと本文が1行で、前後の欄との境が決まる票のみ）を目的として収録。');
    out.push(p);
  });
  return out;
}

export const entry = {
  extract,
  scope: 'にかほ市 令和7年度 外部行政評価報告書の評価票: 目的・成果（見出しと本文が1行の票のみ、目的）。',
};
