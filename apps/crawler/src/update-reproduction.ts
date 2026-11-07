/** Update only reproduction metrics in existing data, preserving other enrichments. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { AGE_TABLES, FERTILITY_TABLE, loadReproductionData } from './demographics/reproduction';
import type { LocalGovBudget } from './types/budget';
const root = resolve(import.meta.dirname, '../../..');
const cache = join(root, 'apps/crawler/output/demographics');
await mkdir(cache, {recursive:true});
const sources: {id:string;url:string;sha256:string}[] = [];
const result = await loadReproductionData(async id => {
  const path = join(cache, `${id}.xlsx`), url = `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${id}&fileKind=0`;
  let bytes: Buffer;
  try { bytes = await readFile(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const response = await fetch(url); if (!response.ok) throw new Error(`${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer()); await writeFile(path, bytes);
  }
  sources.push({id,url,sha256:createHash('sha256').update(bytes).digest('hex')});
  console.log(`Loaded ${id}`); return bytes;
});
const publicDir = join(root, 'apps/web/public'), muniDir = join(publicDir, 'budgets/municipal');
const files = [join(publicDir,'budgets.json'),join(root,'data/budgets/prefectures.json'),
  ...(await readdir(muniDir)).filter(f => /^\d{2}\.json$/.test(f)).map(f => join(muniDir,f))];
for (const file of files) {
  const budgets: LocalGovBudget[] = JSON.parse(await readFile(file,'utf8'));
  for (const b of budgets) {
    b.demographics ??= {};
    delete b.demographics.regionalReproductionRate; delete b.demographics.totalFertilityRate;
    const rrr = result.byYear.get(b.fiscalYear)?.get(b.code), tfr = result.fertility.get(b.code);
    if (rrr !== undefined) b.demographics.regionalReproductionRate = rrr;
    if (tfr !== undefined) b.demographics.totalFertilityRate = tfr;
  }
  await writeFile(file,JSON.stringify(budgets));
}
await mkdir(join(root,'data/demographics'),{recursive:true});
await writeFile(join(root,'data/demographics/reproduction.json'),JSON.stringify({
  method:'RRR: female Japanese five-year cohort retention, fixed 2018–2022 fertility; fiscal year Y uses Jan 1 Y−4 to Jan 1 Y+1.',
  ageTables:AGE_TABLES,fertilityTable:FERTILITY_TABLE,sources,
  femaleAges:Object.fromEntries(Array.from(result.ages,([year,values])=>[year,Object.fromEntries(values)])),
  ageSpecificFertility:Object.fromEntries(result.rates), totalFertility:Object.fromEntries(result.fertility),
  regionalReproduction:Object.fromEntries(Array.from(result.byYear,([year,values])=>[year,Object.fromEntries(values)])),
})+'\n');
console.log('RRR coverage',Object.fromEntries(Array.from(result.byYear,([year,values])=>[year,values.size])));
