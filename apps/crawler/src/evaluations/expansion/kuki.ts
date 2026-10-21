import type { ProjectEvaluation } from '../../../../web/src/types/evaluation';
import { type CachedInput, evidence, project } from './shared';

/** R5 sheets assess R4. Complete individual sheets only, never trailing truncated text. */
export function extractKuki(input: CachedInput): ProjectEvaluation[] {
  if (input.municipalityCode !== '11232' || input.sourceId !== '9a1ae2fca89400f94992fd98' || input.format !== 'pdf') return [];
  const headers = [...input.text.matchAll(/^令和５年度 事務事業評価シート\n/gm)];
  const result: ProjectEvaluation[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    if (input.truncated && i === headers.length - 1) continue;
    const start = headers[i].index!;
    const raw = input.text.slice(start, headers[i + 1]?.index ?? input.text.length);
    const identity = raw.match(/^事務事業名 (.+?) 事務事業整理番号 (\d+)$/m);
    if (!identity || !raw.includes('１．事務事業概要 対象 令和４年度実施事業')
      || !/^評価年月日 .+ 評価者職氏名 .+\n\d+\s*$/m.test(raw)) continue;
    const code = identity[2];
    if (seen.has(code)) throw new Error(`Duplicate Kuki project code: ${code}`);
    seen.add(code);
    const item = project(input, code, identity[1], 2023, raw, start);
    item.evaluatedFiscalYear = 2022;
    item.department = raw.match(/^所管部課 (.+?) 関係部課(?: |$)/m)?.[1] ?? null;
    const yearHeader = raw.match(/^令和３年度 令和４年度 令和５年度$/m);
    if (yearHeader) {
      // Every value must carry its own 円 suffix, so missing cells cannot shift columns.
      const budget = raw.match(/^直 予 算 額 ([\d,]+|-) 円 ([\d,]+|-) 円 ([\d,]+|-) 円(?:\n|$)/m);
      const actual = raw.match(/^接 決 算 額 ([\d,]+|-) 円 ([\d,]+|-) 円(?: |\n|$)/m);
      for (const [row, kind, years] of [[budget, 'budget', [2021, 2022, 2023]], [actual, 'actual', [2021, 2022]]] as const) {
        if (!row) continue;
        for (let column = 0; column < years.length; column++) {
          item.amounts.push({ kind, fiscalYear: years[column], amountYen: row[column + 1] === '-' ? null : Number(row[column + 1].replaceAll(',', '')),
            rawValue: row[column + 1], rawUnit: '円', evidence: evidence(input, raw, start) });
        }
      }
    }
    // Restrict numeric KPI extraction to three explicit target cells, one complete
    // named activity/outcome row, and exactly two actual cells. Wrapped names are skipped.
    const kpiStart = raw.indexOf('種類 指 標 名 単位');
    const kpiEnd = raw.indexOf('指標に関する特記事項', kpiStart);
    if (kpiStart >= 0 && kpiEnd > kpiStart && yearHeader) {
      const kpi = raw.slice(kpiStart, kpiEnd);
      const rows = kpi.matchAll(/^\( ([\d,.]+|-) \) \( ([\d,.]+|-) \) \( ([\d,.]+|-) \)\n(成果|活動) ([^\n]+) ([^\s]+)\n(?:指 |標 )?([\d,.]+|-) ([\d,.]+|-)(?:\n|$)/gm);
      for (const row of rows) {
        for (let column = 0; column < 3; column++) {
          const actual = column < 2 ? row[7 + column] : null;
          item.indicators.push({ name: `【${row[4]}指標】${row[5]}`, fiscalYear: 2021 + column,
            target: row[1 + column] === '-' ? null : row[1 + column], actual: actual === '-' ? null : actual,
            unit: row[6], evidence: evidence(input, row[0], start + kpiStart + row.index!) });
        }
      }
    }
    const rating = raw.match(/^■ ([ＡＢＣ]) (計画どおり実施又は一層の充実を図る|事業の進め方を見直す|あらゆる角度から事業全体を見直す)/m);
    if (rating) item.ratings.push({ kind: 'self', label: '総合評価', value: rating[1], scale: rating[2], evidence: evidence(input, rating[0], start + rating.index!) });
    item.warnings.push('費用は直接費欄の予算・決算のみ。人件費・総事業費を加算していません。指標は年度の3目標列・2実績列と単位が完全に残る行のみ。左右混在する評価理由の文章は原文証拠に保持。');
    result.push(item);
  }
  // These two policy-position sheets repeat the same implementation and cost table.
  // Keep both official identifiers/evidence and distinct KPIs, but count one project/cost.
  const pollution = result.find(p => p.projectCode === '220311718');
  const water = result.find(p => p.projectCode === '210211719');
  if (pollution && water) {
    const implementation = (p: ProjectEvaluation) => p.evidence[0].rawText.split('２．事務事業の実施結果\n')[1]?.split('令和３年度 令和４年度 令和５年度')[0];
    const costSignature = (p: ProjectEvaluation) => JSON.stringify(p.amounts.map(a => [a.kind, a.fiscalYear, a.amountYen, a.rawValue]));
    if (!implementation(pollution) || implementation(pollution) !== implementation(water) || costSignature(pollution) !== costSignature(water)) {
      throw new Error('Kuki pollution duplicate reconciliation changed; manual source review required');
    }
    pollution.projectName = '公害監視調査事業（公害・水質の評価票を統合）';
    pollution.projectCode = '220311718 / 210211719';
    pollution.evidence.push(...water.evidence);
    for (const indicator of water.indicators) {
      if (!pollution.indicators.some(i => i.name === indicator.name && i.fiscalYear === indicator.fiscalYear && i.target === indicator.target && i.actual === indicator.actual && i.unit === indicator.unit)) pollution.indicators.push(indicator);
    }
    pollution.ratings.push(...water.ratings.map(r => ({ ...r, label: `${r.label}（水質票210211719）` })));
    pollution.warnings.push('原典の「公害監視調査事業 公害」（220311718）と「公害監視調査事業 水質」（210211719）は政策位置付けが異なる再掲。実施内容と全費用列の一致を照合し1事業に統合。各票の根拠・指標を保持し費用は1回のみ計上。');
    result.splice(result.indexOf(water), 1);
  }
  for (const item of result) if (['430210102', '730110103'].includes(item.projectCode ?? '')) {
    item.amounts = [];
    item.warnings.push('企画業務経費の高等教育機関連携分と地方分権分は活動内容が異なる一方、3予算・2決算の直接費が同額。共通経費の重複掲載か個別金額かを確定できないため、金額は原文根拠に保持し数値化を保留。');
  }
  return result;
}
