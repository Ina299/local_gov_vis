import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { buildRegionalReproductionRates, parseBayesianFertilityRates, parseTotalFertilityRates } from '../src/demographics/reproduction';

test('fertility parsing excludes health-centre codes and missing cells', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['01北海道',1.21,1,2,3,4,5,6,7], ['0110札幌市保健所',9,9,9,9,9,9,9,9],
    ['01101札幌市中央区','1.1*',1,2,3,4,5,6,7], ['01202欠測',null,null,2,3,4,5,6,7],
  ]), 'data');
  const buffer = XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
  const rates = parseBayesianFertilityRates(buffer), tfr = parseTotalFertilityRates(buffer);
  assert.deepEqual(rates.get('01'),[1,2,3,4,5,6,7]);
  assert.equal(tfr.get('01'),1.21); assert.equal(tfr.get('01101'),1.1);
  assert.equal(rates.has('01202'),false); assert.equal(tfr.has('01202'),false);
  assert.equal(rates.size,2);
});

test('RRR uses the five-year cohort ratio and rejects zero denominators', () => {
  const base = new Map([['01',Array(10).fill(100)]]), rates = new Map([['01',Array(7).fill(40)]]);
  const value = buildRegionalReproductionRates(base,base,rates).get('01')!;
  assert.ok(Math.abs(value - 7*5*.04*100/205) < .0001);
  assert.ok(buildRegionalReproductionRates(base,new Map([['01',Array(10).fill(90)]]),rates).get('01')! < value);
  assert.equal(buildRegionalReproductionRates(new Map([['01',Array(10).fill(0)]]),base,rates).size,0);
});

test('saved annual RRR can be reproduced from its official age inputs', () => {
  const saved = JSON.parse(readFileSync(new URL('../../../data/demographics/reproduction.json',import.meta.url),'utf8'));
  const rates = new Map<string,number[]>(Object.entries(saved.ageSpecificFertility));
  for (let year=2020;year<=2024;year++) {
    const actual = buildRegionalReproductionRates(new Map(Object.entries(saved.femaleAges[year-4])),new Map(Object.entries(saved.femaleAges[year+1])),rates);
    assert.deepEqual(Object.fromEntries(actual),saved.regionalReproduction[year]);
  }
  const values = Object.values(saved.regionalReproduction).map((m:any)=>m['20208']);
  assert.ok(new Set(values).size > 1);
});
