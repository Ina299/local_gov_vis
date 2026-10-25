import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEnrichmentReview,type EnrichmentReview} from '../src/audit-enrichment-reviews';
const row:EnrichmentReview={documentId:'a',code:'01234',status:'held',projectIds:[],patchIds:[],reason:'年度と費用の列が混線しており、元の事業との対応を確定できない。',evidenceQuotes:['事業名A'],remainingScope:'原本の列配置を確認する必要がある。'};
test('enrichment reviews reject unverified quotes, unreviewed rows and false enrichment claims',()=>{
 assert.doesNotThrow(()=>validateEnrichmentReview(row,'01234','事業名A'));
 assert.throws(()=>validateEnrichmentReview({...row,evidenceQuotes:['事業名B']},'01234','事業名A'),/quote/);
 assert.throws(()=>validateEnrichmentReview({...row,status:'enriched'},'01234','事業名A'),/Patch\/status/);
 assert.throws(()=>validateEnrichmentReview({...row,code:'54321'},'01234','事業名A'),/municipality/);
 assert.throws(()=>validateEnrichmentReview({...row,status:'unreviewed' as any},'01234','事業名A'),/status/);
});
