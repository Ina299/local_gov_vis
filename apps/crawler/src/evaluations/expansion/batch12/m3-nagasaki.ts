/** Batch-12 (m3) extractor for 42201 長崎市: 基本施策評価シート・個別施策評価シートの「施策を推進する主な事業」（事業ごとの成果指標）. */
import type { ProjectEvaluation } from '../../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from '../shared';
import { mergeReprints, nfkc, type Entry } from '../batch9/i1-util';

const SOURCES = new Set(['18675dfd6aca8390a9af7f0b', '2e04247c6455fe39c47fc0a0', '89b759f78cac67e6e6d5f45b', 'a97ce14b8d923ab892457de0']);
const MARK = '施策を推進する主な事業\n';
const TITLE = /令和([６７])年度 (?:基本施策評価シート|個別施策評価シート)/g;
const DEPT = /^[^\n\s]{2,15}(?:課|室)$/;
const VALUE = '([0-9０-９][0-9０-９,.，．]*(?:件|人|％|%))';

function nagasaki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '42201' || !SOURCES.has(input.sourceId)) return [];
  const t = input.text, titles = [...t.matchAll(TITLE)];
  const out: ProjectEvaluation[] = [];
  for (const m of t.matchAll(new RegExp(MARK, 'g'))) {
    const s = m.index! + MARK.length;
    const end = t.indexOf('決算（見込）額', s);
    if (end < 0) continue;
    const block = t.slice(s, end);
    const title = titles.filter(x => x.index! < m.index!).pop();
    if (!title) continue;
    // Header cells (事業名／担当課, optionally 成果指標…達成率 and a row number) precede the business name.
    const nm = /^事業名\n担当課\n\n?(?:成果指標\n目標値\n実績値\n達成率\n\n)?(?:1\n\n)?([^\n]+)\n\n/.exec(block);
    if (!nm || /成果指標|目標値|担当課/.test(nm[1])) continue;
    const name = nm[1].trim(), nameAt = s + nm[0].lastIndexOf(nm[1]);
    // Indicator: the spaced layout (成果指標／目標値／実績値／達成率 each followed by a value) or the compact one (values on consecutive lines).
    const spaced = new RegExp(`\\n\\n成果指標\\n\\n((?:[^\\n]+\\n)*?[^\\n]+)\\n\\n(?:[^\\n]+(?:課|室)\\n\\n)?目標値\\n\\n${VALUE}\\n\\n実績値\\n\\n${VALUE}\\n\\n(?:[^\\n]+(?:課|室)\\n\\n)?達成率\\n\\n${VALUE}\\n`).exec(block);
    const compact = new RegExp(`\\n\\n(?:[^\\n]+(?:課|室)\\n\\n)?((?:[^\\n]+\\n)*?[^\\n]+)\\n${VALUE}\\n${VALUE}\\n${VALUE}\\n`).exec(block);
    const ind = spaced ?? (/^事業名\n担当課\n\n?成果指標\n目標値\n実績値\n達成率\n/.test(block) ? compact : null);
    const segs = block.slice(0, block.indexOf('事業目的') < 0 ? block.length : block.indexOf('事業目的')).split('\n\n').map(x => x.trim());
    const depts = [...new Set(segs.filter(x => DEPT.test(x)))];
    const p = project(input, nfkc(name), name, 2018 + Number(nfkc(title[1])), name, nameAt);
    p.projectCode = null;
    p.evidence.push(evidence(input, title[0], title.index));
    if (depts.length === 1) {
      p.department = depts[0];
      p.evidence.push(evidence(input, depts[0], s + block.indexOf(`\n${depts[0]}\n`) + 1));
    }
    if (ind && !/課$|室$/.test(ind[1].split('\n').pop()!)) {
      const raw = ind[0].trim(), at = s + ind.index + ind[0].indexOf(raw);
      p.indicators.push({ name: ind[1].split('\n').join(''), fiscalYear: null, target: ind[2], actual: ind[3], unit: null, evidence: evidence(input, raw, at) });
      p.warnings.push(`成果指標の達成率は原文で「${ind[4]}」。目標値・実績値の年度は事業欄に明記がないため未設定（累計指標は施策の成果指標表の目標年度・実績年度を参照）。単位は値に含めて原文どおり収録。`);
    }
    p.warnings.push(`長崎市 令和${nfkc(title[1])}年度 施策評価シートの「施策を推進する主な事業」欄（施策評価シート内の事業単位の記載）。「決算（見込）額」は見込額を含む表記のため未収録。評価対象年度は本文に明記がないため未設定。`);
    out.push(p);
  }
  return mergeReprints(out, p => `${p.projectName}|${p.evaluationYear}`);
}

export const nagasakiEntries: Record<string, Entry> = {
  '42201': {
    extract: input => nagasaki(input),
    scope: '長崎市 令和6・7年度 基本施策評価シート・個別施策評価シート（C1・C2）の「施策を推進する主な事業」欄の事業名・担当課・成果指標（目標値・実績値、年度は未設定）。施策の評価・成果指標表、決算（見込）額（見込額を含むため）は対象外。',
  },
};
