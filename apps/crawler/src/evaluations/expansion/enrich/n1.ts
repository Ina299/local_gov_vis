/** Enrichment sheet extractors (n1): 11343 小川町, 34214 安芸高田市, 10204 伊勢崎市, 13109 品川区, 10210 富岡市, 13102 中央区. */
import type { Entry } from '../batch9/i1-util';
import { shinagawaEntries } from '../batch12/m3-shinagawa';
import { akitakataEntry } from './n1-akitakata';
import { chuoEntry } from './n1-chuo';
import { isesakiEntry } from './n1-isesaki';
import { ogawaEntry } from './n1-ogawa';

export const entries: Record<string, Entry> = {
  '11343': ogawaEntry,
  '34214': akitakataEntry,
  '10204': isesakiEntry,
  '13102': chuoEntry,
  // The batch-12 department sheets; with no prior records (enrichment runs) nothing is excluded as already listed.
  '13109': { extract: shinagawaEntries['13109'].extract, scope: '品川区 部局別 事務事業評価シート（令和7・6年度）・行政評価シート（令和4年度）から、事業名・担当課・予算現額/決算額の計（節行の和と一致する場合のみ）・所管評価/最終評価を構造化（公開済みレコードの補強用）。指標表・財務諸表は対象外。' },
};
