import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';

// ---------------------------------------------------------------- 港区（平成29年度 港区事務事業評価シート）
// 公開済みレコードは同じ所管課別PDFの評価シートから作られ、事業費・一次評価はすでにある。指標は指標1〜3の列が
// 抽出テキスト上で混在するため未収録だった。ここでは数値が指標1だけにある表（指標名が「指標１」の直前の1行、
// 平成27・28年度の「当初予定・実績・達成率」で達成率＝実績÷当初予定が成り立つ）に限って指標を足す。
const HEAD = /Ｎｏ\n\n平成([２-３０-９]+)年度\n\n(\d+)\n\n港区事務事業評価シート\n/g;
const ascii = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const num = (s: string) => Number(s.replaceAll(',', ''));

function extract(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '13103' || !/\/documents\/78804\/h29[a-z]+\.pdf$/.test(input.sourceUrl)) return [];
  const t = input.text, heads = [...t.matchAll(HEAD)], out: ProjectEvaluation[] = [];
  for (let i = 0; i < heads.length; i++) {
    if (input.truncated && i === heads.length - 1) continue;
    const h = heads[i], start = h.index!, seg = t.slice(start, heads[i + 1]?.index ?? t.length);
    const name = /\n事 務 事 業 名 ([^\n]+)\n/.exec(seg);
    const year = 1988 + Number(ascii(h[1]));
    const a = seg.indexOf('\n事業の成果\n'), b = seg.indexOf('(指標の説明等)', a);
    if (!name || year !== 2017 || a < 0 || b < 0) continue;
    const sec = seg.slice(a, b);
    const ind = /^\n事業の成果\n([^\n]+)\n\n?指標１\n/.exec(sec);
    if (!ind || /^(指標|当初予定|実績|達成率|指|標)/.test(ind[1])) continue;
    // 表の数値は指標1の分だけ（平成27・28年度の当初予定・実績・達成率と平成29年度の当初予定）であること。
    const values = sec.split('\n').filter(l => /^[\d,.]+%?(?: 平成２[７８９]年度)?$/.test(l));
    const rows = [...sec.matchAll(/平成(２[７８])年度\n\n([\d,]+(?:\.\d+)?)\n\n([\d,]+(?:\.\d+)?)\n\n(\d+\.\d)%/g)];
    const plan = [...sec.matchAll(/平成２９年度\n\n([\d,]+(?:\.\d+)?)\n\n/g)];
    if (rows.length !== 2 || rows[0][1] !== '２７' || rows[1][1] !== '２８' || plan.length > 1 || values.length !== 6 + plan.length) continue;
    if (!rows.every(r => num(r[2]) > 0 && Math.abs(Math.round(num(r[3]) / num(r[2]) * 1000) / 10 - Number(r[4])) < 0.05)) continue;
    const projectName = name[1].trim();
    // The ID key differs from the published sheet record (same source, same number), which this record enriches.
    const p = project(input, `No${h[2]}:indicators`, projectName, year, seg.slice(0, name.index! + name[0].length - 1), start);
    p.projectCode = `No${h[2]}`;
    const nameEv = evidence(input, sec.slice(1, ind[0].length - 1), start + a + 1);
    for (const r of rows) {
      const ev = evidence(input, r[0], start + a + r.index!);
      p.indicators.push({ name: ind[1], fiscalYear: 1988 + Number(ascii(r[1])), target: r[2], actual: r[3], unit: null, evidence: ev });
    }
    if (plan.length) p.indicators.push({ name: ind[1], fiscalYear: 2017, target: plan[0][1], actual: null, unit: null, evidence: evidence(input, plan[0][0].trimEnd(), start + a + plan[0].index!) });
    p.evidence.push(nameEv);
    p.warnings.push('港区事務事業評価シート（平成29年度）の「事業の成果」のうち、数値が指標１だけにある表から指標名・当初予定・実績を収録。'
      + '平成27・28年度は達成率＝実績÷当初予定（小数第1位）が本文の達成率と一致する場合のみ。平成29年度は当初予定のみ。単位は表に記載がないため未設定。');
    out.push(p);
  }
  return out;
}

export const entry = {
  extract,
  scope: '港区 平成29年度 事務事業評価シート（所管課別PDF）: 数値が指標1だけにある指標表（平成27・28年度の当初予定・実績、平成29年度の当初予定）。事業費・評価は公開済み。',
};
