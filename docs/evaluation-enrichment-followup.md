# Cached enrichment follow-up (2026-10-25)

PR #4 follows the merged PR #3; no merge or deployment is included.

## Remaining evidence

The original 177 held documents cover 76 municipalities. Of these, 35 have existing records with exactly matching source URL and content hash; 142 do not. None has additional pinned continuation text. This is an offline inventory, **not** a claim that 177 sources are inaccessible or that further extraction is impossible. The inventory retains every original reason, remaining scope, source identity and current matching record ID.

Two Kaizu documents contain seven complete purpose sentences before the cost-breakdown/right-column text. The building-maintenance record also has a complete outcome sentence. The curated generator checks the original record, source URL/hash and literal quotation before emitting seven patches (eight narrative fields). It does not infer years, money, ratings, or join interleaved text. Source acquisition timestamps are retained. Other fields in those two documents remain unresolved; the original first-pass review is immutable history, not a current completion count.

The other 175 documents have no newly accepted fields in this follow-up. Further work remains possible among the 33 other exact-binding documents, but requires per-record review of complete clauses and column ownership. Unbound documents require defensible same-business evidence; truncated or garbled text needs a verified fuller source or layout evidence. Iizuka's relative-year cost/indicator candidates and Miyoshi's missing primary identity proof remain held. No existing source hold or warning gate is changed; no municipal source was requested.

## Runner diagnosis

The original Node 24.19.0 full crawler run reported 382 passing tests and one file-level runner deserialization error; the affected pipeline file separately passed all nine tests. Ten additional bounded runs of that file passed before the mitigation, so this is intermittent and the local cause is not proven.

The error is consistent with [Node issue #64061](https://github.com/nodejs/node/issues/64061), concerning non-ASCII console output and test-runner IPC. Pipeline fixtures now capture progress logging through the native test-context mock, with additional assertions for successful and failed-refresh log messages. Automatic restoration and all existing assertions remain. Production CLI logging, test isolation and error handling are unchanged. The affected file plus fetch/adapter neighbors passed all 25 tests after the change. This does not establish a clean whole-suite result; exact-head CI remains necessary.

## Reproduction

The first input and 578-document review remain unchanged. `reproduce.ts` checks that first input's pinned hash even when later inputs exist. Run `node --import tsx apps/crawler/scripts/enrichment/kaizu-held-followup.ts <output.json>` for the curated follow-up. The importer accepts both immutable inputs and verifies their source proofs. `enrichment-statistical-audit-batch2.json` is the cumulative audit; batch1 remains the historical first increment.

Subsequent disposition of all 33 remaining source-matched documents is recorded in [the finite review report](evaluation-cached-review-completion.md). The figures above describe the previous increment, not an unfinished review queue.

The parent subsequently independently verified full CI success for `683fc2a82a3f347d97b002f739d4c5cfa78e14f7`: [run 40241783912, job 121315176507](https://github.com/Ina299/local_gov_vis/actions/runs/40241783912/job/121315176507), including full crawler/web tests, lint, typecheck, national verification and static export. The runner issue is resolved on that exact head. A later data-review head needs its own CI result.
