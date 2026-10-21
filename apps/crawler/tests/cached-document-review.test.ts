import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocumentReview, type DocumentReview } from '../src/audit-cached-document-reviews';
const row:DocumentReview={documentId:'doc',code:'12345',status:'held',reason:'The cached table has interleaved project names and fiscal columns.',evidenceQuotes:['name A / B'],remainingScope:'Column positions require original PDF.'};
test('review rejects unsupported claims, wrong municipality and missing remaining scope',()=>{
  assert.doesNotThrow(()=>validateDocumentReview(row,'12345','name A / B'));
  assert.throws(()=>validateDocumentReview(row,'54321','name A / B'),/municipality/);
  assert.throws(()=>validateDocumentReview({...row,evidenceQuotes:['invented']},'12345','name A / B'),/quote/);
  assert.throws(()=>validateDocumentReview({...row,remainingScope:''},'12345','name A / B'),/remaining scope/);
  assert.throws(()=>validateDocumentReview({...row,status:'extracted'},'12345','name A / B'),/implementation/);
});
test('unreviewed remains explicit and cannot silently become an evidence-backed hold',()=>{
  assert.doesNotThrow(()=>validateDocumentReview({...row,status:'unreviewed',reason:'',evidenceQuotes:[]},'12345','body'));
  assert.throws(()=>validateDocumentReview({...row,reason:'reviewed',evidenceQuotes:[]},'12345','body'),/specific reason/);
  assert.throws(()=>validateDocumentReview({...row,evidenceQuotes:[]},'12345','body'),/literal evidence/);
});

// The published ledger must remain reproducible against every retained source.
test('published cached review ledger covers every source with verified quotes', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { execFileSync } = await import('node:child_process');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const scratch = mkdtempSync(join(tmpdir(), 'cached-review-audit-'));
  try {
    const output = join(scratch, 'audit.json');
    execFileSync(process.execPath, ['--import', 'tsx', join(root, 'apps/crawler/src/audit-cached-document-reviews.ts'),
      root, join(root, 'data/evaluations/cached-review-batch6'), output], { stdio: 'pipe' });
    const bytes = readFileSync(output);
    const audit = JSON.parse(bytes.toString());
    assert.equal(audit.documents, 2460);
    assert.equal(audit.statusCounts.unreviewed, 0);
    assert.deepEqual(bytes, readFileSync(join(root, 'data/evaluations/cached-document-review-batch6.json')));
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
